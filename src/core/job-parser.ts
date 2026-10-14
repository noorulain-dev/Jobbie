import crypto from 'node:crypto';
import { Job, JobSchema, JobSourceType } from '../types/job.js';
import { PageDetectionResult, StructuredRawContent } from '../types/job-extraction.js';
import {
  normalizeCompanyName,
  normalizeJobTitle,
  normalizeJobUrl,
  normalizeJobLocation,
  extractSeniorityLevel,
  computeJobDedupHash,
} from './job-normalizer.js';

export interface ManualJobContextInput {
  title?: string;
  companyName?: string;
  url?: string;
  description?: string;
  location?: string;
  salaryText?: string;
  employmentType?: Job['employmentType'];
  seniority?: Job['seniority'];
}

export class JobParser {
  /**
   * Converts detected and extracted raw page material into a normalized Job entity.
   * If extraction is incomplete, preserves usable extracted information and logs warnings.
   */
  public static fromRawContent(
    detection: PageDetectionResult,
    rawContent: StructuredRawContent,
    manualFallback?: ManualJobContextInput
  ): { job: Job; warnings: string[] } {
    const warnings: string[] = [];

    // 1. Resolve Company
    let rawCompany = detection.detectedCompany || manualFallback?.companyName || '';
    if (!rawCompany) {
      // Check JSON-LD
      for (const item of rawContent.jsonLd) {
        const org = item['hiringOrganization'] as any;
        if (org && typeof org === 'object' && org.name) {
          rawCompany = String(org.name).trim();
          break;
        }
      }
    }
    if (!rawCompany) {
      // Check OpenGraph or meta
      rawCompany = rawContent.structuredMetadata['og:site_name'] || '';
    }
    if (!rawCompany) {
      rawCompany = 'Unknown Company';
      warnings.push('Company name could not be deterministically detected from page.');
    }

    // 2. Resolve Title
    let rawTitle = detection.detectedJobTitle || manualFallback?.title || '';
    // Strip LinkedIn/aggregator suffixes like " | CompanyName | LinkedIn"
    if (rawTitle && rawTitle.includes(' | ')) {
      const parts = rawTitle.split(' | ');
      // Keep only the first part (the actual job title) if subsequent parts look like company/platform names
      rawTitle = parts[0].trim();
    }
    if (!rawTitle) {
      for (const item of rawContent.jsonLd) {
        if (item.title && typeof item.title === 'string') {
          rawTitle = item.title.trim();
          break;
        }
      }
    }
    if (!rawTitle) {
      rawTitle = rawContent.title || '';
    }
    if (!rawTitle) {
      rawTitle = 'Untitled Position';
      warnings.push('Job title could not be deterministically detected from page.');
    }

    // 3. Resolve Description
    let rawDescription = rawContent.visibleText || manualFallback?.description || '';
    if (!rawDescription) {
      for (const item of rawContent.jsonLd) {
        if (item.description && typeof item.description === 'string') {
          rawDescription = item.description.trim();
          break;
        }
      }
    }
    if (!rawDescription) {
      rawDescription = 'No description content extracted.';
      warnings.push('Job description was incomplete or could not be cleanly extracted from page.');
    }

    // 4. Resolve Location
    let rawLocation = manualFallback?.location || '';
    if (!rawLocation) {
      for (const item of rawContent.jsonLd) {
        const loc = item['jobLocation'] as any;
        if (loc && typeof loc === 'object') {
          if (typeof loc.address === 'string') rawLocation = loc.address;
          else if (loc.address && typeof loc.address === 'object') {
            const addr = loc.address;
            const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
            if (parts.length > 0) rawLocation = parts.join(', ');
          }
        }
      }
    }
    const locInfo = normalizeJobLocation(rawLocation);

    // 5. Normalizations
    const normalizedCompany = normalizeCompanyName(rawCompany);
    const normalizedTitle = normalizeJobTitle(rawTitle);
    const seniority = extractSeniorityLevel(rawTitle);
    const canonicalUrl = normalizeJobUrl(rawContent.url);
    const applicationUrl = rawContent.formApplicationLinks[0] || canonicalUrl;

    const dedupHash = computeJobDedupHash({
      companyName: rawCompany,
      jobTitle: rawTitle,
      rawLocation,
    });

    const now = new Date().toISOString();

    const jobData: Job = {
      id: crypto.randomUUID(),
      source: detection.source as JobSourceType,
      sourceJobId: null,
      sourceUrl: rawContent.url,
      canonicalUrl,
      applicationUrl,
      companyName: rawCompany,
      normalizedCompany,
      companyUrl: null,
      title: rawTitle,
      normalizedTitle,
      department: null,
      seniority,
      remoteStatus: locInfo.remoteStatus,
      locations: locInfo.city ? [locInfo.city] : [],
      country: locInfo.country,
      region: locInfo.region,
      city: locInfo.city,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: 'USD',
      salaryPeriod: 'yearly',
      salaryText: manualFallback?.salaryText || null,
      employmentType: manualFallback?.employmentType || 'full-time',
      description: rawDescription,
      responsibilities: [],
      requiredQualifications: [],
      preferredQualifications: [],
      benefits: [],
      requiredSkills: [],
      preferredSkills: [],
      technologies: [],
      yearsExperience: null,
      educationRequirements: null,
      workAuthorization: null,
      sponsorship: null,
      applicationMethod: rawContent.formApplicationLinks.length > 0 ? 'ats-redirect' : 'company-form',
      postedAt: null,
      closingAt: null,
      discoveredAt: now,
      updatedAt: now,
      parserVersion: '1.0.0',
      parserConfidence: detection.confidence,
      extractionWarnings: warnings,
      rawMetadata: {
        pageTitle: rawContent.title,
        matchingSignals: detection.matchingSignals,
      },
      dedupHash,
      dedupClusterId: null,
    };

    const validated = JobSchema.parse(jobData);
    return { job: validated, warnings };
  }
}
