import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { ProfileStorage } from '../src/core/storage.js';
import {
  ApplicationSession,
  ApplicationSessionSchema,
  isValidSessionTransition,
  JobContextSnapshot,
  JobContextSnapshotSchema,
  JobContextOverrides,
  AssociatedPage,
} from '../src/types/application-session.js';
import { Job, JobSchema } from '../src/types/job.js';
import { SeedMigrator } from '../src/core/migrator.js';
import { JobbyDatabase } from '../src/db/database.js';

describe('Phase 4 ApplicationSession Entity, Lifecycle & Persistence', () => {
  let storage: ProfileStorage;

  beforeEach(() => {
    storage = new ProfileStorage({ profileDir: ':memory:' });
  });

  const createSampleJob = (): Job => {
    return JobSchema.parse({
      id: crypto.randomUUID(),
      source: 'greenhouse',
      sourceJobId: 'gh-445566',
      sourceUrl: 'https://boards.greenhouse.io/missioninbox/jobs/445566',
      canonicalUrl: 'https://boards.greenhouse.io/missioninbox/jobs/445566',
      applicationUrl: 'https://boards.greenhouse.io/missioninbox/jobs/445566/apply',
      companyName: 'Mission Inbox',
      normalizedCompany: 'mission inbox',
      companyUrl: 'https://missioninbox.com',
      title: 'Senior Revenue Operations Engineer',
      normalizedTitle: 'senior revenue operations engineer',
      department: 'Engineering',
      seniority: 'senior',
      remoteStatus: 'remote',
      locations: ['Remote'],
      country: 'Canada',
      region: 'Ontario',
      city: 'Toronto',
      salaryMin: 110000,
      salaryMax: 140000,
      salaryCurrency: 'USD',
      salaryPeriod: 'yearly',
      salaryText: '$110,000 - $140,000 / year',
      employmentType: 'full-time',
      description: 'Build email infrastructure and Stripe subscription management.',
      responsibilities: [
        'Maintain Postfix/Dovecot email routing',
        'Integrate Stripe and Chargebee billing webhooks',
      ],
      requiredQualifications: ['3+ years in backend engineering'],
      preferredQualifications: ['Experience with email deliverability'],
      benefits: ['Remote stipend', 'Health coverage'],
      requiredSkills: ['Golang', 'PostgreSQL', 'Stripe'],
      preferredSkills: ['Chargebee', 'Docker'],
      technologies: ['Golang', 'PostgreSQL', 'Docker', 'Stripe'],
      yearsExperience: 3,
      educationRequirements: "Bachelor's Degree in CS or equivalent",
      workAuthorization: 'Authorized to work in Canada or US',
      sponsorship: 'Not required',
      applicationMethod: 'company-form',
      postedAt: '2026-10-01T12:00:00.000Z',
      closingAt: null,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parserVersion: '1.0.0',
      parserConfidence: 0.98,
      extractionWarnings: [],
      rawMetadata: { scrapedBy: 'phase4_test_fixture' },
      dedupHash: 'mock-dedup-hash-445566',
      dedupClusterId: null,
    });
  };

  const createSampleSnapshot = (job: Job): JobContextSnapshot => {
    return JobContextSnapshotSchema.parse({
      companyName: job.companyName,
      roleTitle: job.title,
      originalSourceUrl: job.sourceUrl,
      companyUrl: job.companyUrl,
      location: job.city && job.country ? `${job.city}, ${job.country}` : 'Remote',
      remoteStatus: job.remoteStatus,
      description: job.description,
      responsibilities: job.responsibilities,
      requiredQualifications: job.requiredQualifications,
      preferredQualifications: job.preferredQualifications,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      technologies: job.technologies,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      salaryText: job.salaryText,
      employmentType: job.employmentType,
      seniority: job.seniority,
      extractionTimestamp: job.discoveredAt,
      extractionConfidence: job.parserConfidence,
      extractionWarnings: job.extractionWarnings,
      source: job.source,
      parserVersion: job.parserVersion,
    });
  };

  describe('1. Session Entity Schema & Creation', () => {
    it('creates an ApplicationSession with ACTIVE status and preserves required fields', () => {
      const job = createSampleJob();
      const snapshot = createSampleSnapshot(job);
      const now = new Date().toISOString();

      const sessionData: ApplicationSession = {
        id: crypto.randomUUID(),
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [
          {
            url: job.sourceUrl,
            pageType: 'JOB_POSTING',
            attachedAt: now,
            title: job.title,
          },
        ],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: 'revenue-tech-01',
        selectedCareerProfileVersion: '1.0.0',
        masterProfileVersion: 2,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      const validated = ApplicationSessionSchema.parse(sessionData);
      expect(validated.status).toBe('ACTIVE');
      expect(validated.jobContextSnapshot.companyName).toBe('Mission Inbox');
      expect(validated.jobContextSnapshot.roleTitle).toBe('Senior Revenue Operations Engineer');
      expect(validated.masterProfileVersion).toBe(2);
      expect(validated.associatedPages.length).toBe(1);
      expect(validated.associatedPages[0].pageType).toBe('JOB_POSTING');
    });
    it('supports manually supplied job context without an existing Job record (nullable jobId)', () => {
      const now = new Date().toISOString();
      const manualSnapshot = JobContextSnapshotSchema.parse({
        companyName: 'Boutique Consultancy',
        roleTitle: 'Solutions Architect',
        originalSourceUrl: 'https://example.com/job/custom-99',
        companyUrl: null,
        location: null,
        remoteStatus: 'unknown',
        description: 'Bespoke solutions architecture role.',
        responsibilities: [],
        requiredQualifications: [],
        preferredQualifications: [],
        requiredSkills: ['TypeScript', 'Architecture'],
        preferredSkills: [],
        technologies: ['TypeScript'],
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        salaryText: null,
        employmentType: 'unknown',
        seniority: 'senior',
        extractionTimestamp: now,
        extractionConfidence: null,
        extractionWarnings: [],
        source: 'manual',
        parserVersion: null,
      });

      const session: ApplicationSession = {
        id: crypto.randomUUID(),
        jobId: null,
        status: 'ACTIVE',
        sourceJobUrl: 'https://example.com/job/custom-99',
        applicationUrl: null,
        associatedPages: [],
        jobContextSnapshot: manualSnapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: null,
        selectedCareerProfileVersion: null,
        masterProfileVersion: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      const validated = ApplicationSessionSchema.parse(session);
      expect(validated.jobId).toBeNull();
      expect(validated.jobContextSnapshot.companyName).toBe('Boutique Consultancy');
    });
  });

  describe('2. Persistence and Retrieval', () => {
    it('persists and retrieves an ApplicationSession with exact data fidelity', () => {
      const job = createSampleJob();
      storage.saveJob(job);

      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [
          {
            url: job.sourceUrl,
            pageType: 'JOB_POSTING',
            attachedAt: now,
          },
        ],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: 'software-engineering',
        selectedCareerProfileVersion: null,
        masterProfileVersion: 3,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      const retrieved = storage.getSession(sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(sessionId);
      expect(retrieved?.jobId).toBe(job.id);
      expect(retrieved?.status).toBe('ACTIVE');
      expect(retrieved?.sourceJobUrl).toBe(job.sourceUrl);
      expect(retrieved?.applicationUrl).toBe(job.applicationUrl);
      expect(retrieved?.masterProfileVersion).toBe(3);
      expect(retrieved?.jobContextSnapshot.companyName).toBe('Mission Inbox');
      expect(retrieved?.jobContextSnapshot.requiredSkills).toContain('Golang');

      const active = storage.getActiveSession();
      expect(active).toBeDefined();
      expect(active?.id).toBe(sessionId);

      const allSessions = storage.listSessions();
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].id).toBe(sessionId);

      const filteredByJob = storage.listSessions({ jobId: job.id });
      expect(filteredByJob.length).toBe(1);

      const filteredByNonExistentJob = storage.listSessions({ jobId: crypto.randomUUID() });
      expect(filteredByNonExistentJob.length).toBe(0);
    });
  });

  describe('3. Updates and Timestamps', () => {
    it('updates timestamps when session state or activity changes', () => {
      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const t1 = '2026-10-01T10:00:00.000Z';

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: null,
        associatedPages: [],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: null,
        selectedCareerProfileVersion: null,
        masterProfileVersion: 1,
        createdAt: t1,
        updatedAt: t1,
        lastActivityAt: t1,
      };

      storage.saveSession(session);

      const pausedSession = storage.updateSessionStatus(sessionId, 'PAUSED');
      expect(pausedSession.status).toBe('PAUSED');
      expect(new Date(pausedSession.updatedAt).getTime()).toBeGreaterThan(new Date(t1).getTime());
      expect(new Date(pausedSession.lastActivityAt).getTime()).toBeGreaterThan(new Date(t1).getTime());

      const loaded = storage.getSession(sessionId);
      expect(loaded?.status).toBe('PAUSED');
    });
  });

  describe('4. Valid and Invalid Status Transitions', () => {
    it('validates allowed transitions (ACTIVE -> PAUSED -> ACTIVE -> COMPLETED)', () => {
      expect(isValidSessionTransition('ACTIVE', 'PAUSED')).toBe(true);
      expect(isValidSessionTransition('PAUSED', 'ACTIVE')).toBe(true);
      expect(isValidSessionTransition('ACTIVE', 'COMPLETED')).toBe(true);
      expect(isValidSessionTransition('PAUSED', 'COMPLETED')).toBe(true);
      expect(isValidSessionTransition('ACTIVE', 'CANCELLED')).toBe(true);
      expect(isValidSessionTransition('PAUSED', 'CANCELLED')).toBe(true);
    });

    it('rejects terminal transitions from COMPLETED or CANCELLED', () => {
      expect(isValidSessionTransition('COMPLETED', 'ACTIVE')).toBe(false);
      expect(isValidSessionTransition('COMPLETED', 'PAUSED')).toBe(false);
      expect(isValidSessionTransition('COMPLETED', 'CANCELLED')).toBe(false);

      expect(isValidSessionTransition('CANCELLED', 'ACTIVE')).toBe(false);
      expect(isValidSessionTransition('CANCELLED', 'PAUSED')).toBe(false);
      expect(isValidSessionTransition('CANCELLED', 'COMPLETED')).toBe(false);
    });

    it('throws error in storage when an invalid status transition is attempted', () => {
      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'COMPLETED',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: null,
        selectedCareerProfileVersion: null,
        masterProfileVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      expect(() => {
        storage.updateSessionStatus(sessionId, 'ACTIVE');
      }).toThrow(/Invalid session transition from 'COMPLETED' to 'ACTIVE'/);

      expect(() => {
        storage.saveSession({
          ...session,
          status: 'ACTIVE',
        });
      }).toThrow(/Terminal sessions cannot resume/);
    });
  });
  describe('5. Associated Pages & Non-Destructive URL Preservation', () => {
    it('attaches APPLICATION_PAGE without overwriting the original source job URL', () => {
      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: 'https://www.linkedin.com/jobs/view/123456789/',
        applicationUrl: null,
        associatedPages: [
          {
            url: 'https://www.linkedin.com/jobs/view/123456789/',
            pageType: 'JOB_POSTING',
            attachedAt: now,
            title: 'LinkedIn Job Posting',
          },
        ],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: null,
        selectedCareerProfileVersion: null,
        masterProfileVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      const atsPage: AssociatedPage = {
        url: 'https://boards.greenhouse.io/missioninbox/jobs/445566/apply',
        pageType: 'APPLICATION_PAGE',
        attachedAt: new Date().toISOString(),
        title: 'Greenhouse Application Form',
      };

      const updatedSession = storage.attachPageToSession(sessionId, atsPage);

      // Verify original source URL is permanently preserved
      expect(updatedSession.sourceJobUrl).toBe('https://www.linkedin.com/jobs/view/123456789/');
      // Verify applicationUrl is now populated from the APPLICATION_PAGE
      expect(updatedSession.applicationUrl).toBe('https://boards.greenhouse.io/missioninbox/jobs/445566/apply');
      // Verify both pages are recorded
      expect(updatedSession.associatedPages.length).toBe(2);
      expect(updatedSession.associatedPages[0].pageType).toBe('JOB_POSTING');
      expect(updatedSession.associatedPages[1].pageType).toBe('APPLICATION_PAGE');
    });

    it('rejects attaching pages to completed or cancelled sessions', () => {
      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'CANCELLED',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: null,
        associatedPages: [],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: null,
        selectedCareerProfileVersion: null,
        masterProfileVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      expect(() => {
        storage.attachPageToSession(sessionId, {
          url: 'https://example.com/apply',
          pageType: 'APPLICATION_PAGE',
          attachedAt: now,
        });
      }).toThrow(/Cannot attach page to session in terminal status 'CANCELLED'/);
    });
  });

  describe('6. Preserving Original Job Context When User Overrides Are Added', () => {
    it('stores user corrections separately without mutating or destroying original captured snapshot', () => {
      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: 'software-engineering',
        selectedCareerProfileVersion: null,
        masterProfileVersion: 2,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      const overrides: JobContextOverrides = {
        roleTitle: 'Lead Revenue & Systems Engineer',
        salaryMin: 130000,
        salaryMax: 160000,
        notes: 'Hiring manager confirmed target budget in initial screening',
      };

      const sessionWithOverrides: ApplicationSession = {
        ...session,
        jobContextOverrides: overrides,
        updatedAt: new Date().toISOString(),
      };

      storage.saveSession(sessionWithOverrides);

      const retrieved = storage.getSession(sessionId);
      expect(retrieved).toBeDefined();

      // Original captured snapshot remains completely intact
      expect(retrieved?.jobContextSnapshot.roleTitle).toBe('Senior Revenue Operations Engineer');
      expect(retrieved?.jobContextSnapshot.salaryMin).toBe(110000);
      expect(retrieved?.jobContextSnapshot.salaryMax).toBe(140000);

      // Overrides are stored distinctly
      expect(retrieved?.jobContextOverrides?.roleTitle).toBe('Lead Revenue & Systems Engineer');
      expect(retrieved?.jobContextOverrides?.salaryMin).toBe(130000);
      expect(retrieved?.jobContextOverrides?.salaryMax).toBe(160000);
      expect(retrieved?.jobContextOverrides?.notes).toContain('Hiring manager confirmed');
    });
  });
  describe('7. Profile & Career Brain Relationship Integration', () => {
    it('anchors session to canonical Master Profile version and Career Profile ID', () => {
      const seedPath = path.resolve('./data/source/profile-seed.json');
      const master = SeedMigrator.migrate(seedPath);

      storage.saveMasterProfile(master, 'v1 initial migration');

      const updatedMaster = { ...master, lastUpdated: new Date().toISOString() };
      storage.saveMasterProfile(updatedMaster, 'v2 profile update');

      const history = storage.getProfileHistory(master.id);
      expect(history.length).toBe(2);
      const latestVersionNum = history[0].versionNumber;
      expect(latestVersionNum).toBe(2);

      const job = createSampleJob();
      storage.saveJob(job);
      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [],
        jobContextSnapshot: snapshot,
        jobContextOverrides: null,
        selectedCareerProfileId: 'applied-ai',
        selectedCareerProfileVersion: null,
        masterProfileVersion: latestVersionNum,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      storage.saveSession(session);

      const loaded = storage.getSession(sessionId);
      expect(loaded?.selectedCareerProfileId).toBe('applied-ai');
      expect(loaded?.masterProfileVersion).toBe(2);
    });
  });

  describe('8. Restoration After Backend Restart & Data Compatibility', () => {
    it('restores all session facts seamlessly across database reconnections', () => {
      const tempDbPath = path.resolve('./data/profile/test-temp-session.db');

      const db1 = new JobbyDatabase(tempDbPath);
      const job = createSampleJob();
      db1.saveJob(job);

      const snapshot = createSampleSnapshot(job);
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const session: ApplicationSession = {
        id: sessionId,
        jobId: job.id,
        status: 'ACTIVE',
        sourceJobUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        associatedPages: [
          {
            url: job.sourceUrl,
            pageType: 'JOB_POSTING',
            attachedAt: now,
          },
        ],
        jobContextSnapshot: snapshot,
        jobContextOverrides: { roleTitle: 'Overridden Title' },
        selectedCareerProfileId: 'revenue-tech',
        selectedCareerProfileVersion: '1.0.0',
        masterProfileVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      db1.saveSession(session);
      db1.close();

      // Simulate backend restart
      const db2 = new JobbyDatabase(tempDbPath);
      const reloadedSession = db2.getSession(sessionId);

      expect(reloadedSession).toBeDefined();
      expect(reloadedSession?.id).toBe(sessionId);
      expect(reloadedSession?.status).toBe('ACTIVE');
      expect(reloadedSession?.jobContextSnapshot.companyName).toBe('Mission Inbox');
      expect(reloadedSession?.jobContextOverrides?.roleTitle).toBe('Overridden Title');
      expect(reloadedSession?.associatedPages.length).toBe(1);

      db2.close();

      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
      if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
    });
  });
});

