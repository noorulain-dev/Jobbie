import { z } from 'zod';

/**
 * Application Tracker Status — separate from ApplicationSessionStatus.
 * Tracks where the user is in the application process, not whether
 * a Jobby session is active/paused.
 */
export const TrackerStatusEnum = z.enum([
  'DRAFT',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
  'ARCHIVED',
]);
export type TrackerStatus = z.infer<typeof TrackerStatusEnum>;

/**
 * Valid status transitions. Any status can move to any other status
 * (explicit user action), except ARCHIVED is terminal.
 */
export const VALID_TRACKER_TRANSITIONS: Record<TrackerStatus, TrackerStatus[]> = {
  DRAFT:        ['DRAFT', 'APPLIED', 'ARCHIVED'],
  APPLIED:      ['APPLIED', 'INTERVIEWING', 'REJECTED', 'WITHDRAWN', 'ARCHIVED'],
  INTERVIEWING: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN', 'ARCHIVED'],
  OFFER:        ['OFFER', 'APPLIED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED'],
  REJECTED:     ['REJECTED', 'APPLIED', 'ARCHIVED'],
  WITHDRAWN:    ['WITHDRAWN', 'APPLIED', 'ARCHIVED'],
  ARCHIVED:     [],
};

export function isValidTrackerTransition(current: TrackerStatus, target: TrackerStatus): boolean {
  if (current === target) return true;
  return VALID_TRACKER_TRANSITIONS[current]?.includes(target) ?? false;
}

/**
 * TrackerRecord — persisted alongside the application session.
 * Stored as part of JobContextOverrides for fields the user can edit,
 * plus a JSONL log for idempotency and audit trail.
 */
export const TrackerRecordSchema = z.object({
  /** Stable tracker ID — matches the session ID (1:1 relationship) */
  trackerId: z.string().uuid(),

  /** Associated application session */
  sessionId: z.string().uuid(),

  /** Tracker status — user-editable */
  status: TrackerStatusEnum.default('DRAFT'),

  /** Explicit date the application was submitted */
  dateApplied: z.string().nullable().default(null),

  /** User-editable notes about the application */
  notes: z.string().nullable().default(null),

  /** Record timestamps */
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrackerRecord = z.infer<typeof TrackerRecordSchema>;

/**
 * TrackerEntry — enriched view returned to API/UI.
 * Joins session data + document artifacts without duplicating them.
 */
export const TrackerEntrySchema = z.object({
  trackerId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sessionStatus: z.string(), // ApplicationSessionStatus

  company: z.string(),
  role: z.string(),
  sourceUrl: z.string(),
  applicationUrl: z.string().nullable(),

  trackerStatus: TrackerStatusEnum,
  dateStarted: z.string(),
  dateApplied: z.string().nullable(),
  notes: z.string().nullable(),

  careerProfileId: z.string().nullable(),
  careerProfileName: z.string().nullable(),

  resumeArtifactId: z.string().uuid().nullable(),
  resumeVersion: z.number().int().positive().nullable(),
  resumePdfAvailable: z.boolean(),

  coverLetterArtifactId: z.string().uuid().nullable(),
  coverLetterVersion: z.number().int().positive().nullable(),
  coverLetterPdfAvailable: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrackerEntry = z.infer<typeof TrackerEntrySchema>;