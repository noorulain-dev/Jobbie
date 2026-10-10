import { z } from 'zod';
import {
  ProvenanceMetadataSchema,
  SkillCategoryEnum,
  SkillStatusEnum,
  SkillEvidenceSchema,
} from './provenance.js';

export const SkillProficiencyEnum = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);
export type SkillProficiency = z.infer<typeof SkillProficiencyEnum>;

/**
 * SkillRegistryEntry represents an enhanced, canonical skill entity in the Skill Intelligence layer.
 */
export const SkillRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  canonicalName: z.string().min(1).trim(),
  aliases: z.array(z.string()).default([]),
  category: SkillCategoryEnum,
  proficiency: SkillProficiencyEnum.optional(),
  status: SkillStatusEnum,
  evidence: z.array(SkillEvidenceSchema).default([]),
  lastVerifiedAt: z.string().optional(),
  notes: z.string().optional(),
  claimability: z.object({
    canClaimOnResume: z.boolean(),
    canClaimOnScreening: z.boolean(),
    reason: z.string().optional(),
  }),
  source: z.string().describe('Origin of the skill entry: user-entered, seed, rule-engine, or openrouter'),
  provenance: ProvenanceMetadataSchema,
});
export type SkillRegistryEntry = z.infer<typeof SkillRegistryEntrySchema>;

/**
 * SkillInferenceRule represents a directional recommendation / expansion relationship.
 * e.g., source: "React" -> target: "HTML", "CSS", "Frontend Fundamentals"
 */
export const SkillInferenceRuleSchema = z.object({
  id: z.string(),
  sourceSkillCanonical: z.string(),
  inferredSkillCanonical: z.string(),
  category: SkillCategoryEnum,
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedAliases: z.array(z.string()).default([]),
});
export type SkillInferenceRule = z.infer<typeof SkillInferenceRuleSchema>;

/**
 * SkillSuggestion represents a discovered skill candidate awaiting one-time user approval.
 */
export const SkillSuggestionSchema = z.object({
  id: z.string().uuid(),
  canonicalName: z.string(),
  aliases: z.array(z.string()).default([]),
  category: SkillCategoryEnum,
  rationale: z.string(),
  source: z.enum(['deterministic_rule', 'semantic_openrouter']),
  derivedFromSkill: z.string().optional(),
  evidence: z.array(SkillEvidenceSchema).default([]),
  status: z.literal('INFERRED_KNOWN'),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  decision: z.enum(['pending', 'approved', 'rejected', 'marked_learning_target', 'prohibited']).default('pending'),
});
export type SkillSuggestion = z.infer<typeof SkillSuggestionSchema>;
