import { z } from 'zod';
import { JobSourceTypeEnum } from './job.js';

export const JobSourceSchema = z.object({
  id: z.string().uuid(),
  sourceType: JobSourceTypeEnum,
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceSpecificId: z.string().nullable().default(null),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type JobSource = z.infer<typeof JobSourceSchema>;

export const JobDedupClusterSchema = z.object({
  clusterId: z.string().uuid(),
  primaryJobId: z.string().uuid(),
  dedupHash: z.string(),
  companyNormalized: z.string(),
  titleNormalized: z.string(),
  locationNormalized: z.string(),
  memberJobIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobDedupCluster = z.infer<typeof JobDedupClusterSchema>;
