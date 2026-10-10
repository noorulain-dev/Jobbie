import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { SeedMigrator } from '../src/core/migrator.js';
import { ProfileStorage } from '../src/core/storage.js';
import { ProvenanceGuard } from '../src/core/provenance-guard.js';
import { MasterProfile } from '../src/types/master-profile.js';
import { computeProfileDiff } from '../src/core/profile-differ.js';

describe('Profile Versioning, Provenance & Rollback Integrity', () => {
  let storage: ProfileStorage;
  let baseMaster: MasterProfile;

  beforeEach(() => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    baseMaster = SeedMigrator.migrate(seedPath);
    storage = new ProfileStorage({ profileDir: ':memory:' });
  });

  it('records initial version entry on profile creation', () => {
    storage.saveMasterProfile(baseMaster, 'Initial baseline migration', {
      changeSource: 'RESUME_IMPORT',
      actor: 'system',
    });

    const history = storage.getProfileHistory(baseMaster.id);
    expect(history.length).toBe(1);
    expect(history[0].versionNumber).toBe(1);
    expect(history[0].changeSource).toBe('RESUME_IMPORT');
    expect(history[0].actor).toBe('system');
    expect(history[0].changeReason).toBe('Initial baseline migration');
    expect(history[0].fieldsChanged.length).toBeGreaterThan(0);
  });

  it('tracks field diffs, previous value, and new value across updates', () => {
    storage.saveMasterProfile(baseMaster, 'v1 initial', {
      changeSource: 'USER_ENTERED',
      actor: 'user',
    });

    const modified = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;
    modified.personal.city = 'Vancouver';
    modified.screening.targetSalary = '$150,000/year';
    modified.screening.noticePeriod = '2 weeks';

    storage.saveMasterProfile(modified, 'Relocating to Vancouver and updated salary expectations', {
      changeSource: 'USER_ENTERED',
      actor: 'user',
    });

    const history = storage.getProfileHistory(baseMaster.id);
    expect(history.length).toBe(2);

    const latest = history[0];
    expect(latest.versionNumber).toBe(2);
    expect(latest.changeReason).toContain('Vancouver');

    const cityDiff = latest.fieldsChanged.find((f) => f.fieldPath === 'personal.city');
    expect(cityDiff).toBeDefined();
    expect(cityDiff?.previousValue).toBe('Toronto');
    expect(cityDiff?.newValue).toBe('Vancouver');

    const salaryDiff = latest.fieldsChanged.find((f) => f.fieldPath === 'screening.targetSalary');
    expect(salaryDiff).toBeDefined();
    expect(salaryDiff?.previousValue).toBe('$2,500/month');
  });

  it('performs rollback to an older Master Profile version and restores data integrity', () => {
    // Version 1
    storage.saveMasterProfile(baseMaster, 'v1 baseline', { changeSource: 'USER_ENTERED' });

    // Version 2: Update personal info
    const v2 = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;
    v2.personal.firstName = 'Alexander';
    v2.personal.email = 'alexander@example.com';
    storage.saveMasterProfile(v2, 'v2 rename', { changeSource: 'USER_ENTERED' });

    // Version 3: Update screening
    const v3 = JSON.parse(JSON.stringify(v2)) as MasterProfile;
    v3.screening.workAuthorization = 'Pending PR';
    storage.saveMasterProfile(v3, 'v3 work authorization update', { changeSource: 'USER_ENTERED' });

    let current = storage.getMasterProfile();
    expect(current?.personal.firstName).toBe('Alexander');
    expect(current?.screening.workAuthorization).toBe('Pending PR');

    const historyBeforeRollback = storage.getProfileHistory(baseMaster.id);
    expect(historyBeforeRollback.length).toBe(3);

    // Find version 1 history id
    const v1Entry = historyBeforeRollback.find((h) => h.versionNumber === 1);
    expect(v1Entry).toBeDefined();

    // Rollback to v1
    const restored = storage.rollbackMasterProfile(v1Entry!.id!, 'Rollback to v1 initial baseline');
    expect(restored.personal.firstName).toBe('Noor ul Ain');
    expect(restored.personal.email).toBe(baseMaster.personal.email);
    expect(restored.screening.workAuthorization).toBe(baseMaster.screening.workAuthorization);

    // Verify current profile in storage is restored
    const activeInStorage = storage.getMasterProfile();
    expect(activeInStorage?.personal.firstName).toBe('Noor ul Ain');
    expect(activeInStorage?.personal.email).toBe(baseMaster.personal.email);

    // Verify that the rollback created a new history entry (v4) documenting the restore
    const historyAfterRollback = storage.getProfileHistory(baseMaster.id);
    expect(historyAfterRollback.length).toBe(4);
    expect(historyAfterRollback[0].versionNumber).toBe(4);
    expect(historyAfterRollback[0].changeReason).toContain('Rollback to v1');
  });

  it('enforces that LLM-generated suggestions NEVER appear as verified facts without explicit user approval', () => {
    // Scenario A: An unapproved LLM suggestion attempting to enter as inferred-but-user-approved without approvedByUser
    const maliciousAiFactProfile = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;
    maliciousAiFactProfile.skills.push({
      id: '99999999-9999-9999-9999-999999999999',
      name: 'Kubernetes Multi-Cluster',
      category: 'cloud_infrastructure',
      status: 'INFERRED_KNOWN',
      aliases: [],
      evidence: [],
      provenance: {
        provenance: 'inferred-but-user-approved',
        sourceRef: 'SYSTEM_GENERATED_SUGGESTION',
        approvedByUser: false,
      },
    });

    const violations = ProvenanceGuard.validateNoUnapprovedInferences(maliciousAiFactProfile);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.reason.includes('explicit user approval'))).toBe(true);
  });

  it('allows verified facts with valid provenance sources', () => {
    const approvedProfile = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;
    approvedProfile.skills.push({
      id: '88888888-8888-8888-8888-888888888888',
      name: 'HTML5',
      category: 'frameworks_libraries',
      status: 'USER_APPROVED_KNOWN',
      aliases: [],
      evidence: [],
      provenance: {
        provenance: 'inferred-but-user-approved',
        sourceRef: 'suggestion:html:React',
        approvedByUser: true,
      },
    });

    const violations = ProvenanceGuard.validateNoUnapprovedInferences(approvedProfile);
    expect(violations.length).toBe(0);
  });

  it('computes accurate diffs when items are added, updated, or removed', () => {
    const p1 = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;
    const p2 = JSON.parse(JSON.stringify(baseMaster)) as MasterProfile;

    p2.education[0].status = 'Completed';
    p2.projects.push({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Autonomous Agent X',
      url: 'https://example.com/agent',
      dates: '2026',
      description: 'New autonomous agent.',
      technologies: ['TypeScript'],
      domain: 'AI',
      measurableOutcomes: [],
      provenance: {
        provenance: 'user-entered',
        sourceRef: 'ui_form',
        approvedByUser: true,
      },
    });

    const diffs = computeProfileDiff(p1, p2);
    expect(diffs.some((d) => d.fieldPath.includes('education') && d.action === 'updated')).toBe(true);
    expect(diffs.some((d) => d.fieldPath.includes('Autonomous Agent X') && d.action === 'created')).toBe(true);
  });
});

