import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SeedMigrator } from '../src/core/migrator.js';
import { ProvenanceGuard } from '../src/core/provenance-guard.js';
import { SkillItem } from '../src/types/master-profile.js';

describe('Provenance Guard & Negative Assertions', () => {
  const seedPath = path.resolve('./data/source/profile-seed.json');
  const master = SeedMigrator.migrate(seedPath);

  it('rejects attempt to invent a fake employer', () => {
    const maliciousUpdate = {
      experience: [
        {
          id: 'fake-id',
          company: 'Google Silicon Valley',
          title: 'Principal AI Architect',
          normalizedRole: 'Principal Architect',
          startDate: '2020',
          endDate: '2023',
          location: 'Mountain View, CA',
          employmentType: 'Full-time' as const,
          bulletPoints: [],
          technologies: [],
          domains: [],
          measurableAchievements: [],
          provenance: {
            provenance: 'inferred-but-user-approved' as const,
            sourceRef: 'ai_hallucination',
            approvedByUser: false,
          },
        },
      ],
    };

    const violations = ProvenanceGuard.validateNoCredentialFabrication(master, maliciousUpdate);
    expect(violations.length).toBe(1);
    expect(violations[0].field).toBe('experience.company');
    expect(violations[0].reason).toContain("attempted to invent a new employer 'Google Silicon Valley'");
  });

  it('rejects attempt to invent an educational institution', () => {
    const maliciousUpdate = {
      education: [
        {
          id: 'fake-id',
          degree: 'Ph.D. in Computer Science',
          major: 'AI',
          institution: 'Stanford University',
          location: 'Stanford, CA',
          status: 'Completed' as const,
          coursework: [],
          provenance: {
            provenance: 'inferred-but-user-approved' as const,
            sourceRef: 'ai_hallucination',
            approvedByUser: false,
          },
        },
      ],
    };

    const violations = ProvenanceGuard.validateNoCredentialFabrication(master, maliciousUpdate);
    expect(violations.length).toBe(1);
    expect(violations[0].field).toBe('education.institution');
    expect(violations[0].reason).toContain("Stanford University");
  });

  it('blocks DO_NOT_CLAIM skills from being claimed on resume or screening', () => {
    const forbiddenSkill: SkillItem = {
      id: 'skill-forbidden',
      name: 'Cobol',
      category: 'programming_languages',
      status: 'DO_NOT_CLAIM',
      aliases: [],
      evidence: [],
      provenance: {
        provenance: 'prohibited-from-claiming',
        sourceRef: 'user_directive',
        approvedByUser: true,
      },
    };

    const resumeCheck = ProvenanceGuard.canClaimSkill(forbiddenSkill, 'resume');
    expect(resumeCheck.allowed).toBe(false);
    expect(resumeCheck.reason).toContain('DO_NOT_CLAIM');

    const screeningCheck = ProvenanceGuard.canClaimSkill(forbiddenSkill, 'screening');
    expect(screeningCheck.allowed).toBe(false);
  });

  it('blocks LEARNING_TARGET skills from being claimed as work experience', () => {
    const learningSkill: SkillItem = {
      id: 'skill-learning',
      name: 'Rust',
      category: 'programming_languages',
      status: 'LEARNING_TARGET',
      aliases: [],
      evidence: [],
      provenance: {
        provenance: 'learning-target',
        sourceRef: 'user_goals',
        approvedByUser: true,
      },
    };

    const resumeCheck = ProvenanceGuard.canClaimSkill(learningSkill, 'resume');
    expect(resumeCheck.allowed).toBe(false);
    expect(resumeCheck.reason).toContain('cannot be claimed as active or past work experience');

    const planCheck = ProvenanceGuard.canClaimSkill(learningSkill, 'learning_plan');
    expect(planCheck.allowed).toBe(true);
  });
});
