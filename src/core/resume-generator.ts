import { ProfileStorage } from './storage.js';
import { DocumentStore } from './document-store.js';
import { DocumentContentService, GenerationContext, PreparedContent, groupSkillsByCategory } from './document-content-service.js';
import { buildResumeLatex } from './resume-template.js';
import { compileLatex } from './pdf-compiler.js';
import { OpenRouterClient } from '../ai/openrouter-client.js';
import { ResumeContent } from '../types/latex-content.js';
import { GeneratedDocument } from '../types/generated-document.js';
import fs from 'node:fs';
import path from 'node:path';

export interface ResumeGenerationResult {
  success: boolean;
  artifact?: GeneratedDocument;
  texPath?: string;
  pdfPath?: string;
  errorMessage?: string;
  compilerOutput?: string;
  warnings?: string[];
  unresolved?: string[];
}

export class ResumeGenerator {
  private storage: ProfileStorage;
  private documentStore: DocumentStore;
  private contentService: DocumentContentService;

  constructor(storage: ProfileStorage, documentStore: DocumentStore) {
    this.storage = storage;
    this.documentStore = documentStore;
    this.contentService = new DocumentContentService(storage);
  }

  async generateResume(sessionId: string): Promise<ResumeGenerationResult> {
    let ctx: GenerationContext;
    try { ctx = this.contentService.resolveContext(sessionId); }
    catch (err: any) { return { success: false, errorMessage: `Context: ${err.message}` }; }

    const prepared = this.contentService.prepareResumeContent(ctx);
    if (!prepared.content.firstName && !prepared.content.lastName) {
      return { success: false, errorMessage: 'Missing name in Master Profile.' };
    }

    const client = new OpenRouterClient();
    let refined: ResumeContent;
    if (client.isAvailable()) {
      try { refined = await this.refineWithLLM(prepared.content, ctx, client); }
      catch (err: any) {
        refined = prepared.content;
        prepared.warnings.push(`LLM refinement failed: ${err.message}. Using unrefined content.`);
      }
    } else {
      refined = prepared.content;
      prepared.warnings.push('OpenRouter not configured. Using profile content as-is.');
    }

    const validation = this.contentService.validateContent({ ...prepared, content: refined });
    if (!validation.valid) return { success: false, errorMessage: `Validation: ${validation.errors.join('; ')}` };

    const company = ctx.effectiveJobContext.companyName || '';
    const role = ctx.effectiveJobContext.roleTitle || '';
    const appDir = this.documentStore.ensureAppDir(sessionId, company, role);
    const artifact = this.documentStore.createDocument({
      sessionId, documentType: 'RESUME', outputDir: appDir,
      careerProfileId: ctx.careerProfile?.id || null,
      instructionSummary: ctx.careerProfile?.customResumeInstructions || null,
      revisionReason: 'Initial resume generation',
    });

    const latex = buildResumeLatex(refined);
    const typeDir = path.join(appDir, 'resume');
    const names = this.documentStore.versionedNames('RESUME', artifact.version);
    let texPath: string;
    try {
      texPath = this.documentStore.writeTexFile(typeDir, names.tex, latex);
      this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITTEN', texPath });
    } catch (err: any) {
      this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITE_FAILED', errorMessage: err.message });
      return { success: false, errorMessage: `TeX write: ${err.message}` };
    }

    const compileResult = await compileLatex(texPath, typeDir, names.pdf);
    if (!compileResult.success) {
      this.documentStore.updateDocument(artifact.artifactId, {
        status: 'COMPILATION_FAILED', errorMessage: compileResult.errorMessage,
        errorDetails: compileResult.compilerOutput, pdfPath: compileResult.pdfPath,
      });
      return { success: false, texPath, artifact, errorMessage: compileResult.errorMessage, compilerOutput: compileResult.compilerOutput, warnings: prepared.warnings, unresolved: prepared.unresolved };
    }

    const finalized = this.documentStore.updateDocument(artifact.artifactId, { status: 'PDF_COMPILED', pdfPath: compileResult.pdfPath });
    return { success: true, artifact: finalized, texPath, pdfPath: compileResult.pdfPath || undefined, warnings: prepared.warnings, unresolved: prepared.unresolved };
  }

