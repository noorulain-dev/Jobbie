import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ProfileStorage } from '../src/core/storage.js';
import { ApplicationSessionService } from '../src/core/session-service.js';
import { SeedMigrator } from '../src/core/migrator.js';
import { ProfileProjector } from '../src/core/projector.js';

describe('ApplicationSessionService Operations - Part 1', () => {
  let storage: ProfileStorage;
  let service: ApplicationSessionService;
  const fixturesDir = path.resolve('./tests/fixtures/jobs');

  beforeEach(() => {
    storage = new ProfileStorage({ profileDir: ':memory:' });
    service = new ApplicationSessionService(storage);

    const seedPath = path.resolve('./data/source/profile-seed.json');
    const master = SeedMigrator.migrate(seedPath);
    storage.saveMasterProfile(master, 'Seed baseline');

    const pSWE = ProfileProjector.createCareerProfile(master, {
      id: 'software-engineering',
      track: 'software-engineering',
      name: 'Software Engineering',
      description: 'SWE roles',
      headline: 'SWE Headline',
      narrativeSummary: 'SWE summary',
      targetJobTitles: ['Software Engineer', 'Full Stack Engineer', 'Backend Engineer'],
      primarySkillNames: ['Golang', 'PostgreSQL', 'Docker'],
      secondarySkillNames: [],
    });

    const pAI = ProfileProjector.createCareerProfile(master, {
      id: 'applied-ai',
      track: 'applied-ai',
      name: 'Applied AI',
      description: 'AI roles',
      headline: 'AI Headline',
      narrativeSummary: 'AI summary',
      targetJobTitles: ['AI Engineer', 'Machine Learning Engineer'],
      primarySkillNames: ['Python', 'PyTorch', 'Transformers'],
      secondarySkillNames: [],
    });

    storage.saveCareerProfile(pSWE);
    storage.saveCareerProfile(pAI);
  });

  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
  };

  it('creates an active session and automatically assigns Career Profile from extracted page', async () => {
    const html = loadFixture('greenhouse-job.html');
    const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });

    expect(result.isExisting).toBe(false);
    expect(result.session.status).toBe('ACTIVE');
    expect(result.session.sourceJobUrl).toBe(url);
    expect(result.session.jobContextSnapshot.companyName).toBe('Mission Inbox');
    expect(result.session.jobContextSnapshot.roleTitle).toBe('Revenue Operations Engineer');
    expect(result.session.masterProfileVersion).toBeGreaterThanOrEqual(1);

    expect(result.session.jobId).toBeDefined();
    const persistedJob = storage.getJob(result.session.jobId!);
    expect(persistedJob).toBeDefined();
    expect(persistedJob?.companyName).toBe('Mission Inbox');

    expect(result.session.associatedPages.length).toBe(1);
    expect(result.session.associatedPages[0].pageType).toBe('JOB_POSTING');
    expect(result.session.associatedPages[0].url).toBe(url);
  });

  it('resumes existing session when started again for the same job URL without duplicating', async () => {
    const html = loadFixture('greenhouse-job.html');
    const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const firstResult = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });
    expect(firstResult.isExisting).toBe(false);

    const secondResult = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });

    expect(secondResult.isExisting).toBe(true);
    expect(secondResult.session.id).toBe(firstResult.session.id);
    expect(secondResult.warnings).toContain('Resumed existing active application session.');

    const sessions = storage.listSessions();
    expect(sessions.length).toBe(1);
  });

  it('creates a new session if an earlier session for the job was CANCELLED or COMPLETED', async () => {
    const html = loadFixture('greenhouse-job.html');
    const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const r1 = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });
    service.cancelSession(r1.session.id);

    const r2 = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });

    expect(r2.isExisting).toBe(false);
    expect(r2.session.id).not.toBe(r1.session.id);
    expect(r2.session.status).toBe('ACTIVE');

    const all = storage.listSessions();
    expect(all.length).toBe(2);
    expect(all.some((s) => s.id === r1.session.id && s.status === 'CANCELLED')).toBe(true);
    expect(all.some((s) => s.id === r2.session.id && s.status === 'ACTIVE')).toBe(true);
  });

  it('creates session with warnings when page extraction is incomplete but context is retainable', async () => {
    const sparseHtml = '<html><body><h1>Software Engineer</h1><p>Minimal text</p></body></html>';
    const url = 'https://example.com/careers/se-1';

    const result = await service.startApplicationFromJob({
      pagePayload: { html: sparseHtml, url },
      manualContext: {
        companyName: 'Acme Minimal',
      },
    });

    expect(result.session).toBeDefined();
    expect(result.session.status).toBe('ACTIVE');
    expect(result.session.jobContextSnapshot.companyName).toBe('Acme Minimal');
    expect(result.session.jobContextSnapshot.roleTitle).toBe('Software Engineer');
  });

  it('rejects starting application when page is not a job and has no manual context', async () => {
    const nonJobHtml = loadFixture('non-job-article.html');
    const url = 'https://techblog.io/articles/golang';

    await expect(
      service.startApplicationFromJob({
        pagePayload: { html: nonJobHtml, url },
      })
    ).rejects.toThrow(/does not appear to contain a valid job posting/);
  });

  it('allows setting or changing career profile explicitly on an active session', async () => {
    const html = loadFixture('indeed-job.html');
    const url = 'https://www.indeed.com/viewjob?jk=abcdef12345';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url },
      preferredCareerProfileId: 'software-engineering',
    });
    expect(result.session.selectedCareerProfileId).toBe('software-engineering');

    const updated = service.setCareerProfile(result.session.id, 'applied-ai', '2.0.0');
    expect(updated.selectedCareerProfileId).toBe('applied-ai');
    expect(updated.selectedCareerProfileVersion).toBe('2.0.0');

    const reloaded = service.getSessionById(result.session.id);
    expect(reloaded?.selectedCareerProfileId).toBe('applied-ai');
  });
  it('associates additional application page and updates applicationUrl without overwriting sourceJobUrl', async () => {
    const html = loadFixture('linkedin-job.html');
    const url = 'https://www.linkedin.com/jobs/view/123456789/';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });
    const sessionId = result.session.id;

    expect(result.session.sourceJobUrl).toBe(url);

    const greenhouseApplyUrl = 'https://boards.greenhouse.io/cognitivefoundations/jobs/12345/apply';
    const updated = service.attachPageToSession(sessionId, {
      url: greenhouseApplyUrl,
      pageType: 'APPLICATION_PAGE',
      title: 'Greenhouse Apply Form',
    });

    expect(updated.sourceJobUrl).toBe(url);
    expect(updated.applicationUrl).toBe(greenhouseApplyUrl);
    expect(updated.associatedPages.length).toBe(2);
    expect(updated.associatedPages[1].pageType).toBe('APPLICATION_PAGE');

    // Attaching duplicate URL does not create multiple duplicate entries
    const reAttached = service.attachPageToSession(sessionId, {
      url: greenhouseApplyUrl,
      pageType: 'APPLICATION_PAGE',
    });
    expect(reAttached.associatedPages.length).toBe(2);
  });

  it('applies user corrections via updateSessionJobContext preserving original snapshot', async () => {
    const html = loadFixture('greenhouse-job.html');
    const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });
    const sessionId = result.session.id;

    const updated = service.updateSessionJobContext(sessionId, {
      roleTitle: 'Lead Revenue Engineer',
      salaryMin: 135000,
      salaryMax: 160000,
      notes: 'Confirmed budget range with recruiter',
    });

    expect(updated.jobContextSnapshot.roleTitle).toBe('Revenue Operations Engineer');
    expect(updated.jobContextOverrides?.roleTitle).toBe('Lead Revenue Engineer');
    expect(updated.jobContextOverrides?.salaryMin).toBe(135000);
    expect(updated.jobContextOverrides?.notes).toContain('recruiter');
  });

  it('supports pause, resume, completion, and cancellation lifecycle', async () => {
    const html = loadFixture('greenhouse-job.html');
    const url = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url },
    });
    const sessionId = result.session.id;
    expect(result.session.status).toBe('ACTIVE');

    const paused = service.updateSessionStatus(sessionId, 'PAUSED');
    expect(paused.status).toBe('PAUSED');

    const resumed = service.updateSessionStatus(sessionId, 'ACTIVE');
    expect(resumed.status).toBe('ACTIVE');

    const completed = service.updateSessionStatus(sessionId, 'COMPLETED');
    expect(completed.status).toBe('COMPLETED');

    expect(() => {
      service.updateSessionStatus(sessionId, 'ACTIVE');
    }).toThrow(/Invalid session transition/);
  });

  it('finds existing active session by normalized URL or Job ID and lists recent sessions', async () => {
    const html = loadFixture('greenhouse-job.html');
    const dirtyUrl = 'https://boards.greenhouse.io/missioninbox/jobs/445566?utm_source=linkedin&gh_src=123';
    const cleanUrl = 'https://boards.greenhouse.io/missioninbox/jobs/445566';

    const result = await service.startApplicationFromJob({
      pagePayload: { html, url: cleanUrl },
    });

    const matchedByUrl = service.getExistingSessionForJob({ jobUrl: dirtyUrl });
    expect(matchedByUrl).toBeDefined();
    expect(matchedByUrl?.id).toBe(result.session.id);

    const matchedById = service.getExistingSessionForJob({ jobId: result.session.jobId! });
    expect(matchedById).toBeDefined();
    expect(matchedById?.id).toBe(result.session.id);

    const recent = service.listRecentSessions();
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe(result.session.id);
  });

});

