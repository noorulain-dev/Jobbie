import { z } from 'zod';
import { JobSourceTypeEnum } from './job.js';

/**
 * Result of analyzing a web page for a job posting.
 */
export const PageDetectionResultSchema = z.object({
  isJobPage: z.boolean(),
  confidence: z.number().min(0).max(1),
  source: JobSourceTypeEnum,
  detectedJobTitle: z.string().nullable().default(null),
  detectedCompany: z.string().nullable().default(null),
  reason: z.string(),
  matchingSignals: z.array(z.string()).default([]),
});
export type PageDetectionResult = z.infer<typeof PageDetectionResultSchema>;

/**
 * Structured raw material extracted from a job page DOM.
 */
export const StructuredRawContentSchema = z.object({
  url: z.string(),
  title: z.string(), // Page or job title
  headings: z.array(
    z.object({
      level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
      text: z.string(),
    })
  ).default([]),
  visibleText: z.string(), // Clean text of the main content area
  structuredMetadata: z.record(z.string(), z.string()).default({}), // Meta tags (og:*, twitter:*, description)
  links: z.array(
    z.object({
      href: z.string(),
      text: z.string(),
      rel: z.string().optional(),
    })
  ).default([]),
  buttons: z.array(z.string()).default([]), // Visible text of interactive buttons
  formApplicationLinks: z.array(z.string()).default([]), // Links or action URLs that appear to trigger application
  jsonLd: z.array(z.record(z.string(), z.unknown())).default([]), // Parsed JSON-LD objects
  relevantDomSections: z.record(z.string(), z.string()).default({}), // Named HTML excerpts of relevant DOM containers
});
export type StructuredRawContent = z.infer<typeof StructuredRawContentSchema>;
