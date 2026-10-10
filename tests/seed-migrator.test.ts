import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SeedMigrator } from '../src/core/migrator.js';

describe('Seed Migration & Evidence Linking', () => {
  it('correctly ingests seed data as user-entered with aliases and evidence', () => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    const profile = SeedMigrator.migrate(seedPath);

    // Provenance Check
    expect(profile.personal.provenance.provenance).toBe('user-entered');
    expect(profile.personal.firstName).toBe('Noor ul Ain');
    expect(profile.personal.lastName).toBe('Khurshid');

    // Experience checks
    expect(profile.experience.length).toBeGreaterThan(0);
    const missionInbox = profile.experience.find((e) => e.company === 'Mission Inbox');
    expect(missionInbox).toBeDefined();
    expect(missionInbox?.provenance.provenance).toBe('user-entered');

    // Skills & Aliases check
    const reactSkill = profile.skills.find((s) => s.name === 'React');
    expect(reactSkill).toBeDefined();
    expect(reactSkill?.status).toBe('EXPLICIT_KNOWN');
    expect(reactSkill?.aliases).toContain('React.js');
    expect(reactSkill?.aliases).toContain('ReactJS');

    // Evidence check
    expect(reactSkill?.evidence.length).toBeGreaterThan(0);

    // Verify Golang aliases
    const goSkill = profile.skills.find((s) => s.name === 'Golang');
    expect(goSkill).toBeDefined();
    expect(goSkill?.aliases).toContain('Go');

    // Screening check
    expect(profile.screening.workAuthorization).toBe('Yes');
    expect(profile.screening.sponsorshipRequired).toBe('No');
  });
});
