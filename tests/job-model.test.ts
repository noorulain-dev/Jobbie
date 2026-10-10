import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  normalizeCompanyName,
  normalizeJobTitle,
  normalizeJobUrl,
  normalizeJobLocation,
  normalizeTechnologyName,
  extractSeniorityLevel,
  computeJobDedupHash,
} from '../src/core/job-normalizer.js';
import { Job, JobSchema } from '../src/types/job.js';
import { JobSnapshot, JobSnapshotSchema } from '../src/types/job-snapshot.js';
import { JobDedupCluster, JobDedupClusterSchema } from '../src/types/job-dedup.js';
import { ProfileStorage } from '../src/core/storage.js';

describe('Phase 3 Job Data Model, Normalization & Snapshot Persistence', () => {
  let storage: ProfileStorage;

  beforeEach(() => {
    storage = new ProfileStorage({ profileDir: ':memory:' });
  });

  describe('1. Deterministic Company Normalization', () => {
    it('normalizes corporate legal entity suffixes and punctuation cleanly', () => {
      expect(normalizeCompanyName('Acme Technologies, Inc.')).toBe('acme');
      expect(normalizeCompanyName('Acme Tech LLC')).toBe('acme');
      expect(normalizeCompanyName('Acme Corporation')).toBe('acme');
      expect(normalizeCompanyName('Google LLC')).toBe('google');
      expect(normalizeCompanyName('Mission Inbox Ltd.')).toBe('mission inbox');
      expect(normalizeCompanyName('Shopify Inc')).toBe('shopify');
      expect(normalizeCompanyName('Stripe Payments Company')).toBe('stripe payments');
    });

    it('preserves core distinguishing company names', () => {
      expect(normalizeCompanyName('Amazon Web Services')).toBe('amazon web');
      expect(normalizeCompanyName('OpenAI')).toBe('openai');
    });
  });

  describe('2. Deterministic Job Title Normalization', () => {
    it('normalizes Roman numerals, levels, and punctuation for matching', () => {
      expect(normalizeJobTitle('Software Engineer II')).toBe('software engineer 2');
      expect(normalizeJobTitle('Software Engineer 2')).toBe('software engineer 2');
      expect(normalizeJobTitle('Software Engineer, II')).toBe('software engineer 2');
      expect(normalizeJobTitle('Senior Backend Engineer')).toBe('senior backend engineer');
      expect(normalizeJobTitle('Sr. Backend Engineer')).toBe('senior backend engineer');
      expect(normalizeJobTitle('Snr Backend Engineer')).toBe('senior backend engineer');
      expect(normalizeJobTitle('Lead/Staff Systems Engineer')).toBe('lead systems engineer');
      expect(normalizeJobTitle('AI/ML Engineer')).toBe('ai ml engineer');
    });

    it('extracts seniority levels deterministically', () => {
      expect(extractSeniorityLevel('Senior Software Engineer')).toBe('senior');
      expect(extractSeniorityLevel('Staff Engineer')).toBe('staff');
      expect(extractSeniorityLevel('Principal AI Researcher')).toBe('principal');
      expect(extractSeniorityLevel('Junior Web Developer')).toBe('entry');
      expect(extractSeniorityLevel('Software Engineering Intern')).toBe('intern');
      expect(extractSeniorityLevel('Engineering Team Lead')).toBe('lead');
      expect(extractSeniorityLevel('VP of Engineering')).toBe('executive');
      expect(extractSeniorityLevel('Software Engineer II')).toBe('mid');
    });
  });

  describe('3. Deterministic URL Normalization & Sanitization', () => {
    it('strips tracking parameters, referral tokens, and trailing slashes', () => {
      const dirty1 = 'https://jobs.lever.co/company/12345/?utm_source=linkedin&gh_src=abc&ref=jobboard';
      const clean1 = normalizeJobUrl(dirty1);
      expect(clean1).toBe('https://jobs.lever.co/company/12345');

      const dirty2 = 'https://www.linkedin.com/jobs/view/987654321/?currentJobId=987654321&trackingId=abc%3D%3D&refId=xyz';
      const clean2 = normalizeJobUrl(dirty2);
      expect(clean2).toBe('https://www.linkedin.com/jobs/view/987654321');

      const trailing = 'https://boards.greenhouse.io/acme/jobs/55555///';
      expect(normalizeJobUrl(trailing)).toBe('https://boards.greenhouse.io/acme/jobs/55555');
    });
  });

  describe('4. Deterministic Location & Remote Normalization', () => {
    it('normalizes permutations of remote and country locations consistently', () => {
      const l1 = normalizeJobLocation('Remote - Canada');
      const l2 = normalizeJobLocation('Canada - Remote');
      const l3 = normalizeJobLocation('Remote (Canada)');

      expect(l1.country).toBe('Canada');
      expect(l1.remoteStatus).toBe('remote');
      expect(l2.country).toBe('Canada');
      expect(l2.remoteStatus).toBe('remote');
      expect(l3.country).toBe('Canada');
      expect(l3.remoteStatus).toBe('remote');

      expect(l1.canonicalString).toBe(l2.canonicalString);
      expect(l2.canonicalString).toBe(l3.canonicalString);
      expect(l1.canonicalString).toBe('canada:remote');
    });

    it('identifies hybrid and on-site statuses with regions', () => {
      const h1 = normalizeJobLocation('Toronto, Ontario, Canada (Hybrid)');
      expect(h1.city).toBe('Toronto');
      expect(h1.region).toBe('Ontario');
      expect(h1.country).toBe('Canada');
      expect(h1.remoteStatus).toBe('hybrid');

      const o1 = normalizeJobLocation('San Francisco, CA - On-site');
      expect(o1.city).toBe('San Francisco');
      expect(o1.region).toBe('California');
      expect(o1.remoteStatus).toBe('onsite');
    });
  });

  describe('5. Technology & Skill Name Normalization', () => {
    it('maps tech stacks to canonical names while preserving context', () => {
      expect(normalizeTechnologyName('react.js')).toBe('React');
      expect(normalizeTechnologyName('ReactJS')).toBe('React');
      expect(normalizeTechnologyName('Go language')).toBe('Golang');
      expect(normalizeTechnologyName('NodeJS')).toBe('Node.js');
      expect(normalizeTechnologyName('postgres')).toBe('PostgreSQL');
      expect(normalizeTechnologyName('k8s')).toBe('Kubernetes');
    });
  });

  describe('6. Deduplication Hash Computation', () => {
    it('produces identical dedup hash for same job posted across platforms', () => {
      const hashLinkedIn = computeJobDedupHash({
        companyName: 'Acme Inc.',
        jobTitle: 'Software Engineer II',
        rawLocation: 'Canada - Remote',
      });

      const hashDirectATS = computeJobDedupHash({
        companyName: 'Acme LLC',
        jobTitle: 'Software Engineer, II',
        rawLocation: 'Remote (Canada)',
      });

      expect(hashLinkedIn).toBe(hashDirectATS);
    });
  });

  describe('7. Job Entity Schema & Storage Persistence', () => {
    it('creates, parses, validates and persists a comprehensive Job entity', () => {
      const rawTitle = 'Senior AI / LLM Engineer (Remote)';
      const rawCompany = 'Cognitive Foundations Technologies Inc.';
      const rawLoc = 'Toronto, Ontario, Canada - Remote';

      const jobData: Job = {
        id: crypto.randomUUID(),
        source: 'linkedin',
        sourceJobId: '394857210',
        sourceUrl: 'https://www.linkedin.com/jobs/view/394857210/?utm_source=feed',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/394857210',
        applicationUrl: 'https://boards.greenhouse.io/cognitivefoundations/jobs/112233',

        companyName: rawCompany,
        companyUrl: 'https://cognitivefoundations.ai',
        normalizedCompany: normalizeCompanyName(rawCompany),

        title: rawTitle,
        normalizedTitle: normalizeJobTitle(rawTitle),
        department: 'Artificial Intelligence',
        seniority: extractSeniorityLevel(rawTitle),

        remoteStatus: 'remote',
        locations: ['Toronto, Canada', 'Remote'],
        country: 'Canada',
        region: 'Ontario',
        city: 'Toronto',

        salaryMin: 120000,
        salaryMax: 160000,
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
        salaryText: '$120,000 - $160,000 / year + equity',

        employmentType: 'full-time',
        description: 'Build production deep learning models and low-latency RAG inference pipelines.',
        responsibilities: [
          'Design and deploy RAG pipelines using Transformers and vector stores',
          'Optimize LLM inference latency to <100ms in production',
        ],
        requiredQualifications: [
          'B.Sc. or M.Sc. in Computer Science or equivalent',
          '3+ years deploying deep learning or backend systems',
        ],
        preferredQualifications: ['Hands-on experience with PyTorch and Vision Transformers'],
        benefits: ['Full health coverage', 'Remote work stipend', 'Flexible vacation'],

        requiredSkills: ['Python', 'PyTorch', 'Transformers', 'Docker'],
        preferredSkills: ['RAG', 'PostgreSQL', 'Golang'],
        technologies: ['Python', 'PyTorch', 'Transformers', 'Docker', 'PostgreSQL', 'Golang'],
        yearsExperience: 3,
        educationRequirements: "Master's or Bachelor's in CS",
        workAuthorization: 'Authorized to work in Canada or US',
        sponsorship: 'Not provided',

        applicationMethod: 'ats-redirect',
        postedAt: '2026-10-01T12:00:00.000Z',
        closingAt: null,
        discoveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        parserVersion: '1.0.0',
        parserConfidence: 0.98,
        extractionWarnings: [],
        rawMetadata: { scrapedBy: 'phase3_test_fixture' },

        dedupHash: computeJobDedupHash({
          companyName: rawCompany,
          jobTitle: rawTitle,
          rawLocation: rawLoc,
        }),
        dedupClusterId: null,
      };

      const validated = JobSchema.parse(jobData);
      expect(validated.normalizedCompany).toBe('cognitive foundations');
      expect(validated.normalizedTitle).toBe('senior ai llm engineer remote');
      expect(validated.seniority).toBe('senior');

      // Save to SQLite
      storage.saveJob(validated);

      const retrieved = storage.getJob(validated.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(validated.id);
      expect(retrieved?.companyName).toBe(rawCompany);
      expect(retrieved?.salaryMax).toBe(160000);
      expect(retrieved?.requiredSkills).toContain('PyTorch');

      // Lookup by dedup hash
      const foundByHash = storage.findJobByDedupHash(validated.dedupHash);
      expect(foundByHash).toBeDefined();
      expect(foundByHash?.id).toBe(validated.id);
    });
  });
  describe('8. Job Snapshots & Point-in-Time Audit Integrity', () => {
    it('creates immutable snapshots and detects content hash changes', () => {
      const jobId = crypto.randomUUID();
      const job: Job = {
        id: jobId,
        source: 'greenhouse',
        sourceJobId: '12345',
        sourceUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
        canonicalUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
        applicationUrl: 'https://boards.greenhouse.io/acme/jobs/12345',
        companyName: 'Acme',
        normalizedCompany: 'acme',
        companyUrl: null,
        title: 'Full Stack Engineer',
        normalizedTitle: 'full stack engineer',
        department: null,
        seniority: 'mid',
        remoteStatus: 'remote',
        locations: ['Remote'],
        country: 'Canada',
        region: null,
        city: null,
        salaryMin: 100000,
        salaryMax: null,
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
        salaryText: '$100,000',
        employmentType: 'full-time',
        description: 'Full Stack Engineer with Golang & React.',
        responsibilities: [],
        requiredQualifications: [],
        preferredQualifications: [],
        benefits: [],
        requiredSkills: ['Golang', 'React'],
        preferredSkills: [],
        technologies: ['Golang', 'React'],
        yearsExperience: 2,
        educationRequirements: null,
        workAuthorization: null,
        sponsorship: null,
        applicationMethod: 'company-form',
        postedAt: '2026-10-01T10:00:00.000Z',
        closingAt: null,
        discoveredAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
        parserVersion: '1.0.0',
        parserConfidence: 1.0,
        extractionWarnings: [],
        rawMetadata: {},
        dedupHash: 'mock-hash-12345',
        dedupClusterId: null,
      };

      storage.saveJob(job);

      const initialText = 'Full Stack Engineer with Golang & React. Compensation: $100k.';
      const hash1 = crypto.createHash('sha256').update(initialText).digest('hex');

      const snapshot1: JobSnapshot = {
        id: crypto.randomUUID(),
        jobId,
        snapshotTimestamp: '2026-10-01T10:00:00.000Z',
        contentHash: hash1,
        cleanTextContent: initialText,
        parsedStateJson: JSON.stringify({ title: 'Full Stack Engineer', salaryMin: 100000 }),
        changeDelta: ['Initial snapshot created'],
      };

      storage.saveJobSnapshot(snapshot1);


      const modifiedText = 'Full Stack Engineer with Golang, React & Kubernetes. Compensation: $115k.';
      const hash2 = crypto.createHash('sha256').update(modifiedText).digest('hex');
      expect(hash1).not.toBe(hash2);

      const snapshot2: JobSnapshot = {
        id: crypto.randomUUID(),
        jobId,
        snapshotTimestamp: '2026-10-15T10:00:00.000Z',
        contentHash: hash2,
        cleanTextContent: modifiedText,
        parsedStateJson: JSON.stringify({ title: 'Full Stack Engineer', salaryMin: 115000, newSkill: 'Kubernetes' }),
        changeDelta: ['salaryMin: 100000 -> 115000', 'added requirement: Kubernetes'],
      };

      storage.saveJobSnapshot(snapshot2);

      const snapshots = storage.getJobSnapshots(jobId);
      expect(snapshots.length).toBe(2);
      expect(snapshots[0].contentHash).toBe(hash2);
      expect(snapshots[1].contentHash).toBe(hash1);
      expect(snapshots[0].changeDelta).toContain('added requirement: Kubernetes');
    });
  });

  describe('9. Deduplication Clustering', () => {
    it('clusters multiple postings of the same job under a unified cluster ID', () => {
      const clusterId = crypto.randomUUID();
      const primaryJobId = crypto.randomUUID();
      const dedupHash = 'a1b2c3d4e5f6';

      const cluster: JobDedupCluster = {
        clusterId,
        primaryJobId,
        dedupHash,
        companyNormalized: 'mission inbox',
        titleNormalized: 'senior software engineer',
        locationNormalized: 'canada:remote',
        memberJobIds: [primaryJobId, crypto.randomUUID(), crypto.randomUUID()],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-06T00:00:00.000Z',
      };

      const validated = JobDedupClusterSchema.parse(cluster);
      storage.saveDedupCluster(validated);

      const loaded = storage.getDedupCluster(clusterId);
      expect(loaded).toBeDefined();
      expect(loaded?.primaryJobId).toBe(primaryJobId);
      expect(loaded?.memberJobIds.length).toBe(3);
    });
  });
});

