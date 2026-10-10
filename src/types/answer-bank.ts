import { z } from 'zod';

export const QuestionCategoryEnum = z.enum([
  'work_authorization',
  'sponsorship',
  'notice_period',
  'salary',
  'education',
  'experience_years',
  'location',
  'work_preference',
  'contact',
  'links',
  'skills',
  'general',
]);
export type QuestionCategory = z.infer<typeof QuestionCategoryEnum>;

export const QuestionResponseTypeEnum = z.enum([
  'yes_no',
  'dropdown',
  'free_text',
  'numeric',
  'date',
]);
export type QuestionResponseType = z.infer<typeof QuestionResponseTypeEnum>;

export const AnswerConfidenceEnum = z.enum([
  'high',
  'medium',
  'low',
  'unknown',
]);
export type AnswerConfidence = z.infer<typeof AnswerConfidenceEnum>;

/**
 * SavedAnswerItem represents a saved answer in the Bank, either
 * derived from canonical facts or explicitly provided/confirmed by the user.
 */
export const SavedAnswerItemSchema = z.object({
  id: z.string().uuid(),
  questionPattern: z.string().min(1).describe('Normalized question pattern or exact string'),
  aliases: z.array(z.string()).default([]),
  category: QuestionCategoryEnum,
  responseType: QuestionResponseTypeEnum,
  canonicalAnswer: z.string().describe('The answer string or serializable representation'),
  parameterizedTemplate: z.string().optional().describe('e.g. {{yearsExperience}} years of full-stack engineering'),
  canonicalFactPath: z.string().optional().describe('JSON path on MasterProfile / CareerProfile'),
  allowedDropdownOptions: z.array(z.string()).optional(),
  conditionTrigger: z.object({
    dependsOnQuestion: z.string(),
    expectedValue: z.string(),
  }).optional().describe('For conditional follow-up questions'),
  safeToAutoSubmit: z.boolean().default(false),
  requiresHumanConfirmation: z.boolean().default(true),
  source: z.string().describe('canonical_fact | user_confirmed | openrouter_inferred'),
  usageCount: z.number().int().nonnegative().default(0),
  lastUsedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedAnswerItem = z.infer<typeof SavedAnswerItemSchema>;

/**
 * QueryAnswerResult represents the outcome of querying the Answer Bank
 */
export const QueryAnswerResultSchema = z.object({
  status: z.enum(['RESOLVED', 'UNKNOWN_NEEDS_REVIEW']),
  question: z.string(),
  matchedPattern: z.string().optional(),
  category: QuestionCategoryEnum,
  responseType: QuestionResponseTypeEnum,
  answer: z.string().nullable(),
  source: z.string(),
  confidence: AnswerConfidenceEnum,
  safeToAutoSubmit: z.boolean(),
  requiresHumanConfirmation: z.boolean(),
  notes: z.string().optional(),
  conditionalFollowUps: z.array(z.object({
    question: z.string(),
    triggerValue: z.string(),
  })).optional(),
});
export type QueryAnswerResult = z.infer<typeof QueryAnswerResultSchema>;
