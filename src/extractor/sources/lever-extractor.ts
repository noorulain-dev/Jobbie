import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class LeverExtractor implements SourceExtractor {
  readonly source = 'lever' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return host.includes('jobs.lever.co') || host.endsWith('lever.co');
  }

  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    try {
      const urlObj = new URL(context.url);
      if (this.matchesUrl(urlObj)) {
        signals.push('url_lever_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector('.posting-headline h2, .posting-header h2, h2.posting-title, div[data-qa="posting-name"]');
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_lever_job_title');
    }

    const companyLogoEl = doc.querySelector('.main-header-logo img, .posting-header img');
    if (companyLogoEl) {
      const alt = companyLogoEl.getAttribute('alt');
      if (alt) {
        detectedCompany = alt.replace(/\s+logo$/i, '').trim();
      }
    }
    if (!detectedCompany) {
      try {
        const urlObj = new URL(context.url);
        if (this.matchesUrl(urlObj)) {
          const parts = urlObj.pathname.split('/').filter(Boolean);
          if (parts.length >= 1) {
            detectedCompany = parts[0];
          }
        }
      } catch {}
    }
    if (detectedCompany) {
      signals.push('dom_lever_company');
    }

    const descEl = doc.querySelector('.posting-sections, .section-wrapper, .posting-description, [data-qa="job-description"]');
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_lever_content');
    }

    const applyBtn = doc.querySelector('.postings-btn, a[href*="/apply"], a.template-btn-submit');
    if (applyBtn) {
      signals.push('dom_lever_apply_button');
    }

    // Must have at least URL pattern + title, or strong Lever-specific DOM elements (posting-sections / postings-btn)
    const hasLeverSpecificDom = Boolean(doc.querySelector('.posting-headline, .posting-sections, .postings-btn'));
    const matches = (signals.includes('url_lever_pattern') && signals.length >= 2) || (hasLeverSpecificDom && signals.length >= 3);
    const confidence = matches ? (signals.length >= 3 ? 0.98 : 0.90) : 0.0;


    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector('.posting-sections, .section-wrapper, .posting-description');
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtn = doc.querySelector('.postings-btn, a[href*="/apply"]');
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
