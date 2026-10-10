import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { MasterProfile, MasterProfileSchema } from '../src/types/master-profile.js';
import { CareerProfile, CareerProfileSchema } from '../src/types/career-profile.js';
import { CareerProfileSelector } from '../src/core/profile-selector.js';

describe('Career Profile Selector & Deterministic/Semantic Alignment', () => {
  let master: MasterProfile;
  let profiles: CareerProfile[];
  let selector: CareerProfileSelector;

  beforeEach(() => {
    const masterPath = path.resolve('./data/profile/master-profile.json');
    master = MasterProfileSchema.parse(JSON.parse(fs.readFileSync(masterPath, 'utf-8')));

    const profilesDir = path.resolve('./data/profile/career-profiles');
    const profileFiles = fs.readdirSync(profilesDir).filter((f) => f.endsWith('.json'));
    profiles = profileFiles.map((file) => {
      const raw = JSON.parse(fs.readFileSync(path.join(profilesDir, file), 'utf-8'));
      return CareerProfileSchema.parse(raw);
    });

    selector = new CareerProfileSelector();
  });

  describe('1. Deterministic Profile Selection by Title & Stack', () => {
    it('classifies "AI Engineer / LLM Engineer" to Applied AI / AI Engineering', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'AI Engineer / LLM Engineer',
          jobDescription: 'Build LLM applications, RAG pipelines, and agentic workflows.',
          requiredSkills: ['Python', 'PyTorch', 'Transformers', 'RAG'],
          seniority: 'Mid-Senior',
          industry: 'Artificial Intelligence',
        },
        { useSemanticAI: false }
      );

      expect(result.selectedProfileTrack).toBe('applied-ai');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.6);
      expect(result.matchedSkills).toContain('Python');
      expect(result.matchedSkills).toContain('PyTorch');
    });

    it('classifies "Backend Software Engineer" to Software Engineering', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'Backend Software Engineer',
          jobDescription: 'Develop scalable backend microservices, REST APIs, and database migrations.',
          requiredSkills: ['Golang', 'PostgreSQL', 'Docker', 'Redis'],
          seniority: 'Senior',
          industry: 'Developer Tools',
        },
        { useSemanticAI: false }
      );

      expect(result.selectedProfileTrack).toBe('software-engineering');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.6);
      expect(result.matchedSkills).toContain('PostgreSQL');
    });

    it('classifies "AI Solutions Engineer / Revenue Operations Engineer" to Revenue Tech', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'AI Solutions Engineer / Revenue Operations Engineer',
          jobDescription: 'Integrate billing infrastructure, Stripe webhooks, CRM workflows, and automation.',
          requiredSkills: ['Stripe', 'HubSpot', 'PostgreSQL', 'Webhooks'],
          seniority: 'Mid-Level',
          industry: 'Fintech',
        },
        { useSemanticAI: false }
      );

      expect(result.selectedProfileTrack).toBe('revenue-tech');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
    });

    it('classifies "Technical Customer Success Manager" to Customer Success', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'Technical Customer Success Manager',
          jobDescription: 'Drive customer onboarding, resolve technical support tickets, and configure customer success platforms.',
          requiredSkills: ['Customer Support', 'Vitally', 'Onboarding', 'API Integration'],
          seniority: 'Mid-Level',
          industry: 'B2B SaaS',
        },
        { useSemanticAI: false }
      );

      expect(result.selectedProfileTrack).toBe('customer-success');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('2. Hybrid Blended Strategy', () => {
    it('detects hybrid blend for roles bridging AI and Software Engineering', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'AI Software Engineer',
          jobDescription: 'Develop scalable backend microservices that host and serve deep learning LLM models.',
          requiredSkills: ['Python', 'Golang', 'PyTorch', 'Docker', 'PostgreSQL'],
          seniority: 'Senior',
          industry: 'Artificial Intelligence',
        },
        { useSemanticAI: false }
      );

      expect(['applied-ai', 'software-engineering']).toContain(result.selectedProfileTrack);
      expect(result.secondaryProfile).toBeDefined();
      expect(result.isHybridStrategy).toBe(true);
      expect(result.hybridStrategyNotes).toContain('Hybrid role detected');
    });
  });

  describe('3. Concerns & Constraints Detection', () => {
    it('flags missing required skills and strict on-site requirements as concerns', async () => {
      const result = await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'Software Engineer',
          jobDescription: 'Maintain enterprise systems in C++ and Kubernetes.',
          requiredSkills: ['C++', 'Kubernetes', 'Golang'],
          locationRemoteRequirements: 'Strictly on-site 5 days a week in New York',
        },
        { useSemanticAI: false }
      );

      expect(result.potentialConcerns.some((c) => c.includes('on-site'))).toBe(true);
      expect(result.missingSkills).toContain('C++');
      expect(result.potentialConcerns.some((c) => c.includes('Missing required skills'))).toBe(true);
    });
  });

  describe('4. Master Profile Immutability Guarantee', () => {
    it('guarantees Master Profile is never mutated during career profile selection', async () => {
      const masterSnapshotBefore = JSON.stringify(master);

      await selector.selectProfile(
        master,
        profiles,
        {
          jobTitle: 'Lead Machine Learning Scientist',
          jobDescription: 'Build multi-modal foundation models and manage team.',
          requiredSkills: ['PyTorch', 'CUDA', 'C++'],
        },
        { useSemanticAI: false }
      );

      const masterSnapshotAfter = JSON.stringify(master);
      expect(masterSnapshotAfter).toBe(masterSnapshotBefore);
    });
  });
});