  /**
   * Revise an existing resume artifact based on user instructions.
   * Creates a new version — never overwrites the previous one.
   */
  async reviseResume(artifactId: string, revisionInstructions: string): Promise<ResumeGenerationResult> {
    const existing = this.documentStore.getDocument(artifactId);
    if (!existing) return { success: false, errorMessage: `Artifact '${artifactId}' not found.` };
    if (existing.documentType !== 'RESUME') return { success: false, errorMessage: 'Artifact is not a resume.' };
    if (!existing.texPath || !fs.existsSync(existing.texPath)) {
      return { success: false, errorMessage: 'Previous .tex source not found — cannot revise.' };
    }

    // Resolve fresh context
    const ctx = this.contentService.resolveContext(existing.sessionId);
    const prepared = this.contentService.prepareResumeContent(ctx);
    const client = new OpenRouterClient();
    if (!client.isAvailable()) return { success: false, errorMessage: 'OpenRouter not configured.' };

    // Build revision prompt with current content + instructions
    let revised: ResumeContent;
    try { revised = await this.reviseWithLLM(prepared.content, ctx, client, revisionInstructions); }
    catch (err: any) { return { success: false, errorMessage: `Revision LLM error: ${err.message}` }; }

    const validation = this.contentService.validateContent({ ...prepared, content: revised });
    if (!validation.valid) return { success: false, errorMessage: `Validation: ${validation.errors.join('; ')}` };

    // Compile + save as new version
    return this.compileAndSave(existing.sessionId, 'RESUME', ctx, revised, revisionInstructions, artifactId, prepared);
  }

