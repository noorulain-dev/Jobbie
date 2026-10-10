import { z } from 'zod';

export const CareerProfileTrackEnum = z.enum([
  'software-engineering',
  'applied-ai',
  'revenue-tech',
  'customer-success',
  'custom',
]);
export type CareerProfileTrack = z.infer<typeof CareerProfileTrackEnum>;

/**
 * Job Description input for Career Profile selection.
 */
export const JobDescriptionInputSchema = z.object({
  jobTitle: z.string().min(1, 'Job title is required').trim(),
  company: z.string().default(''),
  jobDescription: z.string().default(''),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  seniority: z.string().default(''),
  industry: z.string().default(''),
  locationRemoteRequirements: z.string().default(''),
});
export type JobDescriptionInput = z.infer<typeof JobDescriptionInputSchema>;

/**
 * Result of automatic Career Profile selection.
 */
export const CareerProfileSelectionResultSchema = z.object({
  selectedProfileId: z.string(),
  selectedProfileTrack: CareerProfileTrackEnum,
  selectedProfileName: z.string(),
  confidenceScore: z.number().min(0).max(1),
  secondaryProfile: z
    .object({
      id: z.string(),
      track: CareerProfileTrackEnum,
      name: z.string(),
      confidenceScore: z.number().min(0).max(1),
    })
    .optional(),
  isHybridStrategy: z.boolean().default(false),
  hybridStrategyNotes: z.string().optional(),
  reasoning: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  potentialConcerns: z.array(z.string()),
});
export type CareerProfileSelectionResult = z.infer<typeof CareerProfileSelectionResultSchema>;

/**
 * CareerProfile represents a declarative configuration and lens on top of the
 * canonical MasterProfile without duplicating or modifying canonical facts.
 */
export const CareerProfileSchema = z.object({
  id: z.string(),
  track: CareerProfileTrackEnum,
  name: z.string().min(1, 'Profile name is required').trim(),
  description: z.string().min(1, 'Profile description is required').trim(),
  headline: z.string().min(1, 'Professional headline is required').trim(),
  narrativeSummary: z.string().min(1, 'Narrative summary is required').trim(),

  // Job targeting preferences
  targetJobTitles: z.array(z.string()).min(1, 'At least one target job title is required'),
  excludedJobTitles: z.array(z.string()).default([]),
  preferredIndustries: z.array(z.string()).default([]),

  // Skill prioritization (referencing Master Profile skills)
  primarySkillIds: z.array(z.string()).default([]),
  secondarySkillIds: z.array(z.string()).default([]),
  deemphasizedSkillIds: z.array(z.string()).default([]),

  // Entity prioritization (referencing Master Profile entities)
  priorityExperienceIds: z.array(z.string()).default([]),
  highlightedProjectIds: z.array(z.string()).default([]),
  preferredAccomplishments: z.array(z.string()).default([]),
  preferredKeywords: z.array(z.string()).default([]),

  // Compensation, Location & Seniority preferences
  salaryPreferences: z.object({
    minimum: z.string().optional(),
    target: z.string().optional(),
    currency: z.string().default('USD'),
    period: z.enum(['yearly', 'monthly', 'hourly']).default('yearly'),
  }).default({ currency: 'USD', period: 'yearly' }),
  locationPreferences: z.object({
    allowedCountries: z.array(z.string()).default(['Canada', 'United States']),
    preferredCities: z.array(z.string()).default([]),
    willingToRelocate: z.boolean().default(false),
  }).default({ allowedCountries: ['Canada', 'United States'], preferredCities: [], willingToRelocate: false }),
  remotePreferences: z.object({
    remoteOnly: z.boolean().default(false),
    hybridAllowed: z.boolean().default(true),
    onSiteAllowed: z.boolean().default(false),
    allowedTimezones: z.array(z.string()).default(['EST', 'PST', 'CST', 'MST', 'UTC-5', 'UTC-8']),
  }).default({ remoteOnly: false, hybridAllowed: true, onSiteAllowed: false, allowedTimezones: ['EST', 'PST', 'CST', 'MST', 'UTC-5', 'UTC-8'] }),
  seniorityPreferences: z.object({
    targetLevels: z.array(z.enum(['Junior', 'Mid-Level', 'Senior', 'Lead', 'Staff', 'Principal'])).default(['Mid-Level', 'Senior']),
    yearsExperienceClaim: z.string().default('2+'),
  }).default({ targetLevels: ['Mid-Level', 'Senior'], yearsExperienceClaim: '2+' }),

  // Generation Instructions & Strategy Rules
  customResumeInstructions: z.string().default(''),
  customCoverLetterInstructions: z.string().default(''),
  applicationStrategyRules: z.array(z.string()).default([]),

  // Prohibited assertions for this track
  prohibitedClaims: z.array(z.string()).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CareerProfile = z.infer<typeof CareerProfileSchema>;
