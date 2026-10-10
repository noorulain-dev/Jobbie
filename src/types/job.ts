import { z } from 'zod';

export const RemoteStatusEnum = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type RemoteStatus = z.infer<typeof RemoteStatusEnum>;

export const EmploymentTypeEnum = z.enum([
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
  'unknown',
]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const SeniorityLevelEnum = z.enum([
  'intern',
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'staff',
  'principal',
  'executive',
  'unknown',
]);
export type SeniorityLevel = z.infer<typeof SeniorityLevelEnum>;

export const ApplicationMethodEnum = z.enum([
  'easy-apply',
  'ats-redirect',
  'email',
  'company-form',
  'unknown',
]);
export type ApplicationMethod = z.infer<typeof ApplicationMethodEnum>;

export const JobSourceTypeEnum = z.enum([
  'linkedin',
  'indeed',
  'wellfound',
  'greenhouse',
  'lever',
  'workday',
  'ashby',
  'company-page',
  'generic',
]);
export type JobSourceType = z.infer<typeof JobSourceTypeEnum>;

/**
 * Normalized Location structure preserving raw text alongside canonical tokens.
 */
export const JobLocationInfoSchema = z.object({
  rawLocationText: z.string().default(''),
  city: z.string().nullable().default(null),
  region: z.string().nullable().default(null), // State/Province
  country: z.string().nullable().default(null),
  remoteStatus: RemoteStatusEnum.default('unknown'),
  locations: z.array(z.string()).default([]), // Multiple listed sites if applicable
  normalizedLocation: z.string().default(''), // Consistent string for matching
});
export type JobLocationInfo = z.infer<typeof JobLocationInfoSchema>;

/**
 * Normalized Compensation structure preserving original text and parsed numbers.
 */
export const JobCompensationInfoSchema = z.object({
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  salaryCurrency: z.string().default('USD'),
  salaryPeriod: z.enum(['yearly', 'monthly', 'hourly']).default('yearly'),
  salaryText: z.string().nullable().default(null), // Original raw compensation text
});
export type JobCompensationInfo = z.infer<typeof JobCompensationInfoSchema>;

/**
 * Core normalized Job schema.
 */
export const JobSchema = z.object({
  // CORE
  id: z.string().uuid(),
  source: JobSourceTypeEnum,
  sourceJobId: z.string().nullable().default(null),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().nullable().default(null),
  applicationUrl: z.string().url().nullable().default(null),

  // COMPANY
  companyName: z.string().min(1, 'Company name is required').trim(),
  companyUrl: z.string().url().nullable().default(null),
  normalizedCompany: z.string().default(''),

  // ROLE
  title: z.string().min(1, 'Job title is required').trim(),
  normalizedTitle: z.string().trim().default(''),
  department: z.string().nullable().default(null),
  seniority: SeniorityLevelEnum.default('unknown'),

  // LOCATION
  remoteStatus: RemoteStatusEnum.default('unknown'),
  locations: z.array(z.string()).default([]),
  country: z.string().nullable().default(null),
  region: z.string().nullable().default(null), // State/Province
  city: z.string().nullable().default(null),
  location: JobLocationInfoSchema.optional(),

  // COMPENSATION
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  salaryCurrency: z.string().default('USD'),
  salaryPeriod: z.enum(['yearly', 'monthly', 'hourly']).default('yearly'),
  salaryText: z.string().nullable().default(null),
  compensation: JobCompensationInfoSchema.optional(),

  // EMPLOYMENT
  employmentType: EmploymentTypeEnum.default('unknown'),

  // DESCRIPTION
  description: z.string().min(1, 'Job description cannot be empty'),
  responsibilities: z.array(z.string()).default([]),
  requiredQualifications: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),

  // REQUIREMENTS
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  yearsExperience: z.number().nullable().default(null),
  educationRequirements: z.string().nullable().default(null),
  workAuthorization: z.string().nullable().default(null),
  sponsorship: z.string().nullable().default(null),

  // APPLICATION
  applicationMethod: ApplicationMethodEnum.default('unknown'),

  // TIMING
  postedAt: z.string().nullable().default(null),
  closingAt: z.string().nullable().default(null),
  discoveredAt: z.string(),
  updatedAt: z.string(),

  // METADATA
  parserVersion: z.string().default('1.0.0'),
  parserConfidence: z.number().min(0).max(1).default(1.0),
  extractionWarnings: z.array(z.string()).default([]),
  rawMetadata: z.record(z.string(), z.unknown()).default({}),

  // DEDUPLICATION
  dedupHash: z.string().default(''),
  dedupClusterId: z.string().nullable().default(null),
});
export type Job = z.infer<typeof JobSchema>;
