import { MasterProfile } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import { SavedAnswerItem } from '../types/answer-bank.js';
import { SkillRegistryEntry } from '../types/skills.js';
import { FormFieldDescriptor, FieldFillResult, ProposedAnswer } from '../types/page-fill.js';
import { classifyFieldIntent } from './field-classifier.js';

export interface ClassifyFieldsInput {
  fields: FormFieldDescriptor[];
  master: MasterProfile;
  careerProfile?: CareerProfile | null;
  savedAnswers: SavedAnswerItem[];
  skillRegistry: SkillRegistryEntry[];
}

export function classifyFields(input: ClassifyFieldsInput): { results: FieldFillResult[] } {
  const { fields, master, careerProfile, savedAnswers, skillRegistry } = input;
  const results: FieldFillResult[] = fields.map((field) => {
    const intent = classifyFieldIntent(field);
    if (field.controlType === 'file' || field.controlType === 'hidden') return mk(field, 'UNSUPPORTED', null, 'Control not supported');
    if (intent === 'sensitive' || field.sensitive || field.demographic) return mk(field, 'NEEDS_USER_INPUT', null, 'Sensitive — user input required');
    const ans = resolve(field, intent, master, careerProfile, savedAnswers, skillRegistry);
    if (ans) return { fieldId: field.runtimeId, label: field.label, controlType: field.controlType, status: ans.requiresReview ? 'GENERATED_REVIEW' : 'READY_TO_FILL', proposedAnswer: ans, wasChanged: false };
    return mk(field, 'NEEDS_USER_INPUT', null, `No source for: ${intent}`);
  });
  return { results };
}
function resolve(field: FormFieldDescriptor, intent: string, m: MasterProfile, cp: CareerProfile | null | undefined, ab: SavedAnswerItem[], sk: SkillRegistryEntry[]): ProposedAnswer | null {
  return mp(field, intent, m, cp) || cpFact(intent, cp) || abMatch(field, ab) || skMatch(intent, field, sk);
}

function pa(value: string, detail: string, origin: ProposedAnswer['origin'] = 'master_profile_fact', rev = false): ProposedAnswer {
  return { value, origin, sourceDetail: detail, confidence: rev ? 'medium' : 'high', requiresReview: rev };
}

function mk(field: FormFieldDescriptor, status: FieldFillResult['status'], answer: ProposedAnswer | null, reason: string): FieldFillResult {
  return { fieldId: field.runtimeId, label: field.label, controlType: field.controlType, status, proposedAnswer: answer, wasChanged: false, errorMessage: reason };
}

// ── Master Profile Facts ───────────────────────────────────────
function mp(field: FormFieldDescriptor, intent: string, m: MasterProfile, cp?: CareerProfile | null): ProposedAnswer | null {
  switch (intent) {
    case 'first_name': return pa(m.personal.firstName, 'personal.firstName');
    case 'last_name': return pa(m.personal.lastName, 'personal.lastName');
    case 'full_name': return pa(`${m.personal.firstName} ${m.personal.lastName}`, 'personal');
    case 'email': return pa(m.personal.email, 'personal.email');
    case 'phone': return pa(m.personal.phone, 'personal.phone');
    case 'linkedin': return pa(m.personal.linkedin, 'personal.linkedin');
    case 'github': return pa(m.personal.github, 'personal.github');
    case 'portfolio': case 'website': return pa(m.personal.portfolio || m.personal.github || '', 'personal.portfolio');
    case 'city': return pa(m.personal.city, 'personal.city');
    case 'region': return pa(m.personal.provinceState, 'personal.provinceState');
    case 'country': return pa(m.personal.country, 'personal.country');
    case 'address': return pa(`${m.personal.city}, ${m.personal.provinceState}, ${m.personal.country}`, 'personal.combined');
    case 'work_authorization': {
      const a = m.screening.workAuthorization.toLowerCase();
      if (a.includes('yes')||a.includes('citizen')||a.includes('authorized')||a.includes('pr')) return pa('Yes','screening.workAuthorization');
      if (a.includes('no')) return pa('No','screening.workAuthorization'); return null;
    }
    case 'sponsorship': {
      const s = m.screening.sponsorshipRequired.toLowerCase();
      if (s.includes('yes')||s.includes('require')) return pa('Yes','screening.sponsorshipRequired');
      if (s.includes('no')) return pa('No','screening.sponsorshipRequired'); return null;
    }
    case 'notice_period': return pa(m.screening.noticePeriod, 'screening.noticePeriod');
    case 'salary': {
      const cs = cp?.salaryPreferences?.target;
      return pa(cs || m.screening.targetSalary, cs ? 'careerProfile.salaryPreferences' : 'screening.targetSalary');
    }
    case 'relocation': {
      const w = cp?.locationPreferences?.willingToRelocate ?? m.screening.willingToRelocate;
      return w !== undefined ? pa(w ? 'Yes' : 'No', 'screening.willingToRelocate') : null;
    }
    case 'remote_preference': return m.screening.remoteEligibility ? pa(m.screening.remoteEligibility, 'screening.remoteEligibility') : null;
    case 'years_experience': {
      const y = cp?.seniorityPreferences?.yearsExperienceClaim;
      return pa(y || m.screening.yearsExperience, y ? 'careerProfile' : 'screening.yearsExperience');
    }
    case 'education_degree': {
      const d = m.education.map(e=>e.degree); const mst = d.find(x=>/master|m\.?sc/i.test(x));
      return pa(mst||d[0]||"Bachelor's Degree",'education');
    }
    case 'education_institution': return m.education[0] ? pa(m.education[0].institution,'education[0]') : null;
    case 'education_major': { const maj = m.education.map(e=>e.major).filter(Boolean); return maj[0] ? pa(maj[0],'education[0]') : null; }
    case 'current_employer': return m.experience[0] ? pa(m.experience[0].company,'experience[0]') : null;
    case 'current_title': return m.experience[0] ? pa(m.experience[0].title,'experience[0]') : null;
    default: return null;
  }
}

