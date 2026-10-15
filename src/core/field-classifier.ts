import { MasterProfile } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import { SavedAnswerItem } from '../types/answer-bank.js';
import { SkillRegistryEntry } from '../types/skills.js';
import { FormFieldDescriptor, FieldFillResult, ProposedAnswer, AnswerOrigin } from '../types/page-fill.js';

type FieldIntent =
  | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
  | 'linkedin' | 'github' | 'portfolio' | 'website'
  | 'city' | 'region' | 'country' | 'address'
  | 'current_employer' | 'current_title' | 'previous_employer'
  | 'education_degree' | 'education_institution' | 'education_major' | 'graduation_year'
  | 'skills' | 'years_experience'
  | 'work_authorization' | 'sponsorship' | 'notice_period' | 'salary'
  | 'relocation' | 'remote_preference' | 'travel'
  | 'narrative' | 'unknown' | 'sensitive' | 'unsupported';

interface IntentRule { intent: FieldIntent; priority: number; patterns: RegExp[]; }

const INTENT_RULES: IntentRule[] = [
  { intent: 'sensitive', priority: 10, patterns: [/\b(password|credit card|cvv|ssn|social security|government id|passport number|bank account|routing number)\b/i] },
  { intent: 'sensitive', priority: 10, patterns: [/\b(disability|veteran|race|ethnicity|gender identity|sexual orientation|religion|medical condition)\b/i] },
  { intent: 'sponsorship', priority: 9, patterns: [/\b(require|need)\b.*\b(sponsorship|visa)\b/i, /\b(sponsorship|visa)\b.*\b(require|need)\b/i, /\bwill you.*require.*sponsor/i, /\bsponsorship required\b/i] },
  { intent: 'work_authorization', priority: 8, patterns: [/\b(legally|authorized|eligib|permit)\b.*\b(work|employed|employment)\b/i, /\b(authorized|permitted)\b.*\bto work\b/i, /\bright to work\b/i, /\bwork (authorization|eligibility|permit)\b/i] },
  { intent: 'email', priority: 7, patterns: [/\bemail\b/i, /\be-mail\b/i] },
  { intent: 'phone', priority: 7, patterns: [/\bphone\b/i, /\btelephone\b/i, /\bmobile\b.*\bnumber\b/i, /\bcontact number\b/i] },
  { intent: 'linkedin', priority: 7, patterns: [/\blinkedin\b/i] },
  { intent: 'github', priority: 7, patterns: [/\bgithub\b/i] },
  { intent: 'portfolio', priority: 7, patterns: [/\bportfolio\b/i, /\bpersonal website\b/i] },
  { intent: 'first_name', priority: 6, patterns: [/\bfirst name\b/i, /\bgiven name\b/i, /\bforename\b/i] },
  { intent: 'last_name', priority: 6, patterns: [/\blast name\b/i, /\bsurname\b/i, /\bfamily name\b/i] },
  { intent: 'full_name', priority: 6, patterns: [/\bfull name\b/i, /\blegal name\b/i, /\bname\b(?!.*\b(first|last|company|school|university)\b)/i] },
  { intent: 'city', priority: 5, patterns: [/\bcity\b/i, /\btown\b/i] },
  { intent: 'region', priority: 5, patterns: [/\b(state|province|region)\b/i] },
  { intent: 'country', priority: 5, patterns: [/\bcountry\b/i] },
  { intent: 'address', priority: 5, patterns: [/\baddress\b/i, /\bstreet\b/i, /\bpostal code\b/i, /\bzip code\b/i] },
  { intent: 'current_employer', priority: 4, patterns: [/\bcurrent (employer|company)\b/i, /\bmost recent (employer|company)\b/i] },
  { intent: 'current_title', priority: 4, patterns: [/\bcurrent (title|role|position)\b/i, /\bmost recent (title|role)\b/i] },
  { intent: 'education_degree', priority: 3, patterns: [/\b(degree|highest level of education|educational attainment)\b/i, /\bhighest degree\b/i] },
  { intent: 'education_institution', priority: 3, patterns: [/\b(university|college|school|institution).*\bname\b/i, /\battended\b/i] },
  { intent: 'education_major', priority: 3, patterns: [/\bmajor\b/i, /\bfield of study\b/i] },
  { intent: 'graduation_year', priority: 3, patterns: [/\bgraduation (year|date)\b/i, /\byear.*graduat/i] },
  { intent: 'skills', priority: 2, patterns: [/\bskills?\b/i, /\btechnologies?\b/i, /\bproficienc/i, /\btechnical (skills|expertise)\b/i] },
  { intent: 'years_experience', priority: 2, patterns: [/\byears of (experience|work)\b/i, /\b(total|professional|relevant).*years\b/i] },
  { intent: 'salary', priority: 2, patterns: [/\b(salary|compensation|pay)\b.*\b(expect|desire|target|require)\b/i] },
  { intent: 'notice_period', priority: 2, patterns: [/\bnotice period\b/i, /\bavailable (to start|from)\b/i, /\bstart date\b/i, /how soon/i, /when can you (join|start|begin)/i, /when (are you|could you|can you) (available|join)/i, /available to (join|start)/i, /joining date/i, /soon can you/i] },
  { intent: 'relocation', priority: 2, patterns: [/\b(willing|open) to relocat/i, /\brelocation\b/i] },
  { intent: 'remote_preference', priority: 2, patterns: [/\bremote\b/i, /\b(wfh|onsite|on-site|hybrid)\b/i] },
  { intent: 'narrative', priority: 1, patterns: [/\b(tell us about yourself|cover letter|why do you want to work|why are you interested|why should we hire|what makes you|describe a (time|project|situation|challenge)|discuss your|how (do|does|would) your|explain (how|why|your)|what (experience|skills|qualities|strengths) do you bring|what are your (strengths|goals|career goals)|additional (information|comments|details)|anything (else|additional).?(we should know|you.?d like|to add|to share)|is there anything else|what else should we know|relevant (experience|skills|background)|why this (role|position|company)|in \\d+ words|cover note|candidate statement|your (message|note) to the)/i] },
];

export function classifyFieldIntent(field: FormFieldDescriptor): FieldIntent {
  const searchText = [field.label, field.name, field.id, field.nearbyHeading, field.autocomplete].filter(Boolean).join(' | ');
  const ac = (field.autocomplete || '').toLowerCase();
  if (ac.includes('given-name') || ac.includes('first-name')) return 'first_name';
  if (ac.includes('family-name') || ac.includes('last-name')) return 'last_name';
  if (ac.includes('name') && !ac.includes('user')) return 'full_name';
  if (ac.includes('email')) return 'email';
  if (ac.includes('tel')) return 'phone';
  if (ac.includes('organization')) return 'current_employer';
  if (ac.includes('organization-title') || ac.includes('job-title')) return 'current_title';
  if (ac.includes('address')) return 'address';
  if (ac.includes('country')) return 'country';
  const sorted = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) { if (rule.patterns.some((p) => p.test(searchText))) return rule.intent; }
  return 'unknown';
}