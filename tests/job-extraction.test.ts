import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JobPageDetector } from '../src/extractor/page-detector.js';
import { ContentExtractor } from '../src/extractor/content-extractor.js';

describe('Phase 3 Browser-Side Job Page Detection & Content Extraction', () => {
  const detector = new JobPageDetector();
  const extractor = new ContentExtractor();
  const fixturesDir = path.resolve('./tests/fixtures/jobs');

  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
  };

  describe('1. Specialized Source Page Detection', () => {
    it('detects a LinkedIn job posting page', () => {
      const html = loadFixture('linkedin-job.html');
      const url = 'https://www.linkedin.com/jobs/view/123456789/';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('linkedin');
      expect(result.detectedJobTitle).toBe('Senior AI Engineer');
      expect(result.detectedCompany).toBe('Cognitive Systems');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.matchingSignals).toContain('dom_linkedin_job_title');
    });

    it('detects an Indeed job posting page', () => {
      const html = loadFixture('indeed-job.html');
      const url = 'https://www.indeed.com/viewjob?jk=abcdef12345';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('indeed');
      expect(result.detectedJobTitle).toBe('Backend Software Engineer');
      expect(result.detectedCompany).toBe('Acme Cloud Inc');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('detects a Greenhouse job posting page', () => {
      const html = loadFixture('greenhouse-job.html');
      const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('greenhouse');
      expect(result.detectedJobTitle).toBe('Revenue Operations Engineer');
      expect(result.detectedCompany).toBe('Mission Inbox');
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('detects a Lever job posting page', () => {
      const html = loadFixture('lever-job.html');
      const url = 'https://jobs.lever.co/vitallypartner/112233';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('lever');
      expect(result.detectedJobTitle).toBe('Customer Success Engineer');
      expect(result.detectedCompany).toBe('Vitally Partner');
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('detects an Ashby job posting page', () => {
      const html = loadFixture('ashby-job.html');
      const url = 'https://jobs.ashbyhq.com/ashbyhub/778899';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('ashby');
      expect(result.detectedJobTitle).toBe('Staff Systems Engineer');
      expect(result.detectedCompany).toBe('Ashby Hub');
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('detects a generic company career page via JSON-LD and semantic DOM', () => {
      const html = loadFixture('generic-job.html');
      const url = 'https://cyberneticslabs.ai/careers/robotics-sr';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(true);
      expect(result.source).toBe('company-page');
      expect(result.detectedJobTitle).toBe('Senior Robotics Engineer');
      expect(result.detectedCompany).toBe('Cybernetics Labs');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  describe('2. Negative Assertion: Non-Job Pages', () => {
    it('accurately identifies non-job articles or homepages as isJobPage = false', () => {
      const html = loadFixture('non-job-article.html');
      const url = 'https://techblog.io/articles/reasons-to-learn-golang';
      const result = detector.detectFromHtml(html, url);

      expect(result.isJobPage).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.detectedJobTitle).toBeNull();
      expect(result.reason).toContain('No recognized ATS signatures');
    });
  });

  describe('3. Structured Content Extraction Layer', () => {
    it('extracts structured raw material (headings, text, metadata, buttons, links) without LLM', () => {
      const html = loadFixture('greenhouse-job.html');
      const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';
      const raw = extractor.extractFromHtml(html, url);

      expect(raw.url).toBe(url);
      expect(raw.title).toContain('Revenue Operations Engineer');
      expect(raw.headings.length).toBeGreaterThanOrEqual(2);
      expect(raw.visibleText).toContain('Stripe and Chargebee');
      expect(raw.visibleText).toContain('PostgreSQL');

      // JSON-LD extracted
      expect(raw.jsonLd.length).toBe(1);
      expect(raw.jsonLd[0]['@type']).toBe('JobPosting');

      // Application link detected
      expect(raw.formApplicationLinks.some((l) => l.includes('apply'))).toBe(true);

      // Relevant DOM sections preserved
      expect(raw.relevantDomSections['description']).toBeDefined();
      expect(raw.relevantDomSections['applicationForm']).toBeDefined();
    });

    it('extracts LinkedIn specific apply buttons and description blocks', () => {
      const html = loadFixture('linkedin-job.html');
      const url = 'https://www.linkedin.com/jobs/view/123456789/';
      const raw = extractor.extractFromHtml(html, url);

      expect(raw.buttons).toContain('Easy Apply');
      expect(raw.visibleText).toContain('Senior AI Engineer');
      expect(raw.visibleText).toContain('PyTorch');
      expect(raw.relevantDomSections['description']).toBeDefined();
      expect(raw.formApplicationLinks.length).toBeGreaterThan(0);
    });

    it('extracts Indeed specific description container and company name', () => {
      const html = loadFixture('indeed-job.html');
      const url = 'https://www.indeed.com/viewjob?jk=abcdef12345';
      const raw = extractor.extractFromHtml(html, url);

      expect(raw.visibleText).toContain('Acme Cloud is hiring a Backend Software Engineer');
      expect(raw.relevantDomSections['description']).toBeDefined();
      expect(raw.formApplicationLinks).toContain('https://acmecloud.com/careers/apply/98765');
    });
  });

  });
});