function abMatch(field: FormFieldDescriptor, items: SavedAnswerItem[]): ProposedAnswer | null {
  const q = (field.label || field.name || '').toLowerCase(); if (!q) return null;
  for (const item of items) {
    const p = item.questionPattern.toLowerCase();
    if (q.includes(p) || p.includes(q) || item.aliases.some(a=>q.includes(a.toLowerCase()))) {
      if (item.canonicalAnswer) return { value: item.canonicalAnswer, origin: 'answer_bank_entry', sourceDetail: `ab:${item.questionPattern}`, confidence: item.source==='user_confirmed'?'high':'medium', requiresReview: item.requiresHumanConfirmation!==false, reason: item.notes };
    }
  }
  return null;
}

function skMatch(intent: string, field: FormFieldDescriptor, registry: SkillRegistryEntry[]): ProposedAnswer | null {
  if (intent !== 'skills') return null;
  const ok = registry.filter(s=>s.status==='EXPLICIT_KNOWN'||s.status==='USER_APPROVED_KNOWN');
  const inf = registry.filter(s=>s.status==='INFERRED_KNOWN');
  if (field.options && field.options.length > 0) {
    const matched: string[] = []; const rev: string[] = [];
    for (const opt of field.options) {
      const l = opt.label.toLowerCase();
      if (ok.find(s=>s.canonicalName.toLowerCase()===l||s.aliases.some(a=>a.toLowerCase()===l))) { matched.push(opt.value); continue; }
      if (inf.find(s=>s.canonicalName.toLowerCase()===l||s.aliases.some(a=>a.toLowerCase()===l))) rev.push(opt.value);
    }
    if (matched.length) return { value: matched.join(', '), origin: 'user_approved_skill', sourceDetail: `skills:${matched.length} ok`, confidence: rev.length?'medium':'high', requiresReview: rev.length>0, reason: rev.length?`${rev.length} inferred need review`:'' };
    if (rev.length) return { value: rev.join(', '), origin: 'inferred_needs_review', sourceDetail: 'skills:all inferred', confidence: 'low', requiresReview: true, reason: 'All inferred — review required' };
    return null;
  }
  const names = ok.map(s=>s.canonicalName);
  return names.length ? { value: names.slice(0,10).join(', '), origin: 'user_approved_skill', sourceDetail: `skills:${names.length}`, confidence: 'high', requiresReview: false } : null;
}

function cpFact(intent: string, cp?: CareerProfile | null): ProposedAnswer | null {
  if (!cp) return null;
  if (intent === 'full_name' || intent === 'current_title') return pa(cp.headline, 'careerProfile.headline');
  return null;
}