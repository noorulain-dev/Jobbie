import { ProfileStorage } from './storage.js';
import { DocumentStore } from './document-store.js';
import { DocumentContentService, GenerationContext } from './document-content-service.js';
import { buildCoverLetterLatex } from './cover-letter-template.js';
import { compileLatex } from './pdf-compiler.js';
import { OpenRouterClient } from '../ai/openrouter-client.js';
import { CoverLetterContent } from '../types/latex-content.js';
import { GeneratedDocument } from '../types/generated-document.js';
import fs from 'node:fs';
import path from 'node:path';

export interface CoverLetterGenerationResult {
  success: boolean;
  artifact?: GeneratedDocument;
  texPath?: string;
  pdfPath?: string;
  errorMessage?: string;
  compilerOutput?: string;
  warnings?: string[];
  unresolved?: string[];
}

export class CoverLetterGenerator {
  private storage: ProfileStorage;
  private documentStore: DocumentStore;
  private contentService: DocumentContentService;

  constructor(storage: ProfileStorage, documentStore: DocumentStore) {
    this.storage = storage;
    this.documentStore = documentStore;
    this.contentService = new DocumentContentService(storage);
  }

  async generateCoverLetter(sessionId: string): Promise<CoverLetterGenerationResult> {
    let ctx: GenerationContext;
    try { ctx = this.contentService.resolveContext(sessionId); }
    catch (err: any) { return { success: false, errorMessage: `Context: ${err.message}` }; }

    const prepared = this.contentService.prepareCoverLetterContent(ctx);
    if (!prepared.content.firstName && !prepared.content.lastName) {
      return { success: false, errorMessage: 'Missing name in Master Profile.' };
    }

    const jc = ctx.effectiveJobContext;
    if (!jc.companyName && !jc.roleTitle) {
      return { success: false, errorMessage: 'No company or role in job context. Attach a job posting first.' };
    }
    if (!jc.description && !jc.responsibilities?.length) {
      prepared.warnings.push('Job description missing — letter will be generic.');
    }

    const client = new OpenRouterClient();
    if (!client.isAvailable()) {
      return { success: false, errorMessage: 'OpenRouter not configured.' };
    }

    let paragraphs: string[];
    try { paragraphs = await this.generateBody(prepared.content, ctx, client); }
    catch (err: any) { return { success: false, errorMessage: `LLM: ${err.message}` }; }
    if (!paragraphs?.length) return { success: false, errorMessage: 'LLM returned empty body.' };

    const content: CoverLetterContent = { ...prepared.content, paragraphs };
    const validation = this.contentService.validateContent({ ...prepared, content });
    if (!validation.valid) return { success: false, errorMessage: `Validation: ${validation.errors.join('; ')}` };

    const company = jc.companyName || 'Unknown', role = jc.roleTitle || 'Unknown';
    const appDir = this.documentStore.ensureAppDir(sessionId, company, role);
    const artifact = this.documentStore.createDocument({
      sessionId, documentType: 'COVER_LETTER', outputDir: appDir,
      careerProfileId: ctx.careerProfile?.id || null,
      instructionSummary: ctx.careerProfile?.customCoverLetterInstructions || null,
      revisionReason: 'Initial cover letter generation',
    });

    const latex = buildCoverLetterLatex(content);
    const typeDir = path.join(appDir, 'cover-letter');
    const names = this.documentStore.versionedNames('COVER_LETTER', artifact.version);
    let texPath: string;
    try {
      texPath = this.documentStore.writeTexFile(typeDir, names.tex, latex);
      this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITTEN', texPath });
    } catch (err: any) {
      this.documentStore.updateDocument(artifact.artifactId, { status: 'TEX_WRITE_FAILED', errorMessage: err.message });
      return { success: false, errorMessage: `TeX write: ${err.message}` };
    }

    const comp = await compileLatex(texPath, typeDir, names.pdf);
    if (!comp.success) {
      this.documentStore.updateDocument(artifact.artifactId, {
        status: 'COMPILATION_FAILED', errorMessage: comp.errorMessage,
        errorDetails: comp.compilerOutput, pdfPath: comp.pdfPath });
      return { success: false, texPath, artifact, errorMessage: comp.errorMessage,
        compilerOutput: comp.compilerOutput, warnings: prepared.warnings, unresolved: prepared.unresolved };
    }

    const finalized = this.documentStore.updateDocument(artifact.artifactId, {
      status: 'PDF_COMPILED', pdfPath: comp.pdfPath });
    return { success: true, artifact: finalized, texPath, pdfPath: comp.pdfPath || undefined,
      warnings: prepared.warnings, unresolved: prepared.unresolved };
  }
async reviseCoverLetter(artifactId: string, revisionInstructions: string): Promise<CoverLetterGenerationResult> {
    const existing = this.documentStore.getDocument(artifactId);
    if (!existing) return { success: false, errorMessage: `Artifact '${artifactId}' not found.` };
    if (existing.documentType !== 'COVER_LETTER') return { success: false, errorMessage: 'Artifact is not a cover letter.' };

    const ctx = this.contentService.resolveContext(existing.sessionId);
    const prepared = this.contentService.prepareCoverLetterContent(ctx);
    const client = new OpenRouterClient();
    if (!client.isAvailable()) return { success: false, errorMessage: 'OpenRouter not configured.' };

    let paragraphs: string[];
    try { paragraphs = await this.reviseBody(prepared.content, ctx, client, revisionInstructions); }
    catch (err: any) { return { success: false, errorMessage: `Revision LLM: ${err.message}` }; }
    if (!paragraphs?.length) return { success: false, errorMessage: 'LLM returned empty body.' };

    const content: CoverLetterContent = { ...prepared.content, paragraphs };
    const jc = ctx.effectiveJobContext;
    const appDir = this.documentStore.ensureAppDir(existing.sessionId, jc.companyName || '', jc.roleTitle || '');
    const artifact = this.documentStore.createDocument({
      sessionId: existing.sessionId, documentType: 'COVER_LETTER', outputDir: appDir,
      careerProfileId: ctx.careerProfile?.id || null,
      instructionSummary: ctx.careerProfile?.customCoverLetterInstructions || null,
      previousArtifactId: artifactId, revisionReason: revisionInstructions,
    });

    const latex = buildCoverLetterLatex(content);
    const typeDir = path.join(appDir, 'cover-letter');
    const names = this.documentStore.versionedNames('COVER_LETTER', artifact.version);
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

  private async reviseBody(content: CoverLetterContent, ctx: GenerationContext, client: OpenRouterClient, instructions: string): Promise<string[]> {
    const { master, careerProfile: cp, effectiveJobContext: jc } = ctx;
    const jp: string[] = [];
    if (jc.companyName) jp.push(`COMPANY: ${jc.companyName}`);
    if (jc.roleTitle) jp.push(`ROLE: ${jc.roleTitle}`);
    const ep: string[] = []; ep.push(`NAME: ${master.personal.firstName} ${master.personal.lastName}`);
    const approved = master.skills.filter(s => s.status === 'EXPLICIT_KNOWN' || s.status === 'USER_APPROVED_KNOWN');
    if (approved.length) ep.push(`SKILLS: ${approved.map(s => s.name).join(', ')}`);

    const currentBody = (content.paragraphs || []).join('\n\n');

    const prompt = `You are revising a cover letter. Apply this instruction: "${instructions}"

RULES:
1. NEVER fabricate metrics, years, credentials, or company knowledge.
2. NEVER invent contact names, addresses, or personal anecdotes.
3. Only change what the instruction asks for. Keep everything else the same.
4. Connect real experience to job requirements.
5. Keep concise: 1 opening + 1-2 body + 1 closing paragraph.

${jp.join('\n')}
${ep.join('\n')}

CURRENT LETTER:\n${currentBody}

Return ONLY JSON: {"paragraphs":["Opening...","Body...","Closing..."]}`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby', 'X-Title': 'Jobby Cover Letter Revision' },
      body: JSON.stringify({ model: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 2000 }),
    });
    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json() as any;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js === -1 || je === -1) throw new Error('Invalid JSON');
    const parsed = JSON.parse(raw.slice(js, je + 1));
    const result = parsed.paragraphs?.filter((p: any) => typeof p === 'string' && p.trim().length > 10);
    if (!result?.length) throw new Error('No valid paragraphs');
    return result;
  }

  private async generateBody(content: CoverLetterContent, ctx: GenerationContext, client: OpenRouterClient): Promise<string[]> {
    const { master, careerProfile: cp, effectiveJobContext: jc } = ctx;
    const instructions = cp?.customCoverLetterInstructions || '';

    const jp: string[] = [];
    if (jc.companyName) jp.push(`COMPANY: ${jc.companyName}`);
    if (jc.roleTitle) jp.push(`ROLE: ${jc.roleTitle}`);
    if (jc.description) jp.push(`DESCRIPTION: ${jc.description.substring(0, 1000)}`);
    if (jc.responsibilities?.length) jp.push(`RESPONSIBILITIES:\n${jc.responsibilities.slice(0, 5).map((r: string) => `- ${r}`).join('\n')}`);
    if (jc.requiredSkills?.length) jp.push(`REQUIRED SKILLS: ${jc.requiredSkills.join(', ')}`);
    if (jc.requiredQualifications?.length) jp.push(`REQUIRED QUALIFICATIONS:\n${jc.requiredQualifications.slice(0, 3).map((q: string) => `- ${q}`).join('\n')}`);

    const ep: string[] = [];
    ep.push(`NAME: ${master.personal.firstName} ${master.personal.lastName}`);
    const expPriority = cp?.priorityExperienceIds || master.experience.map(e => e.id);
    const expMap = new Map(master.experience.map(e => [e.id, e]));
    for (const e of expPriority.map(id => expMap.get(id)!).filter(Boolean).slice(0, 3)) {
      ep.push(`${e.title} at ${e.company} (${e.startDate}\u2013${e.endDate || 'Present'})\n${e.bulletPoints.slice(0, 3).map(b => b.text).join('\n')}`);
    }
    const approved = master.skills.filter(s => s.status === 'EXPLICIT_KNOWN' || s.status === 'USER_APPROVED_KNOWN');
    if (approved.length) ep.push(`SKILLS: ${approved.map(s => s.name).join(', ')}`);
    if (master.education.length) {
      const ed = master.education[0];
      ep.push(`EDUCATION: ${ed.degree}${ed.major ? ' in ' + ed.major : ''} from ${ed.institution}`);
    }
    const projIds = cp?.highlightedProjectIds || master.projects.map(p => p.id);
    const projMap = new Map(master.projects.map(p => [p.id, p]));
    for (const p of projIds.map(id => projMap.get(id)!).filter(Boolean).slice(0, 2)) {
      ep.push(`PROJECT: ${p.name} \u2014 ${p.description}`);
    }

    const prompt = `You are a cover letter assistant. Write a professional letter body.

RULES:
1. ONLY use provided evidence. NEVER fabricate metrics, years, credentials, or company knowledge.
2. NEVER claim familiarity with company culture, products, or strategy.
3. NEVER invent a contact name or address. Use neutral salutation.
4. NEVER mention salary, visa, demographics, or contact details.
5. Connect real experience to job requirements with concrete evidence.
6. Keep concise: 1 opening + 1-2 body + 1 closing paragraph.
7. DO NOT re-list the resume or repeat the job description.
8. NO generic "passion" or "ideal candidate" language.
9. Career profile instructions: "${instructions}"
10. If job description is sparse, write a general letter without fabricating specifics.

${jp.join('\n')}

${ep.join('\n')}

Return ONLY JSON: {"paragraphs":["Opening...","Body...","Closing..."]}`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby', 'X-Title': 'Jobby Cover Letter' },
      body: JSON.stringify({ model: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 2000 }),
    });
    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json() as any;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}');
    if (js === -1 || je === -1) throw new Error('Invalid JSON');
    const parsed = JSON.parse(raw.slice(js, je + 1));
    const result = parsed.paragraphs?.filter((p: any) => typeof p === 'string' && p.trim().length > 10);
    if (!result?.length) throw new Error('No valid paragraphs returned');
    return result;
  }
}