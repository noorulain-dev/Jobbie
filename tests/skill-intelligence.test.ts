import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { SeedMigrator } from '../src/core/migrator.js';
import { SkillIntelligenceService } from '../src/core/skill-intelligence.js';
import { ProvenanceGuard } from '../src/core/provenance-guard.js';
import { MasterProfile } from '../src/types/master-profile.js';

describe('Skill Intelligence Enrichment, Inference & Approval Workflow', () => {
  let master: MasterProfile;
  let service: SkillIntelligenceService;

  beforeEach(() => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    master = SeedMigrator.migrate(seedPath);
    service = new SkillIntelligenceService();
  });

  it('builds a canonical skill registry maintaining known skills vs claimability', () => {
    const registry = service.buildRegistry(master);
    expect(registry.length).toBe(master.skills.length);

    const reactEntry = registry.find((r) => r.canonicalName === 'React');
    expect(reactEntry).toBeDefined();
    expect(reactEntry?.status).toBe('EXPLICIT_KNOWN');
    expect(reactEntry?.claimability.canClaimOnResume).toBe(true);
    expect(reactEntry?.claimability.canClaimOnScreening).toBe(true);
    expect(reactEntry?.aliases).toContain('React.js');
    expect(reactEntry?.evidence.length).toBeGreaterThan(0);
  });

  it('discovers inferred skills (e.g. React -> HTML, CSS) without mutating Master Profile', async () => {
    const originalSkillCount = master.skills.length;
    const suggestions = await service.discoverInferredSkills(master, { useSemanticAI: false });

    expect(master.skills.length).toBe(originalSkillCount);
    expect(suggestions.length).toBeGreaterThan(0);

    const htmlSuggestion = suggestions.find((s) => s.canonicalName === 'HTML');
    expect(htmlSuggestion).toBeDefined();
    expect(htmlSuggestion?.status).toBe('INFERRED_KNOWN');
    expect(htmlSuggestion?.derivedFromSkill).toBe('React');
    expect(htmlSuggestion?.evidence.length).toBeGreaterThan(0);

    const cssSuggestion = suggestions.find((s) => s.canonicalName === 'CSS');
    expect(cssSuggestion).toBeDefined();
    expect(cssSuggestion?.derivedFromSkill).toBe('React');
  });

  it('approves an inferred skill, converting it to USER_APPROVED_KNOWN with full evidence for future use', async () => {
    const suggestions = await service.discoverInferredSkills(master, { useSemanticAI: false });
    const htmlSuggestion = suggestions.find((s) => s.canonicalName === 'HTML')!;

    const { updatedMaster, newSkill } = service.approveInferredSkill(
      master,
      htmlSuggestion,
      'User verified: Core HTML5/DOM proficiency from Mission Inbox UI work'
    );

    expect(newSkill.name).toBe('HTML');
    expect(newSkill.status).toBe('USER_APPROVED_KNOWN');
    expect(newSkill.provenance.provenance).toBe('inferred-but-user-approved');
    expect(newSkill.provenance.approvedByUser).toBe(true);
    expect(newSkill.evidence.length).toBeGreaterThan(0);

    const claimCheck = ProvenanceGuard.canClaimSkill(newSkill, 'resume');
    expect(claimCheck.allowed).toBe(true);
    expect(updatedMaster.skills.length).toBe(master.skills.length + 1);

    const nextSuggestions = await service.discoverInferredSkills(updatedMaster, { useSemanticAI: false });
    expect(nextSuggestions.some((s) => s.canonicalName === 'HTML')).toBe(false);
  });

  it('maintains LEARNING_TARGET skills and NEVER merges them into claimable known skills', () => {
    const { updatedMaster, learningSkill } = service.markAsLearningTarget(
      master,
      'Rust',
      'programming_languages',
      'Currently reading The Rust Book'
    );

    expect(learningSkill.name).toBe('Rust');
    expect(learningSkill.status).toBe('LEARNING_TARGET');
    expect(learningSkill.provenance.provenance).toBe('learning-target');

    const resumeCheck = ProvenanceGuard.canClaimSkill(learningSkill, 'resume');
    expect(resumeCheck.allowed).toBe(false);
    expect(resumeCheck.reason).toContain('cannot be claimed as active or past work experience');

    const screeningCheck = ProvenanceGuard.canClaimSkill(learningSkill, 'screening');
    expect(screeningCheck.allowed).toBe(false);

    const planCheck = ProvenanceGuard.canClaimSkill(learningSkill, 'learning_plan');
    expect(planCheck.allowed).toBe(true);

    const registry = service.buildRegistry(updatedMaster);
    const rustEntry = registry.find((r) => r.canonicalName === 'Rust')!;
    expect(rustEntry.claimability.canClaimOnResume).toBe(false);
    expect(rustEntry.claimability.reason).toContain('Learning target in progress');
  });

  it('enforces DO_NOT_CLAIM prohibitions strictly', () => {
    const { updatedMaster, prohibitedSkill } = service.prohibitClaim(
      master,
      'Solidity',
      'Do not want web3/blockchain development roles'
    );

    expect(prohibitedSkill.name).toBe('Solidity');
    expect(prohibitedSkill.status).toBe('DO_NOT_CLAIM');
    expect(prohibitedSkill.provenance.provenance).toBe('prohibited-from-claiming');

    const checkResume = ProvenanceGuard.canClaimSkill(prohibitedSkill, 'resume');
    expect(checkResume.allowed).toBe(false);
    expect(checkResume.reason).toContain('strictly prohibited from claiming this skill');

    const checkScreening = ProvenanceGuard.canClaimSkill(prohibitedSkill, 'screening');
    expect(checkScreening.allowed).toBe(false);

    const checkPlan = ProvenanceGuard.canClaimSkill(prohibitedSkill, 'learning_plan');
    expect(checkPlan.allowed).toBe(false);

    const registry = service.buildRegistry(updatedMaster);
    const solidityEntry = registry.find((r) => r.canonicalName === 'Solidity')!;
    expect(solidityEntry.claimability.canClaimOnResume).toBe(false);
    expect(solidityEntry.claimability.reason).toContain('Prohibited by user directive');
  });
});

