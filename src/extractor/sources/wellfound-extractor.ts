import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class WellfoundExtractor implements SourceExtractor {
  readonly source = 'wellfound' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      (host.includes('wellfound.com') || host.includes('angel.co')) &&
      path.includes('/jobs')
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
        signals.push('url_wellfound_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector('[data-test="JobTitle"], .styles_header__JobTitle, [class*="JobTitle"]');
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_wellfound_job_title');
    }

    const companyEl = doc.querySelector('[class*="companyName"], [data-test="StartupName"], header a[href*="/company"]');
    if (companyEl && companyEl.textContent?.trim()) {
      detectedCompany = companyEl.textContent.trim();
      signals.push('dom_wellfound_company');
    }

    const descEl = doc.querySelector('[data-test="JobDescription"], [class*="styles_jobDescription"], [class*="jobDescription"]');
    if (descEl && (descEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_wellfound_description');
    }

    const hasWellfoundDom = Boolean(doc.querySelector('[data-test*="Job"], [class*="styles_jobDescription"], [data-test="StartupName"]'));
    const matches = (signals.includes('url_wellfound_pattern') && signals.length >= 2) || (hasWellfoundDom && signals.length >= 2);
    const confidence = matches ? (signals.length >= 3 ? 0.95 : 0.85) : 0.0;


    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const descEl = doc.querySelector('[data-test="JobDescription"], [class*="jobDescription"], article');
    if (descEl) {
      sections['description'] = descEl.innerHTML;
    }

    const formLinks: string[] = [];
    const applyBtn = doc.querySelector('button[class*="apply"], a[href*="/apply"]');
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
