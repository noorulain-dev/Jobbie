import { PageContext, SourceExtractor, parseHtmlToDocument } from './sources/base-source.js';
import { LinkedInExtractor } from './sources/linkedin-extractor.js';
import { IndeedExtractor } from './sources/indeed-extractor.js';
import { GreenhouseExtractor } from './sources/greenhouse-extractor.js';
import { LeverExtractor } from './sources/lever-extractor.js';
import { AshbyExtractor } from './sources/ashby-extractor.js';
import { WorkdayExtractor } from './sources/workday-extractor.js';
import { WellfoundExtractor } from './sources/wellfound-extractor.js';
import { GenericCompanyPageExtractor } from './sources/generic-extractor.js';
import { StructuredRawContent, StructuredRawContentSchema } from '../types/job-extraction.js';

export class ContentExtractor {
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
   * Extracts structured raw material from the page DOM without using an LLM.
   */
  public extract(context: PageContext): StructuredRawContent {
    const doc = context.document;

    // 1. Title Extraction
    const pageTitle = doc.title || '';
    const h1 = doc.querySelector('h1')?.textContent?.trim() || '';
    const title = h1 || pageTitle;

    // 2. Headings
    const headings: Array<{ level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; text: string }> = [];
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const text = el.textContent?.trim();
      if (text) {
        headings.push({
          level: el.tagName.toLowerCase() as any,
          text,
        });
      }
    });

    // 3. Metadata (Meta tags, OpenGraph, Twitter)
    const structuredMetadata: Record<string, string> = {};
    doc.querySelectorAll('meta').forEach((meta) => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        structuredMetadata[name.trim()] = content.trim();
      }
    });

    // 4. JSON-LD Structured Data
    const jsonLd: Array<Record<string, unknown>> = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '');
        if (Array.isArray(parsed)) {
          parsed.forEach((p) => {
            if (p && typeof p === 'object') jsonLd.push(p);
          });
        } else if (parsed && typeof parsed === 'object') {
          jsonLd.push(parsed);
        }
      } catch {}
    });

    // 5. Links
    const links: Array<{ href: string; text: string; rel?: string }> = [];
    doc.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      const text = a.textContent?.trim() || '';
      const rel = a.getAttribute('rel') || undefined;
      if (href && (text || href.startsWith('http') || href.startsWith('/'))) {
        links.push({ href, text, rel });
      }
    });

    // 6. Buttons
    const buttons: string[] = [];
    doc.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach((b) => {
      const text = b.textContent?.trim() || (b as HTMLInputElement).value || '';
      if (text && !buttons.includes(text)) {
        buttons.push(text);
      }
    });

    // 7. Find source-specific extractor for target container extraction
    let sourceSpecificParts: Partial<StructuredRawContent> = {};
    let urlObj: URL | null = null;
    try {
      urlObj = new URL(context.url);
    } catch {}

    if (urlObj) {
      for (const extractor of this.specializedExtractors) {
        if (extractor.matchesUrl(urlObj)) {
          sourceSpecificParts = extractor.extract(context);
          break;
        }
      }
    }
    if (!sourceSpecificParts.relevantDomSections) {
      // Fallback to generic extractor
      sourceSpecificParts = this.genericExtractor.extract(context);
    }

    // 8. Visible Text Extraction
    // Prefer target description container if found; otherwise extract clean main content
    let visibleText = '';
    const mainContainer = doc.querySelector(
      '#job-details, .jobs-description__content, #jobDescriptionText, #content, #app_body, .posting-sections, [class*="JobPosting_description"], [data-automation-id="jobPostingDescription"], [data-test="JobDescription"], main, article, [role="main"], body'
    );

    if (mainContainer) {
      // Clone element to sanitize scripts/styles
      const clone = mainContainer.cloneNode(true) as Element;
      clone.querySelectorAll('script, style, noscript, svg, nav, footer').forEach((el) => el.remove());
      visibleText = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    return StructuredRawContentSchema.parse({
      url: context.url,
      title,
      headings,
      visibleText,
      structuredMetadata,
      links,
      buttons,
      formApplicationLinks: sourceSpecificParts.formApplicationLinks || [],
      jsonLd,
      relevantDomSections: sourceSpecificParts.relevantDomSections || {},
    });
  }

  /**
   * Helper to extract from raw HTML string.
   */
  public extractFromHtml(html: string, url: string = 'https://example.com/careers/job'): StructuredRawContent {
    const context = parseHtmlToDocument(html, url);
    return this.extract(context);
  }
}
