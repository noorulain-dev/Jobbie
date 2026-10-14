import { z } from 'zod';

export const DocumentTypeEnum = z.enum(['RESUME', 'COVER_LETTER']);
export type DocumentType = z.infer<typeof DocumentTypeEnum>;

export const DocumentStatusEnum = z.enum([
  'CONTENT_GENERATED',    // AI content created successfully
  'TEX_WRITTEN',          // .tex file written to disk
  'PDF_COMPILED',         // .pdf successfully compiled
  'CONTENT_FAILED',       // AI content generation failed
  'TEX_WRITE_FAILED',     // Could not write .tex file
  'COMPILATION_FAILED',   // LaTeX/PDF compilation failed
]);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

/**
 * GeneratedDocument — metadata for one generated artifact.
 * Only fields needed to find, associate, list, and revise documents.
 * Never stores Master Profile or job description content.
 */
export const GeneratedDocumentSchema = z.object({
  /** Stable artifact UUID */
  artifactId: z.string().uuid(),

  /** Owning application session */
  sessionId: z.string().uuid(),

  /** Document type */
  documentType: DocumentTypeEnum,

  /** Monotonic version number (1-based, increments per revision) */
  version: z.number().int().positive(),

  /** Career profile ID used during generation */
  careerProfileId: z.string().nullable().default(null),

  /** Version/timestamp of the profile when generation was triggered */
  careerProfileVersion: z.string().nullable().default(null),

  /** Timestamps */
  createdAt: z.string(),     // ISO — when generation was requested
  updatedAt: z.string(),     // ISO — last status change

  /** Generation status */
  status: DocumentStatusEnum,

  /** Absolute paths to output files */
  texPath: z.string().nullable().default(null),
  pdfPath: z.string().nullable().default(null),

  /** Output directory for this application's documents */
  outputDir: z.string(),

  /** Brief summary of generation instructions used (not the full prompt) */
  instructionSummary: z.string().nullable().default(null),

  /** Link to previous version for revision chain */
  previousArtifactId: z.string().uuid().nullable().default(null),

  /** Compiler or generation error details when failed */
  errorMessage: z.string().nullable().default(null),
  errorDetails: z.string().nullable().default(null),

  /** The generation/revision reason (from user or auto) */
  revisionReason: z.string().nullable().default(null),
});

export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

/**
 * Lightweight list item returned to UI — no filesystem paths exposed.
 */
export const GeneratedDocumentListItemSchema = z.object({
  artifactId: z.string().uuid(),
  sessionId: z.string().uuid(),
  documentType: DocumentTypeEnum,
  version: z.number().int().positive(),
  status: DocumentStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
  careerProfileId: z.string().nullable(),
  instructionSummary: z.string().nullable(),
  revisionReason: z.string().nullable(),
  /** True if PDF is available for download */
  pdfAvailable: z.boolean(),
  errorMessage: z.string().nullable(),
});

export type GeneratedDocumentListItem = z.infer<typeof GeneratedDocumentListItemSchema>;