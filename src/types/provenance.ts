import { z } from 'zod';

/**
 * FactProvenance defines the authentic origin and reliability level of any profile fact.
 * - user-entered: Supplied directly by the user (e.g. profile-seed.json or user UI form).
 * - document-derived: Extracted from an authentic uploaded resume/CV document.
 * - inferred-but-user-approved: Suggested by AI or heuristic and explicitly approved by the user.
 * - learning-target: Subject/technology currently being learned; NEVER claimed as present work experience.
 * - prohibited-from-claiming: Explicitly prohibited by the user from ever appearing in any resume, application, or answer.
 * - verified: Backed by third-party verification, transcripts, or official credentials.
 */
export const FactProvenanceEnum = z.enum([
  'user-entered',
  'document-derived',
  'inferred-but-user-approved',
  'learning-target',
  'prohibited-from-claiming',
  'verified',
]);
export type FactProvenance = z.infer<typeof FactProvenanceEnum>;
/**
 * High-level provenance origin categories for career brain fact sources:
 * - USER_ENTERED: Directly entered by user in UI or seed.
 * - RESUME_IMPORT: Ingested or extracted from an authentic resume / CV document.
 * - PROFILE_IMPORT: Imported from an external profile backup or JSON dump.
 * - USER_APPROVED_INFERENCE: Inferred by AI / rule engine and explicitly confirmed by user.
 * - SYSTEM_GENERATED_SUGGESTION: Suggested by model / system; MUST NEVER appear as verified facts without explicit user approval.
 */
export const ProvenanceSourceEnum = z.enum([
  'USER_ENTERED',
  'RESUME_IMPORT',
  'PROFILE_IMPORT',
  'USER_APPROVED_INFERENCE',
  'SYSTEM_GENERATED_SUGGESTION',
]);
export type ProvenanceSource = z.infer<typeof ProvenanceSourceEnum>;

export const ChangeActorEnum = z.enum(['user', 'model', 'system']);
export type ChangeActor = z.infer<typeof ChangeActorEnum>;

export const ProfileFieldDiffSchema = z.object({
  fieldPath: z.string(),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  action: z.enum(['created', 'updated', 'deleted']),
});
export type ProfileFieldDiff = z.infer<typeof ProfileFieldDiffSchema>;

export const ProfileVersionEntrySchema = z.object({
  id: z.number().int().positive().optional(),
  profileId: z.string(),
  versionNumber: z.number().int().positive(),
  timestamp: z.string(),
  changeSource: ProvenanceSourceEnum,
  actor: ChangeActorEnum,
  changeReason: z.string(),
  fieldsChanged: z.array(ProfileFieldDiffSchema).default([]),
  snapshotJson: z.string(),
});
export type ProfileVersionEntry = z.infer<typeof ProfileVersionEntrySchema>;


/**
 * SkillStatusEnum:
 * - EXPLICIT_KNOWN: Direct user-confirmed, demonstrable knowledge actively practiced.
 * - INFERRED_KNOWN: Safely inferrable from existing proven experience (e.g., React implies HTML/CSS/DOM).
 * - USER_APPROVED_KNOWN: Inferred by AI/system and explicitly approved by the user.
 * - LEARNING_TARGET: Goals / actively studying; strictly prohibited from claiming as active experience.
 * - DO_NOT_CLAIM: Hard blacklist; Jobby must NEVER assert or claim this skill under any circumstance.
 */
export const SkillStatusEnum = z.enum([
  'EXPLICIT_KNOWN',
  'INFERRED_KNOWN',
  'USER_APPROVED_KNOWN',
  'LEARNING_TARGET',
  'DO_NOT_CLAIM',
]);
export type SkillStatus = z.infer<typeof SkillStatusEnum>;

/**
 * SkillCategoryEnum:
 * Grouping of skills across engineering domains.
 */
export const SkillCategoryEnum = z.enum([
  'programming_languages',
  'frameworks_libraries',
  'cloud_infrastructure',
  'databases',
  'ai_ml',
  'queues_async',
  'email_infrastructure',
  'crm_marketing',
  'billing_auth',
  'developer_tools',
  'hardware_iot',
  'methodologies',
  'other',
]);
export type SkillCategory = z.infer<typeof SkillCategoryEnum>;

/**
 * ProvenanceMetadataSchema attaches audit trail, evidence pointers, and conflict states to any fact node.
 */
export const ProvenanceMetadataSchema = z.object({
  provenance: FactProvenanceEnum,
  sourceRef: z.string().describe('File path, document id, or input origin identifier'),
  sourceExcerpt: z.string().optional().describe('Exact quote or excerpt from the document or raw input'),
  verifiedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  approvedByUser: z.boolean().default(false),
  notes: z.string().optional(),
  isConflictPending: z.boolean().default(false).optional(),
});
export type ProvenanceMetadata = z.infer<typeof ProvenanceMetadataSchema>;

/**
 * SkillEvidenceSchema links a skill to verified projects or work experience bullets.
 */
export const SkillEvidenceSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['experience', 'project', 'education', 'certification']),
  referenceId: z.string().describe('ID of the experience, project, education or certification item'),
  description: z.string().describe('Contextual note or quote demonstrating usage'),
});
export type SkillEvidence = z.infer<typeof SkillEvidenceSchema>;

/**
 * FactConflictSchema preserves discrepancies between user-entered inputs and document-derived inputs
 * without silently overwriting either.
 */
export const FactConflictSchema = z.object({
  id: z.string().uuid(),
  factPath: z.string().describe('JSON path / dot notation to the conflicting field'),
  values: z.array(
    z.object({
      source: FactProvenanceEnum,
      sourceRef: z.string(),
      value: z.unknown(),
    })
  ),
  detectedAt: z.string(),
  resolved: z.boolean().default(false),
  resolvedValue: z.unknown().optional(),
  resolvedBy: z.enum(['user']).optional(),
  resolvedAt: z.string().optional(),
  notes: z.string().optional(),
});
export type FactConflict = z.infer<typeof FactConflictSchema>;
