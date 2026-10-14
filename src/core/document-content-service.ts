import { ProfileStorage } from './storage.js';
import { SkillIntelligenceService } from './skill-intelligence.js';
import { MasterProfile } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import { ApplicationSession } from '../types/application-session.js';
import { SavedAnswerItem } from '../types/answer-bank.js';
import {
  ResumeContent, ResumeExperienceEntry, ResumeEducationEntry, ResumeProjectEntry,
  CoverLetterContent,
} from '../types/latex-content.js';

export interface ClaimEvidence {
  claim: string;
  source: string;
  profileField: string;
  approved: boolean;
  note?: string;
}

export interface PreparedContent<T> {
  content: T;
  evidence: ClaimEvidence[];
  warnings: string[];
  unresolved: string[];
}

export interface GenerationContext {
  session: ApplicationSession;
  master: MasterProfile;
  careerProfile: CareerProfile | null;
  effectiveJobContext: Record<string, any>;
  approvedSkills: string[];
  savedAnswers: SavedAnswerItem[];
}

export class DocumentContentService {
  private storage: ProfileStorage;
  private skillIntel: SkillIntelligenceService;

  constructor(storage: ProfileStorage) {
    this.storage = storage;
    this.skillIntel = new SkillIntelligenceService();
  }

  resolveContext(sessionId: string): GenerationContext {
    const session = this.storage.getSession(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    const master = this.storage.getMasterProfile();
    if (!master) throw new Error('Master Profile not configured.');
    const cpId = session.selectedCareerProfileId;
    const cp = cpId ? this.storage.getCareerProfile(cpId) : null;
    const careerProfile = cp || this.storage.getCareerProfiles()[0] || null;
    const snapshot = session.jobContextSnapshot;
    const overrides = session.jobContextOverrides || {};
    const effective: Record<string, any> = {};
    const skip = new Set(['extractionTimestamp','extractionConfidence','extractionWarnings','source','parserVersion']);
    for (const key of Object.keys(snapshot as Record<string, any>)) {
      if (skip.has(key)) continue;
      const ov = (overrides as Record<string, any>)[key];
      effective[key] = (ov !== undefined && ov !== null) ? ov : (snapshot as Record<string, any>)[key];
    }
    const registry = this.skillIntel.buildRegistry(master);
    const approvedSkills = registry
      .filter(s => s.status === 'EXPLICIT_KNOWN' || s.status === 'USER_APPROVED_KNOWN')
      .map(s => s.canonicalName);
    const savedAnswers = this.storage.getAnswerBankItems();
    return { session, master, careerProfile, effectiveJobContext: effective, approvedSkills, savedAnswers };
  }
prepareResumeContent(ctx: GenerationContext): PreparedContent<ResumeContent> {
    const { master, careerProfile: cp, approvedSkills } = ctx;
    const evidence: ClaimEvidence[] = [];
    const warnings: string[] = [];
    const unresolved: string[] = [];
    const content: ResumeContent = {
      firstName: master.personal.firstName, lastName: master.personal.lastName,
      email: master.personal.email, phone: master.personal.phone,
      city: master.personal.city, provinceState: master.personal.provinceState,
      country: master.personal.country,
      linkedin: master.personal.linkedin, github: master.personal.github,
      portfolio: master.personal.portfolio,
    };
    evidence.push({ claim: 'Contact', source: 'personal', profileField: 'personal.*', approved: true });
    if (cp?.narrativeSummary) {
      content.summary = cp.narrativeSummary;
      evidence.push({ claim: 'Summary', source: 'careerProfile', profileField: 'narrativeSummary', approved: true });
    }
    const expPriority = cp?.priorityExperienceIds || master.experience.map(e => e.id);
    const expMap = new Map(master.experience.map(e => [e.id, e]));
    const orderedExp = expPriority.map(id => expMap.get(id)!).filter(Boolean);
    if (orderedExp.length) {
      content.experience = orderedExp.map(e => ({
        title: e!.title, company: e!.company, startDate: e!.startDate, endDate: e!.endDate,
        location: e!.location, bullets: e!.bulletPoints.map(b => b.text),
        technologies: [...new Set([...e!.technologies, ...e!.bulletPoints.flatMap(b => b.technologies)])].length
          ? [...new Set([...e!.technologies, ...e!.bulletPoints.flatMap(b => b.technologies)])] : undefined,
      }));
      evidence.push({ claim: 'Experience', source: 'experience', profileField: 'experience[*]', approved: true,
        note: cp?.priorityExperienceIds ? 'Career Profile priority' : 'Default order' });
    } else unresolved.push('No experience.');
    if (master.education.length) {
      content.education = master.education.map(e => ({
        degree: e.degree, major: e.major || undefined, institution: e.institution,
        gpa: e.gpa || undefined, startDate: e.startDate || undefined, endDate: e.endDate || undefined,
      }));
      evidence.push({ claim: 'Education', source: 'education', profileField: 'education[*]', approved: true });
    } else unresolved.push('No education.');
    if (approvedSkills.length) {
      const deemph = new Set(cp?.deemphasizedSkillIds || []);
      const primary = new Set(cp?.primarySkillIds || []);
      content.skills = [...approvedSkills.filter(s => primary.has(s)), ...approvedSkills.filter(s => !primary.has(s) && !deemph.has(s))];
      evidence.push({ claim: 'Skills', source: 'skills', profileField: 'skills[*]', approved: true });
    }
    const unapproved = master.skills.filter(s => s.status !== 'EXPLICIT_KNOWN' && s.status !== 'USER_APPROVED_KNOWN');
    if (unapproved.length) warnings.push(`${unapproved.length} skill(s) excluded — not approved.`);
    const projIds = cp?.highlightedProjectIds || master.projects.map(p => p.id);
    const projMap = new Map(master.projects.map(p => [p.id, p]));
    const orderedProj = projIds.map(id => projMap.get(id)!).filter(Boolean);
    if (orderedProj.length) {
      content.projects = orderedProj.map(p => ({
        name: p.name, description: p.description, url: p.url || undefined,
        technologies: p.technologies.length ? p.technologies : undefined,
      }));
      evidence.push({ claim: 'Projects', source: 'projects', profileField: 'projects[*]', approved: true });
    }
    if (master.certifications.length) { content.certifications = master.certifications.map(c => c.title); evidence.push({ claim: 'Certs', source: 'certifications', profileField: 'certifications[*]', approved: true }); }
    if (master.languages.length) { content.languages = master.languages.map(l => `${l.language} (${l.proficiency})`); evidence.push({ claim: 'Languages', source: 'languages', profileField: 'languages[*]', approved: true }); }
    if (master.awards.length) { content.awards = master.awards.map(a => a.title); evidence.push({ claim: 'Awards', source: 'awards', profileField: 'awards[*]', approved: true }); }
    return { content, evidence, warnings, unresolved };
  }

  prepareCoverLetterContent(ctx: GenerationContext): PreparedContent<CoverLetterContent> {
    const { master, effectiveJobContext: jc } = ctx;
    const evidence: ClaimEvidence[] = [];
    const warnings: string[] = [];
    const unresolved: string[] = [];
    const content: CoverLetterContent = {
      firstName: master.personal.firstName, lastName: master.personal.lastName,
      email: master.personal.email, phone: master.personal.phone,
      date: new Date().toISOString().slice(0, 10),
      companyName: jc.companyName || undefined,
      roleTitle: jc.roleTitle || undefined,
      paragraphs: undefined, closing: 'Sincerely,',
    };
    evidence.push({ claim: 'Sender info', source: 'personal', profileField: 'personal.*', approved: true });
    if (jc.companyName) evidence.push({ claim: 'Company', source: 'jobContext', profileField: 'companyName', approved: true });
    if (jc.roleTitle) evidence.push({ claim: 'Role', source: 'jobContext', profileField: 'roleTitle', approved: true });
    if (!jc.companyName) unresolved.push('Company name unknown — recipient will be omitted.');
    if (!jc.roleTitle) warnings.push('Role title missing — Re: line omitted.');
    return { content, evidence, warnings, unresolved };
  }

  validateContent<T extends ResumeContent | CoverLetterContent>(prepared: PreparedContent<T>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const c = prepared.content as Record<string, any>;
    if (!c.firstName && !c.lastName) errors.push('Missing first and last name — cannot generate.');
    if ('experience' in c && 'education' in c) {
      const rc = c as ResumeContent;
      if (!rc.experience && !rc.education && !rc.projects) errors.push('Empty document — no experience, education, or projects.');
    }
    if ('paragraphs' in c) {
      const cc = c as CoverLetterContent;
      if (cc.paragraphs?.some((p: string) => p.length > 5000)) errors.push('Paragraph exceeds 5000 characters.');
    }
    const unapproved = prepared.evidence.filter(e => !e.approved);
    if (unapproved.length) errors.push(`${unapproved.length} unapproved claims: ${unapproved.map(e => e.claim).join(', ')}`);
    return { valid: errors.length === 0, errors };
  }
}