import { z } from 'zod';
import { AnswerConfidenceEnum } from './answer-bank.js';
import { SkillStatusEnum } from './provenance.js';

/**
 * Phase 5 — Intelligent Page Filler Types
 *
 * These types model a single user-triggered "fill" attempt on an application page.
 * The page-fill run is transient and in-memory; it is NOT persisted to the database.
 * Browser DOM element references stay in the content script and are never serialized.
 */

// ── Field Result State ──────────────────────────────────────────
export const FieldFillStatusEnum = z.enum([
  'READY_TO_FILL',       // Field identified, answer available, waiting for user action
  'FILLED',              // Successfully written into the DOM
  'GENERATED_REVIEW',    // Answer generated but requires human review before filling
  'NEEDS_USER_INPUT',    // No answer available; user must provide manually
  'SKIPPED',             // Intentionally skipped by user or policy
  'UNSUPPORTED',         // Control type not supported (e.g. file upload, CAPTCHA)
  'FAILED',              // Answer was available but DOM write failed
]);
export type FieldFillStatus = z.infer<typeof FieldFillStatusEnum>;

// ── Answer Provenance (where did this answer come from) ─────────
export const AnswerOriginEnum = z.enum([
  'master_profile_fact',         // Direct fact from MasterProfile (e.g. firstName, email)
  'user_approved_skill',         // Skill with status EXPLICIT_KNOWN or USER_APPROVED_KNOWN
  'answer_bank_entry',           // Saved/approved Application Answer Bank entry
  'generated_approved_evidence', // Generated from approved evidence/provenance
  'inferred_needs_review',       // Inferred but awaiting user confirmation
  'unsupported_source',          // No sufficiently supported source found
]);
export type AnswerOrigin = z.infer<typeof AnswerOriginEnum>;

// ── Field Descriptor (sent from content script → popup → backend) ─
export const FormFieldDescriptorSchema = z.object({
  runtimeId: z.string(),                    // Temporary id assigned in content script scope
  label: z.string(),                        // Visible label or aria-label
  controlType: z.enum([                     // HTML input type or custom classification
    'text', 'email', 'tel', 'number', 'date',
    'textarea', 'select', 'radio', 'checkbox',
    'file', 'hidden', 'unknown',
  ]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  existingValue: z.string().optional(),     // Value already present in the field
  options: z.array(z.object({               // For select/radio/checkbox
    label: z.string(),
    value: z.string(),
  })).optional(),
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  name: z.string().optional(),              // Original HTML name attribute
  id: z.string().optional(),                // Original HTML id attribute
});
export type FormFieldDescriptor = z.infer<typeof FormFieldDescriptorSchema>;

// ── Proposed Answer (backed by provenance) ──────────────────────
export const ProposedAnswerSchema = z.object({
  value: z.string(),                        // The answer text
  origin: AnswerOriginEnum,                 // Where the answer came from
  sourceDetail: z.string().optional(),      // e.g. "canonical_fact:personal.firstName"
  confidence: AnswerConfidenceEnum,
  reason: z.string().optional(),            // Human-readable explanation
  requiresReview: z.boolean().default(false),
});
export type ProposedAnswer = z.infer<typeof ProposedAnswerSchema>;

// ── Field Result (one per discovered form field) ─────────────────
export const FieldFillResultSchema = z.object({
  fieldId: z.string(),                      // Matches FormFieldDescriptor.runtimeId
  label: z.string(),
  controlType: z.string(),
  status: FieldFillStatusEnum,
  proposedAnswer: ProposedAnswerSchema.nullable().default(null),
  wasChanged: z.boolean().default(false),   // true if Jobby modified the DOM value (enables undo)
  errorMessage: z.string().optional(),
});
export type FieldFillResult = z.infer<typeof FieldFillResultSchema>;

// ── Page Fill Run (one attempt to fill a single application page) ─
export const PageFillRunSchema = z.object({
  runId: z.string(),                        // Unique id for this run (crypto.randomUUID)
  sessionId: z.string(),                    // Application session driving this fill
  careerProfileId: z.string().nullable().default(null),
  pageUrl: z.string().url(),                // The application page being filled
  pageTitle: z.string().optional(),
  startedAt: z.string(),                    // ISO timestamp
  finishedAt: z.string().optional(),        // Set when run completes
  fields: z.array(FieldFillResultSchema).default([]),
  summary: z.object({                       // Computed summary after run
    total: z.number().int().nonnegative().default(0),
    filled: z.number().int().nonnegative().default(0),
    generatedReview: z.number().int().nonnegative().default(0),
    needsUserInput: z.number().int().nonnegative().default(0),
    skipped: z.number().int().nonnegative().default(0),
    unsupported: z.number().int().nonnegative().default(0),
    failed: z.number().int().nonnegative().default(0),
  }).default({}),
});
export type PageFillRun = z.infer<typeof PageFillRunSchema>;

// ── Assisted-Fill Policy ────────────────────────────────────────
export const FillPolicyLevelEnum = z.enum([
  'allowed',         // Jobby may read AND write form fields
  'assisted_only',   // Jobby may suggest answers but must NOT modify the page DOM
  'skip',            // Page must be skipped entirely
]);
export type FillPolicyLevel = z.infer<typeof FillPolicyLevelEnum>;

export const FillPolicyDecisionSchema = z.object({
  level: FillPolicyLevelEnum,
  reason: z.string(),
});
export type FillPolicyDecision = z.infer<typeof FillPolicyDecisionSchema>;