import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class GreenhouseExtractor implements SourceExtractor {
  readonly source = 'greenhouse' as const;

  matchesUrl(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      host.includes('boards.greenhouse.io') ||
      host.includes('greenhouse.io') ||
      (host.includes('greenhouse') && path.includes('/jobs')) ||
      url.searchParams.has('gh_jid') ||
      url.searchParams.has('gh_src')
    );
  }


  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    try {
      const urlObj = new URL(context.url);
      if (urlObj.hostname.includes('boards.greenhouse.io') || urlObj.searchParams.has('gh_jid')) {
        signals.push('url_greenhouse_pattern');
      }
    } catch {}

    const titleEl = doc.querySelector('.app-title, h1.job-post__title, #header h1, h1');
    if (titleEl && titleEl.textContent?.trim()) {
      detectedJobTitle = titleEl.textContent.trim();
      signals.push('dom_greenhouse_job_title');
    }

    const companyEl = doc.querySelector('.company-name, .job-post__company, #header .company, .logo');
    if (companyEl && companyEl.textContent?.trim()) {
      detectedCompany = companyEl.textContent.trim().replace(/^at\s+/i, '').trim();
      signals.push('dom_greenhouse_company');
    }

    const contentEl = doc.querySelector('#content, #app_body, .job-post, #application');
    if (contentEl && (contentEl.textContent?.trim().length || 0) > 100) {
      signals.push('dom_greenhouse_content_area');
    }

    const formEl = doc.querySelector('form#application_form, form[action*="greenhouse.io"]');
    if (formEl) {
      signals.push('dom_greenhouse_application_form');
    }

    const matches = signals.length >= 2 || (signals.includes('url_greenhouse_pattern') && signals.length >= 1);
    const confidence = matches ? (signals.length >= 3 ? 0.98 : 0.90) : 0.0;

    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const contentEl = doc.querySelector('#content, #app_body, .job-post');
    if (contentEl) {
      sections['description'] = contentEl.innerHTML;
    }

    const formLinks: string[] = [];
    const formEl = doc.querySelector('form#application_form');
    if (formEl) {
      const action = formEl.getAttribute('action');
      if (action) formLinks.push(action);
      sections['applicationForm'] = formEl.innerHTML;
    }

    return {
      relevantDomSections: sections,
      formApplicationLinks: formLinks,
    };
  }
}
