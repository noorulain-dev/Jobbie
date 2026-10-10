import { z } from 'zod';
import { JobSchema } from './job.js';

/**
 * JobSnapshot represents an immutable point-in-time record of what Jobby
 * knew about a job posting when it was encountered or updated.
 *
 * It stores:
 * - Content hash (SHA-256) of normalized text to detect when postings change
 * - Reconstructable parsed state of the Job
 * - Deltas/differences detected against earlier snapshots
 */
export const JobSnapshotSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  snapshotTimestamp: z.string(),
  contentHash: z.string(), // SHA-256 of normalized text/content
  cleanTextContent: z.string(), // Extracted textual description content
  parsedStateJson: z.string(), // Full serialized Job state
  changeDelta: z.array(z.string()).default([]), // List of fields modified from preceding snapshot
});
export type JobSnapshot = z.infer<typeof JobSnapshotSchema>;
