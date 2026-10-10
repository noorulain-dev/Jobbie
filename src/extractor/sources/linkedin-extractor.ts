import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class LinkedInExtractor implements SourceExtractor {
  readonly source = 'linkedin' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      (host.includes('linkedin.com') || host.endsWith('linkedin.com')) &&
      (path.includes('/jobs/view') || path.includes('/jobs/collections') || url.searchParams.has('currentjobid'))
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
        signals.push('url_linkedin_job_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector(
      '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.top-card-layout__title, h1.t-24'
    );
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_linkedin_job_title');
    }

    const companyEl = doc.querySelector(
      '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a.topcard__org-name-link, .jobs-unified-top-card__subtitle-primary-grouping'
    );
    if (companyEl && companyEl.textContent?.trim()) {
      detectedCompany = companyEl.textContent.trim().split('·')[0].trim();
      signals.push('dom_linkedin_company');
    }

    const descEl = doc.querySelector(
      '#job-details, .jobs-description__content, .jobs-description, .show-more-less-html__markup'
    );
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_linkedin_job_description');
    }

    const matches = signals.length >= 2 || (signals.includes('url_linkedin_job_pattern') && signals.length >= 1);
    const confidence = matches ? (signals.length >= 3 ? 0.95 : 0.85) : 0.0;

    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector(
      '#job-details, .jobs-description__content, .jobs-description, .show-more-less-html__markup'
    );
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const topCardEl = doc.querySelector('.job-details-jobs-unified-top-card, .jobs-unified-top-card');
    if (topCardEl) {
      sections['topCard'] = topCardEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtns = doc.querySelectorAll(
      'button.jobs-apply-button, a[data-control-name="jobdetails_topcard_inapply"], a.jobs-apply-button'
    );
    applyBtns.forEach((btn) => {
      const href = btn.getAttribute('href');
      if (href) formLinks.push(href);
    });

    return {
      relevantDomSections: sections,
      formApplicationLinks: formLinks,
    };
  }
}
