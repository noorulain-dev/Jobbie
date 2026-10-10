import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class IndeedExtractor implements SourceExtractor {
  readonly source = 'indeed' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      (host.includes('indeed.com') || host.endsWith('indeed.com')) &&
      (path.includes('/viewjob') || url.searchParams.has('vjk') || url.searchParams.has('jk'))
    );
  }

  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    try {
      const urlObj = new URL(context.url);
      if (this.matchesUrl(urlObj)) {
        signals.push('url_indeed_job_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector(
      'h1.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title'
    );
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim().replace(/- job post$/i, '').trim();
      signals.push('dom_indeed_job_title');
    }

    const companyEl = doc.querySelector(
      '[data-testid="inlineHeader-companyName"], [data-company-name="true"], .jobsearch-InlineCompanyAccess-companyName'
    );
    if (companyEl && companyEl.textContent?.trim()) {
      detectedCompany = companyEl.textContent.trim();
      signals.push('dom_indeed_company');
    }

    const descEl = doc.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_indeed_job_description');
    }

    const matches = signals.length >= 2 || (signals.includes('url_indeed_job_pattern') && signals.length >= 1);
    const confidence = matches ? (signals.length >= 3 ? 0.95 : 0.85) : 0.0;

    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtn = doc.querySelector('#applyButtonLinkContainer a, [data-testid="apply-button"]');
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