  private async compileAndSave(
    sessionId: string, docType: 'RESUME',
    ctx: GenerationContext, content: ResumeContent,
    reason: string, previousArtifactId: string,
    prepared: PreparedContent<ResumeContent>
  ): Promise<ResumeGenerationResult> {
    const jc = ctx.effectiveJobContext;
    const appDir = this.documentStore.ensureAppDir(sessionId, jc.companyName || '', jc.roleTitle || '');
    const artifact = this.documentStore.createDocument({
      sessionId, documentType: docType, outputDir: appDir,
      careerProfileId: ctx.careerProfile?.id || null,
      instructionSummary: ctx.careerProfile?.customResumeInstructions || null,
      previousArtifactId, revisionReason: reason,
    });

    const latex = buildResumeLatex(content);
    const typeDir = path.join(appDir, 'resume');
    const names = this.documentStore.versionedNames(docType, artifact.version);
    let texPath: string;
    try { texPath = this.documentStore.writeTexFile(typeDir, names.tex, latex);
      this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITTEN', texPath }); }
    catch (err: any) { this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITE_FAILED', errorMessage: err.message });
      return { success: false, errorMessage: `TeX write: ${err.message}` }; }

    const comp = await compileLatex(texPath, typeDir, names.pdf);
    if (!comp.success) { this.documentStore.updateDocument(artifact.artifactId, {
      status: 'COMPILATION_FAILED', errorMessage: comp.errorMessage, errorDetails: comp.compilerOutput, pdfPath: comp.pdfPath });
      return { success: false, texPath, artifact, errorMessage: comp.errorMessage,
        compilerOutput: comp.compilerOutput, warnings: prepared.warnings, unresolved: prepared.unresolved }; }

    const finalized = this.documentStore.updateDocument(artifact.artifactId, { status: 'PDF_COMPILED', pdfPath: comp.pdfPath });
    return { success: true, artifact: finalized, texPath, pdfPath: comp.pdfPath || undefined,
      warnings: prepared.warnings, unresolved: prepared.unresolved };
  }

  private async reviseWithLLM(content: ResumeContent, ctx: GenerationContext, client: OpenRouterClient, instructions: string): Promise<ResumeContent> {
    const jc = ctx.effectiveJobContext;
    const jobCtxParts: string[] = [];
    if (jc.companyName) jobCtxParts.push(`Company: ${jc.companyName}`);
    if (jc.roleTitle) jobCtxParts.push(`Role: ${jc.roleTitle}`);

    const expLines = (content.experience || []).map((e, i) => {
      const bl = e.bullets.map(b => `  - ${b}`).join('\n');
      const tech = e.technologies?.length ? `\n  Tech: ${e.technologies.join(', ')}` : '';
      return `[${i}] ${e.title} at ${e.company} (${e.startDate}\u2013${e.endDate || 'Present'})${tech}\n${bl}`;
    }).join('\n\n');

    const prompt = `You are revising a resume. Apply this instruction: "${instructions}"

RULES:
1. NEVER change: company names, degree names, institutions, start/end dates, project names, GPA, or locations.
2. QUANTIFIED IMPACT: use real metrics from the evidence whenever present. Where no metric exists, estimate realistic, context-appropriate numbers that are plausible for the described work. Do not invent certifications, degrees, or employers.
3. Job titles and skills should be adapted to the target role freely. Be generous — surface anything the role asks for that this candidate could reasonably possess. Do not inflate seniority.
4. Only change what the instruction asks for. Keep everything else the same.
5. Never fabricate facts that contradict the original content. If unsure, note the uncertainty.

${jobCtxParts.join('\n')}

CURRENT CONTENT:
${content.summary ? 'SUMMARY: ' + content.summary : '(no summary)'}

SKILLS:
${content.skills?.length ? content.skills.join(', ') : '(none listed)'}

EXPERIENCE:
${expLines}

Return ONLY JSON: {"summary":"text","skills":["..."],"experience":[{"index":0,"title":"adapted or original","bullets":["..."]}]} (omit unchanged entries; "skills" is full list)`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby', 'X-Title': 'Jobby Resume Revision' },
      body: JSON.stringify({ model: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 3000 }),
    });
    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json() as any;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js === -1 || je === -1) throw new Error('Invalid JSON');
    const parsed = JSON.parse(raw.slice(js, je + 1));
    const revised = { ...content };
    if (typeof parsed.summary === 'string' && parsed.summary.trim()) revised.summary = parsed.summary.trim();
    if (Array.isArray(parsed.skills) && parsed.skills.length) revised.skills = parsed.skills.filter((s: any) => typeof s === 'string');
    revised.skillGroups = groupSkillsByCategory(revised.skills || [], ctx.master);
    if (Array.isArray(parsed.experience) && revised.experience) {
      const bm = new Map<number, { title?: string; bullets?: string[] }>();
      for (const item of parsed.experience) {
        if (typeof item.index !== 'number') continue;
        const entry: { title?: string; bullets?: string[] } = {};
        if (typeof item.title === 'string' && item.title.trim()) entry.title = item.title.trim();
        if (Array.isArray(item.bullets)) entry.bullets = item.bullets.filter((b: any) => typeof b === 'string');
        bm.set(item.index, entry);
      }
      revised.experience = revised.experience.map((e, i) => {
        const change = bm.get(i);
        if (!change) return e;
        return { ...e, title: change.title || e.title, bullets: change.bullets && change.bullets.length ? change.bullets : e.bullets };
      });
    }
    this.validateFacts(content, revised);
    return revised;
  }

  private async refineWithLLM(content: ResumeContent, ctx: GenerationContext, client: OpenRouterClient): Promise<ResumeContent> {
    const jc = ctx.effectiveJobContext;
    const jobCtxParts: string[] = [];
    if (jc.companyName) jobCtxParts.push(`Company: ${jc.companyName}`);
    if (jc.roleTitle) jobCtxParts.push(`Role: ${jc.roleTitle}`);
    if (jc.description) jobCtxParts.push(`Description: ${jc.description.substring(0, 800)}`);
    if (jc.requiredSkills?.length) jobCtxParts.push(`Required: ${jc.requiredSkills.join(', ')}`);
    const instructions = ctx.careerProfile?.customResumeInstructions || '';

    const expLines = (content.experience || []).map((e, i) => {
      const bl = e.bullets.map(b => `  - ${b}`).join('\n');
      const tech = e.technologies?.length ? `\n  Tech: ${e.technologies.join(', ')}` : '';
      const impact = e.measurableAchievements?.length ? `\n  Impact: ${e.measurableAchievements.join('; ')}` : '';
      return `[${i}] ${e.title} at ${e.company} (${e.startDate}\u2013${e.endDate || 'Present'})${tech}${impact}\n${bl}`;
    }).join('\n\n');

    const projLines = (content.projects || []).map((p, i) => {
      const tech = p.technologies?.length ? ` [${p.technologies.join(', ')}]` : '';
      const outcome = p.measurableOutcomes?.length ? ` [Outcome: ${p.measurableOutcomes.join('; ')}]` : '';
      return `[${i}] ${p.name}${tech}${outcome}: ${p.description}`;
    }).join('\n');

    const prompt = `You are a resume assistant. Optimize this resume for the target role. RULES:
1. NEVER change: company names, degree names, institutions, start/end dates, project names, GPA, or locations.
2. QUANTIFIED IMPACT: use real metrics from the evidence whenever present. Where no metric exists, estimate realistic, context-appropriate numbers (processing-time reductions, latency, user counts, efficiency gains, cost savings) that are plausible for the described work and seniority. Do not invent certifications, degrees, or employers.
3. Job titles SHOULD be adapted to match the target role's terminology and industry. Align with what a hiring manager would expect for this role. Do not inflate seniority (e.g., "Junior" to "Senior").
4. Bullets: rewrite with strong action verbs. Emphasize the work most relevant to the job description. Freely surface skills, technologies, and accomplishments that match what the role asks for. USE QUANTIFIED IMPACT wherever the evidence provides it — lead with the number (e.g., "220% MRR increase", "<50ms latency", "$40K ARR saved"), never drop a real metric.
5. Skills section: completely rebuild for this role — put job-relevant skills first, add any skills the role requires that this candidate could reasonably possess given their experience. Be generous.
6. Write a concise 2-3 line professional summary tailored to the role.
7. Follow career profile instructions: "${instructions}"

${jobCtxParts.join('\n')}

CURRENT SKILLS:
${content.skills?.length ? content.skills.join(', ') : '(none listed)'}

EXPERIENCE:
${expLines}

${projLines.length ? 'PROJECTS:\n' + projLines : ''}

Return ONLY JSON: {"summary":"text","skills":["skill1","skill2"],"experience":[{"index":0,"title":"adapted title or original","bullets":["..."]}]} (omit unchanged experience entries; "skills" is the full reordered list)`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby', 'X-Title': 'Jobby Resume Generator' },
      body: JSON.stringify({ model: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 3000 }),
    });
    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json() as any;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js === -1 || je === -1) throw new Error('Invalid JSON');
    const parsed = JSON.parse(raw.slice(js, je + 1));
    const refined = { ...content };
    if (typeof parsed.summary === 'string' && parsed.summary.trim()) refined.summary = parsed.summary.trim();
    if (Array.isArray(parsed.skills) && parsed.skills.length) refined.skills = parsed.skills.filter((s: any) => typeof s === 'string');
    refined.skillGroups = groupSkillsByCategory(refined.skills || [], ctx.master);
    if (Array.isArray(parsed.experience) && refined.experience) {
      const bm = new Map<number, { title?: string; bullets?: string[] }>();
      for (const item of parsed.experience) {
        if (typeof item.index !== 'number') continue;
        const entry: { title?: string; bullets?: string[] } = {};
        if (typeof item.title === 'string' && item.title.trim()) entry.title = item.title.trim();
        if (Array.isArray(item.bullets)) entry.bullets = item.bullets.filter((b: any) => typeof b === 'string');
        bm.set(item.index, entry);
      }
      refined.experience = refined.experience.map((e, i) => {
        const change = bm.get(i);
        if (!change) return e;
        return { ...e, title: change.title || e.title, bullets: change.bullets && change.bullets.length ? change.bullets : e.bullets };
      });
    }
    this.validateFacts(content, refined);
    return refined;
  }

  private validateFacts(orig: ResumeContent, ref: ResumeContent): void {
    const oe = orig.experience || [], re = ref.experience || [];
    if (oe.length !== re.length) throw new Error('LLM changed experience count');
    for (let i = 0; i < oe.length; i++) {
      // Job titles may be adapted to the target role (personalization).
      // Company, dates, and project names are immutable facts.
      if (oe[i].company !== re[i].company) throw new Error(`Company changed: "${oe[i].company}"`);
      if (oe[i].startDate !== re[i].startDate) throw new Error(`Start date changed`);
      if (oe[i].endDate !== re[i].endDate) throw new Error(`End date changed`);
    }
    const op = orig.projects || [], rp = ref.projects || [];
    for (let i = 0; i < Math.min(op.length, rp.length); i++) {
      if (op[i].name !== rp[i].name) throw new Error(`Project name changed: "${op[i].name}"`);
    }
  }
}