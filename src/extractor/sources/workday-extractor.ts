import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class WorkdayExtractor implements SourceExtractor {
  readonly source = 'workday' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('myworkdayjobs.com') || host.includes('workday.com');
  }

  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    try {
      const urlObj = new URL(context.url);
      if (this.matchesUrl(urlObj)) {
        signals.push('url_workday_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector(
      '[data-automation-id="jobPostingHeader"], h2[data-automation-id="jobPostingTitle"], h1'
    );
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_workday_job_title');
    }

    const companyLogo = doc.querySelector('[data-automation-id="headerLogo"] img, header img');
    if (companyLogo) {
      const alt = companyLogo.getAttribute('alt');
      if (alt) detectedCompany = alt.replace(/\s+logo$/i, '').trim();
    }
    if (detectedCompany) {
      signals.push('dom_workday_company');
    }

    const descEl = doc.querySelector(
      '[data-automation-id="jobPostingDescription"], [data-automation-id="job-posting-details"]'
    );
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_workday_description');
    }

    const applyBtn = doc.querySelector('[data-automation-id="adventureButton"], [data-automation-id="applyButton"]');
    if (applyBtn) {
      signals.push('dom_workday_apply_button');
    }

    const matches = signals.length >= 2 || (signals.includes('url_workday_pattern') && signals.length >= 1);
    const confidence = matches ? (signals.length >= 3 ? 0.95 : 0.85) : 0.0;

    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector(
      '[data-automation-id="jobPostingDescription"], [data-automation-id="job-posting-details"]'
    );
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtn = doc.querySelector('[data-automation-id="adventureButton"], [data-automation-id="applyButton"]');
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
