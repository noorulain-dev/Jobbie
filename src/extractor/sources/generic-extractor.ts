import { PageContext, SourceExtractor } from './base-source.js';
import { StructuredRawContent } from '../../types/job-extraction.js';

export class GenericCompanyPageExtractor implements SourceExtractor {
  readonly source = 'generic' as const;

  matchesUrl(_url: URL): boolean {
    return true; // Catch-all fallback
  }

  detect(context: PageContext) {
    const doc = context.document;
    const signals: string[] = [];
    let detectedJobTitle: string | null = null;
    let detectedCompany: string | null = null;

    // 1. Check for schema.org/JobPosting in JSON-LD
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '');
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const type = item['@type'];
          if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
            signals.push('json_ld_job_posting');
            if (item.title && typeof item.title === 'string') {
              detectedJobTitle = item.title;
            }
            if (item.hiringOrganization && typeof item.hiringOrganization === 'object') {
              detectedCompany = item.hiringOrganization.name || null;
            }
          }
        }
      } catch {}
    });

    // 2. OpenGraph & Meta Tags
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
    if (ogType === 'article' || (ogTitle && /job|career|engineer|developer|manager|lead/i.test(ogTitle))) {
      signals.push('meta_og_job_indicators');
    }

    // 3. Document Title Analysis
    const docTitle = doc.title || '';
    if (/\b(career|careers|job|jobs|opening|position|apply)\b/i.test(context.url)) {
      signals.push('url_career_keywords');
    }
    if (/\b(hiring|career|careers|job|opening|position|apply)\b/i.test(docTitle)) {
      signals.push('title_career_keywords');
    }

    // 4. Semantic Header Analysis
    const h1 = doc.querySelector('h1');
    if (h1 && h1.textContent?.trim()) {
      const h1Text = h1.textContent.trim();
      if (!detectedJobTitle && h1Text.length < 100 && !/\b(welcome|careers|home|about|blog)\b/i.test(h1Text)) {
        detectedJobTitle = h1Text;
        signals.push('dom_h1_candidate');
      }
    }

    // 5. Job Description Heuristics
    const mainContent = doc.querySelector('main, article, [role="main"], .content, #content, body');
    const fullText = (mainContent?.textContent || '').toLowerCase();
    const jobKeywords = [
      'responsibilities',
      'requirements',
      'qualifications',
      'what you\'ll do',
      'what we look for',
      'what you bring',
      'benefits',
      'compensation',
      'salary',
      'years of experience',
      'equal opportunity employer',
      'apply now',
    ];

    let keywordHits = 0;
    for (const kw of jobKeywords) {
      if (fullText.includes(kw)) {
        keywordHits++;
      }
    }

    if (keywordHits >= 4) {
      signals.push('content_high_job_keywords');
    } else if (keywordHits >= 2) {
      signals.push('content_moderate_job_keywords');
    }

    // 6. Application CTA Detection
    const applyButtons = doc.querySelectorAll('a, button');
    let hasApplyCta = false;
    applyButtons.forEach((btn) => {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (/^apply(\s+now)?$/i.test(text) || text.includes('submit application') || text.includes('apply for this job')) {
        hasApplyCta = true;
      }
    });
    if (hasApplyCta) {
      signals.push('dom_apply_button_cta');
    }

    // Scoring & Decision
    const hasJsonLd = signals.includes('json_ld_job_posting');
    const strongSignals = signals.includes('content_high_job_keywords') && (signals.includes('dom_apply_button_cta') || signals.includes('dom_h1_candidate'));
    const matches = hasJsonLd || strongSignals || (signals.includes('content_moderate_job_keywords') && signals.includes('dom_apply_button_cta') && signals.includes('url_career_keywords'));

    let confidence = 0.0;
    if (hasJsonLd) confidence = 0.98;
    else if (strongSignals) confidence = 0.85;
    else if (matches) confidence = 0.70;

    return { matches, confidence, detectedJobTitle, detectedCompany, signals };
  }

  extract(context: PageContext): Partial<StructuredRawContent> {
    const doc = context.document;
    const sections: Record<string, string> = {};

    const mainEl = doc.querySelector('main, article, [role="main"], [class*="job-description"], .content, #content');
    if (mainEl) {
      sections['description'] = mainEl.innerHTML;
    }

    const formLinks: string[] = [];
    doc.querySelectorAll('a, form').forEach((el) => {
      const href = el.getAttribute('href') || el.getAttribute('action');
      const text = (el.textContent || '').toLowerCase();
      if (href && (text.includes('apply') || href.includes('/apply') || href.includes('greenhouse') || href.includes('lever') || href.includes('ashby'))) {
        formLinks.push(href);
      }
    });

    return {
      relevantDomSections: sections,
      formApplicationLinks: formLinks,
    };
  }
}
