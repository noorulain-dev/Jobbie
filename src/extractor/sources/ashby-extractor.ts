import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class AshbyExtractor implements SourceExtractor {
  readonly source = 'ashby' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('jobs.ashbyhq.com') || host.endsWith('ashbyhq.com');
  }

  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    try {
      const urlObj = new URL(context.url);
      if (this.matchesUrl(urlObj)) {
        signals.push('url_ashby_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector('h1[class*="JobPosting_title"], h1[class*="title"], [data-qa="job-title"]');
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_ashby_job_title');
    }

    const companyEl = doc.querySelector('header a, [class*="JobPosting_company"], [class*="companyName"]');
    if (companyEl && companyEl.textContent?.trim()) {
      detectedCompany = companyEl.textContent.trim();
      signals.push('dom_ashby_company');
    }

    const descEl = doc.querySelector('[class*="JobPosting_description"], [class*="jobDescription"]');
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_ashby_description');
    }

    const hasAshbySpecificDom = Boolean(doc.querySelector('[class*="JobPosting_"], [class*="ashby_"]'));
    const matches = (signals.includes('url_ashby_pattern') && signals.length >= 2) || (hasAshbySpecificDom && signals.length >= 2);
    const confidence = matches ? (signals.length >= 3 ? 0.98 : 0.90) : 0.0;


    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector('[class*="JobPosting_description"], [class*="jobDescription"], article');
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtn = doc.querySelector('a[href*="/application"], button[class*="apply"]');
    if (applyBtn) {
      const href = applyBtn.getAttribute('href');
      if (href) formLinks.push(href);
    }

    return {
      relevantDomSections: sections,
      formApplicationLinks: formLinks,
    };
  }
}
