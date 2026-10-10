import { JSDOM } from 'jsdom';
import { JobSourceType } from '../../types/job.js';
import { PageDetectionResult, StructuredRawContent } from '../../types/job-extraction.js';

export interface PageContext {
  url: string;
  document: Document;
}

export interface SourceExtractor {
  readonly source: JobSourceType;
  matchesUrl(url: URL): boolean;
  detect(context: PageContext): { matches: boolean; confidence: number; detectedJobTitle: string | null; detectedCompany: string | null; signals: string[] };
  extract(context: PageContext): Partial<StructuredRawContent>;
}

export function parseHtmlToDocument(html: string, url: string = 'https://example.com'): PageContext {
  const dom = new JSDOM(html, { url });
  return {
    url,
    document: dom.window.document,
  };
}
