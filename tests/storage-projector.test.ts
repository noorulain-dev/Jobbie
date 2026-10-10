import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { ProfileStorage } from '../src/core/storage.js';
import { SeedMigrator } from '../src/core/migrator.js';
import { ProfileProjector } from '../src/core/projector.js';

describe('Profile Storage & Projection Isolation', () => {
  let storage: ProfileStorage;

  beforeEach(() => {
    storage = new ProfileStorage({ profileDir: ':memory:' });
  });

  afterEach(() => {
    storage.close();
  });

  it('persists and retrieves master profile via SQLite without data loss', () => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    const master = SeedMigrator.migrate(seedPath);

    storage.saveMasterProfile(master, 'Test Master Save');
    const loaded = storage.getMasterProfile();

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(master.id);
    expect(loaded?.personal.email).toBe(master.personal.email);
    expect(loaded?.skills.length).toBe(master.skills.length);
  });

  it('creates career profile projections without mutating the Master Profile', () => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    const master = SeedMigrator.migrate(seedPath);
    storage.saveMasterProfile(master);

    const initialMasterSkillsCount = master.skills.length;

    const sweProjection = ProfileProjector.createCareerProfile(master, {
      track: 'software-engineering',
      name: 'Software Engineering Track',
      description: 'Focus on distributed backend systems in Go and TypeScript',
      headline: 'Full Stack & Systems Engineer',
      narrativeSummary: 'Focus on distributed systems and Go/TypeScript.',
      targetJobTitles: ['Backend Engineer'],
      primarySkillNames: ['Golang', 'PostgreSQL'],
      secondarySkillNames: ['Docker'],
      deemphasizedSkillNames: ['Roblox'],
      highlightedProjectNames: ['MI Shield'],
    });

    storage.saveCareerProfile(sweProjection);

    const loadedCareer = storage.getCareerProfile(sweProjection.id);
    expect(loadedCareer).toBeDefined();
    expect(loadedCareer?.name).toBe('Software Engineering Track');
    expect(loadedCareer?.primarySkillIds.length).toBe(2);

    // Verify master profile is completely unaffected
    const reloadedMaster = storage.getMasterProfile();
    expect(reloadedMaster?.skills.length).toBe(initialMasterSkillsCount);
  });

  it('editing a career profile updates only the career profile configuration without modifying Master Profile', () => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    const master = SeedMigrator.migrate(seedPath);
    storage.saveMasterProfile(master);

    const initialMasterSkillsCount = master.skills.length;
    const initialMasterLastUpdated = master.lastUpdated;

    const profile = ProfileProjector.createCareerProfile(master, {
      id: 'editable-profile',
      track: 'software-engineering',
      name: 'Editable Profile',
      description: 'Testing UI editing capability',
      headline: 'Software Engineer',
      narrativeSummary: 'Initial narrative',
      targetJobTitles: ['Backend Engineer'],
      primarySkillNames: ['Golang'],
      secondarySkillNames: ['Docker'],
    });

    storage.saveCareerProfile(profile);

    // Simulate UI modification (e.g., user updates target titles, adds skills, alters salary preferences)
    const modifiedProfile = {
      ...profile,
      headline: 'Principal Distributed Systems Architect',
      targetJobTitles: ['Principal Engineer', 'Staff Backend Engineer'],
      salaryPreferences: {
        minimum: '$150,000',
        target: '$180,000',
        currency: 'USD',
        period: 'yearly' as const,
      },
      updatedAt: new Date().toISOString(),
    };

    storage.saveCareerProfile(modifiedProfile);

    // Verify Career Profile was updated
    const retrievedCareer = storage.getCareerProfile('editable-profile');
    expect(retrievedCareer).toBeDefined();
    expect(retrievedCareer?.headline).toBe('Principal Distributed Systems Architect');
    expect(retrievedCareer?.targetJobTitles).toContain('Principal Engineer');
    expect(retrievedCareer?.salaryPreferences.target).toBe('$180,000');

    // Verify Master Profile remains 100% untouched
    const freshMaster = storage.getMasterProfile()!;
    expect(freshMaster.skills.length).toBe(initialMasterSkillsCount);
    expect(freshMaster.lastUpdated).toBe(initialMasterLastUpdated);
    expect(freshMaster.screening.targetSalary).toBe(master.screening.targetSalary);
  });

  it('supports creating additional custom career profiles later', () => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    const master = SeedMigrator.migrate(seedPath);
    storage.saveMasterProfile(master);

    const customProfile = ProfileProjector.createCareerProfile(master, {
      id: 'custom-founder-track',
      track: 'custom',
      name: 'Technical Founder / Founding Engineer',
      description: 'Early stage startup generalist role owning end-to-end architecture and revenue loops',
      headline: 'Founding Engineer | Full Stack, AI & Systems',
      narrativeSummary: 'Hands-on engineer capable of shipping products from 0 to 1.',
      targetJobTitles: ['Founding Engineer', 'Technical Co-founder'],
      primarySkillNames: ['Golang', 'Python', 'React', 'TypeScript', 'Stripe'],
      secondarySkillNames: ['Docker', 'PostgreSQL'],
      highlightedProjectNames: ['MI Shield', 'WeekIt.ai'],
    });

    storage.saveCareerProfile(customProfile);

    const retrieved = storage.getCareerProfile('custom-founder-track');
    expect(retrieved).toBeDefined();
    expect(retrieved?.track).toBe('custom');
    expect(retrieved?.primarySkillIds.length).toBe(5);
  });
});
