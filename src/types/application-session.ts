import { z } from 'zod';
import { RemoteStatusEnum, EmploymentTypeEnum, SeniorityLevelEnum } from './job.js';

export const ApplicationSessionStatusEnum = z.enum([
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);
export type ApplicationSessionStatus = z.infer<typeof ApplicationSessionStatusEnum>;

/**
 * Valid state transitions for ApplicationSessionStatus:
 * ACTIVE -> PAUSED, COMPLETED, CANCELLED
 * PAUSED -> ACTIVE, COMPLETED, CANCELLED
 * COMPLETED -> terminal (cannot transition)
 * CANCELLED -> terminal (cannot transition)
 */
export const VALID_SESSION_TRANSITIONS: Record<ApplicationSessionStatus, ApplicationSessionStatus[]> = {
  ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidSessionTransition(
  currentStatus: ApplicationSessionStatus,
  targetStatus: ApplicationSessionStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_SESSION_TRANSITIONS[currentStatus];
  return allowed.includes(targetStatus);
}

export const PageTypeEnum = z.enum([
  'JOB_POSTING',
  'APPLICATION_PAGE',
  'OTHER',
]);
export type PageType = z.infer<typeof PageTypeEnum>;

export const AssociatedPageSchema = z.object({
  url: z.string().url(),
  pageType: PageTypeEnum,
  attachedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  title: z.string().optional(),
});
export type AssociatedPage = z.infer<typeof AssociatedPageSchema>;

/**
 * Preserved snapshot of job information when session was created.
 * Reuses existing Job entity fields without inventing a duplicate entity.
 */
export const JobContextSnapshotSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  roleTitle: z.string().min(1, 'Role title is required'),
  originalSourceUrl: z.string().url(),
  companyUrl: z.string().url().nullable().default(null),
  location: z.string().nullable().default(null),
  remoteStatus: RemoteStatusEnum.default('unknown'),
  description: z.string().default(''),
  responsibilities: z.array(z.string()).default([]),
  requiredQualifications: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  salaryCurrency: z.string().nullable().default(null),
  salaryPeriod: z.enum(['yearly', 'monthly', 'hourly']).nullable().default(null),
  salaryText: z.string().nullable().default(null),
  employmentType: EmploymentTypeEnum.default('unknown'),
  seniority: SeniorityLevelEnum.default('unknown'),
  extractionTimestamp: z.string().default(''),
  extractionConfidence: z.number().min(0).max(1).nullable().default(null),
  extractionWarnings: z.array(z.string()).default([]),
  source: z.string().nullable().default(null),
  parserVersion: z.string().nullable().default(null),
});
export type JobContextSnapshot = z.infer<typeof JobContextSnapshotSchema>;

/**
 * Optional user corrections that override snapshot fields for document generation
 * while preserving the original captured data untouched.
 */
export const JobContextOverridesSchema = z.object({
  companyName: z.string().optional(),
  roleTitle: z.string().optional(),
  companyUrl: z.string().url().optional(),
  location: z.string().optional(),
  remoteStatus: RemoteStatusEnum.optional(),
  description: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  requiredQualifications: z.array(z.string()).optional(),
  preferredQualifications: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  salaryPeriod: z.enum(['yearly', 'monthly', 'hourly']).optional(),
  salaryText: z.string().optional(),
  employmentType: EmploymentTypeEnum.optional(),
  seniority: SeniorityLevelEnum.optional(),
  notes: z.string().optional(),
  /** Phase 7: Tracker fields — stored in overrides so they persist with the session */
  trackerStatus: z.string().optional().describe('Tracker status: DRAFT|APPLIED|INTERVIEWING|OFFER|REJECTED|WITHDRAWN|ARCHIVED'),
  dateApplied: z.string().optional().describe('Explicit date user submitted the application'),
  trackerNotes: z.string().optional().describe('Application-specific notes'),
});
export type JobContextOverrides = z.infer<typeof JobContextOverridesSchema>;

/**
 * ApplicationSession entity representing an in-flight or completed application workflow.
 */
export const ApplicationSessionSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid().nullable().default(null), // Nullable if job context is supplied manually
  status: ApplicationSessionStatusEnum.default('ACTIVE'),
  sourceJobUrl: z.string().url(),
  applicationUrl: z.string().url().nullable().default(null),
  associatedPages: z.array(AssociatedPageSchema).default([]),
  jobContextSnapshot: JobContextSnapshotSchema,
  jobContextOverrides: JobContextOverridesSchema.nullable().default(null),
  selectedCareerProfileId: z.string().nullable().default(null),
  selectedCareerProfileVersion: z.string().nullable().default(null),
  careerProfileSelectionSource: z.enum(['auto', 'manual']).nullable().default(null),
  masterProfileVersion: z.number().int().positive().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string(),
});
export type ApplicationSession = z.infer<typeof ApplicationSessionSchema>;
