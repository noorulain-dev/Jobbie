import { z } from 'zod';
import {
  ProvenanceMetadataSchema,
  FactConflictSchema,
  SkillCategoryEnum,
  SkillStatusEnum,
  SkillEvidenceSchema,
} from './provenance.js';

// Deterministic Validation Regular Expressions
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9\s().-]{7,25}$/;
const URL_REGEX = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/;

// ==========================================
// 1. PERSONAL INFORMATION
// ==========================================
export const PersonalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().regex(EMAIL_REGEX, 'Invalid email format').trim(),
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone number format').trim(),
  city: z.string().min(1, 'City is required').trim(),
  provinceState: z.string().min(1, 'Province or state is required').trim(),
  country: z.string().min(1, 'Country is required').trim(),
  linkedin: z.string().regex(URL_REGEX, 'Invalid LinkedIn URL').trim(),
  github: z.string().regex(URL_REGEX, 'Invalid GitHub URL').trim(),
  portfolio: z.string().regex(URL_REGEX, 'Invalid portfolio URL').trim(),
  provenance: ProvenanceMetadataSchema,
});
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;

// ==========================================
// 2. WORK SCREENING
// ==========================================
export const WorkScreeningSchema = z.object({
  workAuthorization: z.string().min(1, 'Work authorization status is required').trim(),
  sponsorshipRequired: z.string().min(1, 'Sponsorship status is required').trim(),
  targetSalary: z.string().min(1, 'Target salary is required').trim(),
  noticePeriod: z.string().min(1, 'Notice period is required').trim(),
  yearsExperience: z.string().min(1, 'Years of experience is required').trim(),
  remoteEligibility: z.string().min(1, 'Remote eligibility is required').trim(),
  securityClearance: z.string().optional(),
  willingToRelocate: z.boolean().optional(),
  additionalScreeningFacts: z.record(z.string(), z.string()).optional(),
  provenance: ProvenanceMetadataSchema,
});
export type WorkScreening = z.infer<typeof WorkScreeningSchema>;

// ==========================================
// 3. EDUCATION
// ==========================================
export const EducationItemSchema = z.object({
  id: z.string().uuid(),
  degree: z.string().min(1, 'Degree is required').trim(),
  major: z.string().optional().default(''),
  institution: z.string().min(1, 'Institution is required').trim(),
  location: z.string().optional().default(''),
  status: z.enum(['Completed', 'In Progress', 'Incomplete']).default('Completed'),
  gpa: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  coursework: z.array(z.string()).default([]),
  provenance: ProvenanceMetadataSchema,
});
export type EducationItem = z.infer<typeof EducationItemSchema>;

// ==========================================
// 4. EXPERIENCE
// ==========================================
export const ExperienceBulletSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1, 'Bullet text cannot be empty').trim(),
  technologies: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  measurableAchievements: z.array(z.string()).default([]),
  provenance: ProvenanceMetadataSchema,
});
export type ExperienceBullet = z.infer<typeof ExperienceBulletSchema>;

export const ExperienceItemSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1, 'Company is required').trim(),
  title: z.string().min(1, 'Title is required').trim(),
  normalizedRole: z.string().min(1, 'Normalized role is required').trim(),
  startDate: z.string().min(1, 'Start date is required').trim(),
  endDate: z.string().min(1, 'End date or Present is required').trim(),
  location: z.string().min(1, 'Location is required').trim(),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship', 'Teaching', 'Volunteer']).default('Full-time'),
  bulletPoints: z.array(ExperienceBulletSchema).min(1, 'At least one bullet point is required'),
  technologies: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  measurableAchievements: z.array(z.string()).default([]),
  provenance: ProvenanceMetadataSchema,
});
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

// ==========================================
// 5. PROJECTS
// ==========================================
export const ProjectItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').trim(),
  url: z.string().optional().default(''),
  dates: z.string().optional().default(''),
  description: z.string().min(1, 'Description is required').trim(),
  technologies: z.array(z.string()).default([]),
  domain: z.string().optional().default(''),
  measurableOutcomes: z.array(z.string()).default([]),
  provenance: ProvenanceMetadataSchema,
});
export type ProjectItem = z.infer<typeof ProjectItemSchema>;

// ==========================================
// 6. SKILLS
// ==========================================
export const SkillItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Skill name is required').trim(),
  category: SkillCategoryEnum,
  status: SkillStatusEnum,
  aliases: z.array(z.string()).default([]).describe('Synonyms/variations (e.g. React.js, ReactJS)'),
  evidence: z.array(SkillEvidenceSchema).default([]).describe('Work experience or project evidence links'),
  yearsExperience: z.number().nonnegative().optional(),
  lastUsedYear: z.number().int().optional(),
  provenance: ProvenanceMetadataSchema,
});
export type SkillItem = z.infer<typeof SkillItemSchema>;

// ==========================================
// 7. CERTIFICATIONS
// ==========================================
export const CertificationItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Certification title is required').trim(),
  issuer: z.string().optional().default(''),
  year: z.string().min(1, 'Year is required').trim(),
  credentialUrl: z.string().optional(),
  provenance: ProvenanceMetadataSchema,
});
export type CertificationItem = z.infer<typeof CertificationItemSchema>;

// ==========================================
// 8. AWARDS
// ==========================================
export const AwardItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Award title is required').trim(),
  year: z.string().optional(),
  issuer: z.string().optional(),
  provenance: ProvenanceMetadataSchema,
});
export type AwardItem = z.infer<typeof AwardItemSchema>;

// ==========================================
// 9. LEADERSHIP & VOLUNTEERING
// ==========================================
export const LeadershipVolunteeringItemSchema = z.object({
  id: z.string().uuid(),
  role: z.string().min(1, 'Role or organization is required').trim(),
  organization: z.string().optional().default(''),
  dates: z.string().optional().default(''),
  description: z.string().optional().default(''),
  provenance: ProvenanceMetadataSchema,
});
export type LeadershipVolunteeringItem = z.infer<typeof LeadershipVolunteeringItemSchema>;

// ==========================================
// 10. LANGUAGES SPOKEN
// ==========================================
export const LanguageSpokenItemSchema = z.object({
  id: z.string().uuid(),
  language: z.string().min(1, 'Language name is required').trim(),
  proficiency: z.enum(['Native', 'Fluent', 'Proficient', 'Intermediate', 'Basic']),
  provenance: ProvenanceMetadataSchema,
});
export type LanguageSpokenItem = z.infer<typeof LanguageSpokenItemSchema>;

// ==========================================
// CANONICAL MASTER PROFILE
// ==========================================
export const MasterProfileSchema = z.object({
  schemaVersion: z.literal('1.0.0').default('1.0.0'),
  id: z.string().uuid(),
  lastUpdated: z.string(),
  personal: PersonalInfoSchema,
  screening: WorkScreeningSchema,
  education: z.array(EducationItemSchema).default([]),
  experience: z.array(ExperienceItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  skills: z.array(SkillItemSchema).default([]),
  certifications: z.array(CertificationItemSchema).default([]),
  awards: z.array(AwardItemSchema).default([]),
  leadership: z.array(LeadershipVolunteeringItemSchema).default([]),
  volunteering: z.array(LeadershipVolunteeringItemSchema).default([]),
  languages: z.array(LanguageSpokenItemSchema).default([]),
  conflicts: z.array(FactConflictSchema).default([]),
});
export type MasterProfile = z.infer<typeof MasterProfileSchema>;
