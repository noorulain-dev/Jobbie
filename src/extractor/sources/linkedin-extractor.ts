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

    // Try DOM selectors for title
    const titleEl = doc.querySelector('h1, [class*="job-title"], .t-24');
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_linkedin_job_title');
    }

    // Try DOM selectors for company
    const companyEl = doc.querySelector('[class*="company"], a[class*="org-name"], [class*="employer"]');
    if (companyEl && companyEl.textContent?.trim()) {
      const raw = companyEl.textContent.trim();
      detectedCompany = raw.split('·')[0].trim().split('|')[0].trim();
      if (detectedCompany) signals.push('dom_linkedin_company');
    }

    // Try logo alt text
    if (!detectedCompany) {
      const logoImg = doc.querySelector('img[alt*="Company logo"], img[alt*="logo for"], img[alt*="logo"]');
      if (logoImg) {
        const alt = logoImg.getAttribute('alt') || '';
        const m = alt.match(/logo (?:for|of)s+(.+)/i) || alt.match(/^(.+?)s+logo/i);
        if (m) { detectedCompany = m[1].replace(/.$/, '').trim(); signals.push('linkedin_logo_alt'); }
      }
    }

    // Parse page title for "Role | Company | LinkedIn" pattern
    const pageTitle = doc.querySelector('title')?.textContent?.trim() || '';
    if (pageTitle && pageTitle.includes('LinkedIn')) {
      const parts = pageTitle.split('|').map(s => s.trim());
      const last = parts[parts.length - 1] || '';
      if (last === 'LinkedIn') {
        if (!detectedJobTitle && parts[0]) {
          detectedJobTitle = parts[0];
          signals.push('linkedin_title_role');
        }
        if (!detectedCompany && parts.length >= 3 && parts[1]) {
          detectedCompany = parts[1];
          signals.push('linkedin_title_company');
        }
      }
    }

    // Clean title: strip any remaining pipe-separated suffixes
    if (detectedJobTitle && detectedJobTitle.includes(' | ')) {
      const pipeIdx = detectedJobTitle.indexOf(' | ');
      if (pipeIdx > 0 && detectedJobTitle.toLowerCase().indexOf('linkedin', pipeIdx) > 0) {
        detectedJobTitle = detectedJobTitle.substring(0, pipeIdx).trim();
      }
    }

    const descEl = doc.querySelector('#job-details, .jobs-description__content, .jobs-description, .show-more-less-html__markup');
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

    const descEl = doc.querySelector('#job-details, .jobs-description__content, .jobs-description, .show-more-less-html__markup');
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const topCardEl = doc.querySelector('.job-details-jobs-unified-top-card, .jobs-unified-top-card');
    if (topCardEl) {
      sections['topCard'] = topCardEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtns = doc.querySelectorAll('button.jobs-apply-button, a[data-control-name="jobdetails_topcard_inapply"], a.jobs-apply-button');
    applyBtns.forEach((btn) => {
      const href = btn.getAttribute('href');
      if (href) formLinks.push(href);
    });

    return {
      relevantDomSections: sections,
      formApplicationLinks: formLinks.length > 0 ? formLinks : undefined,
    };
  }
}
