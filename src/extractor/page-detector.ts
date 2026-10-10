import { PageContext, SourceExtractor, parseHtmlToDocument } from './sources/base-source.js';
import { LinkedInExtractor } from './sources/linkedin-extractor.js';
import { IndeedExtractor } from './sources/indeed-extractor.js';
import { GreenhouseExtractor } from './sources/greenhouse-extractor.js';
import { LeverExtractor } from './sources/lever-extractor.js';
import { AshbyExtractor } from './sources/ashby-extractor.js';
import { WorkdayExtractor } from './sources/workday-extractor.js';
import { WellfoundExtractor } from './sources/wellfound-extractor.js';
import { GenericCompanyPageExtractor } from './sources/generic-extractor.js';
import { PageDetectionResult, PageDetectionResultSchema, StructuredRawContent, StructuredRawContentSchema } from '../types/job-extraction.js';

export class JobPageDetector {
  private specializedExtractors: SourceExtractor[];
  private genericExtractor: GenericCompanyPageExtractor;

  constructor() {
    this.specializedExtractors = [
      new GreenhouseExtractor(),
      new LeverExtractor(),
      new AshbyExtractor(),
      new WorkdayExtractor(),
      new LinkedInExtractor(),
      new IndeedExtractor(),
      new WellfoundExtractor(),
    ];
    this.genericExtractor = new GenericCompanyPageExtractor();
  }

  /**
   * Deterministically analyzes a web page DOM to determine if it contains a job posting.
   */
  public detect(context: PageContext): PageDetectionResult {
    let urlObj: URL | null = null;
    try {
      urlObj = new URL(context.url);
    } catch {}

    // 1. Try specialized extractors matching URL first
    if (urlObj) {
      for (const extractor of this.specializedExtractors) {
        if (extractor.matchesUrl(urlObj)) {
          const result = extractor.detect(context);
          if (result.matches) {
            return PageDetectionResultSchema.parse({
              isJobPage: true,
              confidence: result.confidence,
              source: extractor.source,
              detectedJobTitle: result.detectedJobTitle,
              detectedCompany: result.detectedCompany,
              reason: `Matched specialized extractor for ${extractor.source} with signals: ${result.signals.join(', ')}`,
              matchingSignals: result.signals,
            });
          }
        }
      }
    }

    // 2. Try all specialized extractors (in case ATS is hosted on a custom domain / CNAME)
    for (const extractor of this.specializedExtractors) {
      const result = extractor.detect(context);
      if (result.matches && result.confidence >= 0.85) {
        return PageDetectionResultSchema.parse({
          isJobPage: true,
          confidence: result.confidence,
          source: extractor.source,
          detectedJobTitle: result.detectedJobTitle,
          detectedCompany: result.detectedCompany,
          reason: `Detected ATS DOM patterns for ${extractor.source} on custom domain: ${result.signals.join(', ')}`,
          matchingSignals: result.signals,
        });
      }
    }

    // 3. Fallback to generic company page heuristics / Schema.org JobPosting
    const genericResult = this.genericExtractor.detect(context);
    if (genericResult.matches) {
      return PageDetectionResultSchema.parse({
        isJobPage: true,
        confidence: genericResult.confidence,
        source: 'company-page',
        detectedJobTitle: genericResult.detectedJobTitle,
        detectedCompany: genericResult.detectedCompany,
        reason: `Detected job posting content via semantic DOM and structured microdata: ${genericResult.signals.join(', ')}`,
        matchingSignals: genericResult.signals,
      });
    }

    // 4. Clearly not a job posting
    return PageDetectionResultSchema.parse({
      isJobPage: false,
      confidence: 0.0,
      source: 'generic',
      detectedJobTitle: null,
      detectedCompany: null,
      reason: 'No recognized ATS signatures, JobPosting microdata, or sufficient job posting content patterns detected.',
      matchingSignals: genericResult.signals,
    });
  }

  /**
   * Helper to detect from raw HTML string.
   */
  public detectFromHtml(html: string, url: string = 'https://example.com/careers/job'): PageDetectionResult {
    const context = parseHtmlToDocument(html, url);
    return this.detect(context);
  }
}
