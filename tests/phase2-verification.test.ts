import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { SeedMigrator } from '../src/core/migrator.js';
import { ProfileStorage } from '../src/core/storage.js';
import { ProfileProjector } from '../src/core/projector.js';
import { ProvenanceGuard } from '../src/core/provenance-guard.js';
import { SkillIntelligenceService } from '../src/core/skill-intelligence.js';
import { CareerProfileSelector } from '../src/core/profile-selector.js';
import { AnswerBankService } from '../src/core/answer-bank-service.js';
import { createCareerBrainServer } from '../src/server/index.js';
import { MasterProfile, MasterProfileSchema } from '../src/types/master-profile.js';
import { CareerProfile, CareerProfileSchema } from '../src/types/career-profile.js';

describe('Phase 2 Complete End-to-End Career Brain Verification', () => {
  const seedPath = path.resolve('./data/source/profile-seed.json');
  const profilesDir = path.resolve('./data/profile/career-profiles');
  const testPort = 3155;

  let storage: ProfileStorage;
  let master: MasterProfile;
  let careerProfiles: CareerProfile[];
  let skillService: SkillIntelligenceService;
  let selector: CareerProfileSelector;
  let answerService: AnswerBankService;
  let testServer: any;

  beforeAll(async () => {
    storage = new ProfileStorage({ profileDir: ':memory:' });
    skillService = new SkillIntelligenceService();
    selector = new CareerProfileSelector();
    answerService = new AnswerBankService();

    testServer = createCareerBrainServer({ port: testPort, host: '127.0.0.1', storage });
    await testServer.listen();
  });

  afterAll(async () => {
    await testServer.close();
    storage.close();
  });

  it('Step 1 & 2: Imports and strictly validates Master Profile from profile-seed.json', async () => {
    master = SeedMigrator.migrate(seedPath);
    expect(master).toBeDefined();

    const validated = MasterProfileSchema.parse(master);
    expect(validated.personal.firstName).toBe('Noor ul Ain');
    expect(validated.personal.lastName).toBe('Khurshid');
    expect(validated.screening.workAuthorization).toBe('Yes');
    expect(validated.skills.length).toBeGreaterThan(90);

    storage.saveMasterProfile(validated, 'Initial seed import', {
      changeSource: 'PROFILE_IMPORT',
      actor: 'system',
    });

    const persisted = storage.getMasterProfile();
    expect(persisted).toBeDefined();
    // Seed baseline answer bank items for this profile
    const { seedInitialAnswerBank } = await import('../src/core/answer-bank-seed.js');
    seedInitialAnswerBank(storage);

    expect(persisted?.id).toBe(master.id);
  });

  it('Step 3: Confirms resume-derived facts and evidence linking', () => {
    const missionInboxExp = master.experience.find((e) => e.company === 'Mission Inbox');
    expect(missionInboxExp).toBeDefined();
    expect(missionInboxExp?.bulletPoints.length).toBe(7);

    const golangSkill = master.skills.find((s) => s.name === 'Golang');
    expect(golangSkill).toBeDefined();
    expect(golangSkill?.evidence.length).toBeGreaterThan(0);
    const hasEvidence = golangSkill?.evidence.some(
      (ev) => ev.description.includes('Shell Eco-Marathon') || ev.description.includes('MI Shield')
    );
    expect(hasEvidence).toBe(true);
  });

  it('Step 4 & 5: Discovers omitted foundational skills and approves one into canonical profile', async () => {
    const initialSkillsCount = master.skills.length;
    expect(master.skills.some((s) => s.name === 'HTML')).toBe(false);

    const suggestions = await skillService.discoverInferredSkills(master, { useSemanticAI: false });
    expect(suggestions.length).toBeGreaterThan(0);

    const htmlSuggestion = suggestions.find((s) => s.canonicalName === 'HTML');
    expect(htmlSuggestion).toBeDefined();
    expect(htmlSuggestion?.derivedFromSkill).toBe('React');

    const { updatedMaster, newSkill } = skillService.approveInferredSkill(
      master,
      htmlSuggestion!,
      'Approved: React frontend experience inherently demonstrates HTML proficiency'
    );

    expect(newSkill.name).toBe('HTML');
    expect(newSkill.status).toBe('USER_APPROVED_KNOWN');
    expect(newSkill.provenance.provenance).toBe('inferred-but-user-approved');
    expect(newSkill.provenance.approvedByUser).toBe(true);

    storage.saveMasterProfile(updatedMaster, 'Approved inferred HTML skill', {
      changeSource: 'USER_APPROVED_INFERENCE',
      actor: 'user',
    });

    master = storage.getMasterProfile()!;
    expect(master.skills.length).toBe(initialSkillsCount + 1);
    expect(master.skills.some((s) => s.name === 'HTML' && s.status === 'USER_APPROVED_KNOWN')).toBe(true);
  });

  it('Step 6: Accurately matches 4 distinct realistic job profiles', async () => {
    careerProfiles = [
      ProfileProjector.createCareerProfile(master, {
        id: 'applied-ai',
        track: 'applied-ai',
        name: 'Applied AI & AI Engineering',
        description: 'Applied machine learning and AI systems roles.',
        headline: 'AI Engineer | Computer Vision, NLP, RAG Pipelines & LLM Deployment',
        narrativeSummary: 'AI engineer experienced in training deep learning models.',
        targetJobTitles: ['AI Engineer', 'Machine Learning Engineer', 'Applied AI Specialist', 'Computer Vision Engineer'],
        primarySkillNames: ['Python', 'PyTorch', 'TensorFlow', 'Transformers', 'Hugging Face', 'RAG pipelines', 'Ollama'],
        secondarySkillNames: ['Golang', 'Scikit-learn', 'Docker', 'Streamlit'],
      }),
      ProfileProjector.createCareerProfile(master, {
        id: 'software-engineering',
        track: 'software-engineering',
        name: 'Software Engineering',
        description: 'Full stack & distributed backend software engineering roles.',
        headline: 'Senior Full Stack & Systems Engineer | Golang, Python, TypeScript, Distributed Architectures',
        narrativeSummary: 'Full-stack and systems engineer specialized in scalable backend systems.',
        targetJobTitles: ['Software Engineer', 'Full Stack Engineer', 'Backend Engineer', 'Systems Engineer'],
        primarySkillNames: ['Golang', 'Python', 'TypeScript', 'PostgreSQL', 'Docker', 'Celery', 'React', 'HTML'],
        secondarySkillNames: ['Redis', 'RabbitMQ', 'Caddy', 'AWS (EC2, SageMaker, Lambda, S3)', 'Nest.JS'],
      }),
      ProfileProjector.createCareerProfile(master, {
        id: 'revenue-tech',
        track: 'revenue-tech',
        name: 'Revenue Tech & AI Automation',
        description: 'Revenue operations, marketing technology, and business automation roles.',
        headline: 'Revenue-Tech Engineer | Subscription Infrastructure, Deliverability & Automation Pipelines',
        narrativeSummary: 'Specialized in subscription billing architecture, email deliverability infrastructure.',
        targetJobTitles: ['Revenue Engineer', 'RevOps Developer', 'Marketing Automation Engineer', 'Integration Engineer'],
        preferredIndustries: ['Fintech', 'SaaS', 'E-Commerce Infrastructure', 'Marketing Technology'],
        primarySkillNames: ['Stripe', 'Chargebee', 'Postfix', 'Dovecot', 'Postal', 'HubSpot', 'Attio'],
        secondarySkillNames: ['Pipedrive', 'Vitally (Customer Success)', 'Webflow', 'Celery', 'PostgreSQL', 'RestAPI'],
        preferredKeywords: ['MRR growth', 'subscription billing', 'email deliverability', 'CRM syncing', 'webhook orchestration'],
      }),
      ProfileProjector.createCareerProfile(master, {
        id: 'customer-success',
        track: 'customer-success',
        name: 'Customer Success & Technical Support',
        description: 'Technical customer success, solution engineering, and client-facing support roles.',
        headline: 'Technical Customer Success Engineer | Solution Architecture, Client Onboarding & Support',
        narrativeSummary: 'Customer-facing technical engineer with extensive background in customer onboarding.',
        targetJobTitles: ['Customer Success Engineer', 'Technical Support Engineer', 'Solutions Engineer', 'Implementation Specialist'],
        preferredIndustries: ['Enterprise Software', 'Developer Platforms', 'B2B SaaS'],
        primarySkillNames: ['Vitally (Customer Success)', 'HubSpot', 'Slack', 'VS Code', 'Git', 'RestAPI'],
        secondarySkillNames: ['PostgreSQL', 'Stripe', 'Docker', 'Python', 'JavaScript'],
        preferredKeywords: ['customer satisfaction', 'onboarding velocity', 'technical troubleshooting', 'client advocacy', 'API integrations'],
      }),
    ];
    for (const cp of careerProfiles) storage.saveCareerProfile(cp);

    // Scenario A: Software Engineering Job
    const sweJob = {
      jobTitle: 'Backend Software Engineer',
      company: 'High-Throughput Cloud Co',
      jobDescription: 'Build Golang microservices, PostgreSQL query optimizations, Redis caching, Docker.',
      requiredSkills: ['Golang', 'PostgreSQL', 'Docker', 'Redis'],
      seniority: 'Senior',
      industry: 'Developer Tools',
    };
    const sweResult = await selector.selectProfile(master, careerProfiles, sweJob, { useSemanticAI: false });
    expect(sweResult.selectedProfileTrack).toBe('software-engineering');
    expect(sweResult.matchedSkills).toContain('Golang');
    expect(sweResult.matchedSkills).toContain('PostgreSQL');

    // Scenario B: Applied AI Job
    const aiJob = {
      jobTitle: 'AI Engineer / LLM Engineer',
      company: 'Cognitive Foundations Inc',
      jobDescription: 'Fine-tune transformers, optimize vision models, build low-latency RAG inference pipelines.',
      requiredSkills: ['Python', 'PyTorch', 'Transformers', 'RAG'],
      seniority: 'Mid-Senior',
      industry: 'Artificial Intelligence',
    };
    const aiResult = await selector.selectProfile(master, careerProfiles, aiJob, { useSemanticAI: false });
    expect(aiResult.selectedProfileTrack).toBe('applied-ai');
    expect(aiResult.matchedSkills).toContain('Python');
    expect(aiResult.matchedSkills).toContain('PyTorch');

    // Scenario C: Revenue Tech & AI Automation Job
    const revJob = {
      jobTitle: 'AI Solutions Engineer / Revenue Operations Engineer',
      company: 'GrowthScale Billing Labs',
      jobDescription: 'Orchestrate Stripe billing webhooks, deliverability infrastructure, Attio and HubSpot pipelines.',
      requiredSkills: ['Stripe', 'HubSpot', 'PostgreSQL', 'Webhooks'],
      seniority: 'Mid-Level',
      industry: 'Fintech',
    };
    const revResult = await selector.selectProfile(master, careerProfiles, revJob, { useSemanticAI: false });
    expect(revResult.selectedProfileTrack).toBe('revenue-tech');

    // Scenario D: Technical Customer Success Job
    const csJob = {
      jobTitle: 'Technical Customer Success Manager',
      company: 'Enterprise API Platform',
      jobDescription: 'Guide client onboarding, diagnose technical integration bugs, administer Vitally customer success hub.',
      requiredSkills: ['Customer Support', 'Vitally', 'API Integration'],
      seniority: 'Mid-Level',
      industry: 'B2B SaaS',
    };
    const csResult = await selector.selectProfile(master, careerProfiles, csJob, { useSemanticAI: false });
    expect(csResult.selectedProfileTrack).toBe('customer-success');
  });

  it('Step 6b: Selects profile and matches skill that was omitted from resume but approved into Master Profile (HTML)', async () => {
    const webJob = {
      jobTitle: 'Full Stack Engineer',
      company: 'Web Systems Co',
      jobDescription: 'Develop web apps with HTML, React, TypeScript, and Go.',
      requiredSkills: ['HTML', 'React', 'TypeScript', 'Golang'],
      seniority: 'Senior',
      industry: 'Developer Tools',
    };

    const res = await selector.selectProfile(master, careerProfiles, webJob, { useSemanticAI: false });
    expect(res.selectedProfileTrack).toBe('software-engineering');
    expect(res.matchedSkills).toContain('HTML');
    expect(res.matchedSkills).toContain('React');
    expect(res.matchedSkills).toContain('Golang');
  });

  it('Step 7: Switches between Career Profiles and produces different lenses', () => {
    const sweProfile = careerProfiles.find((p) => p.track === 'software-engineering')!;
    const aiProfile = careerProfiles.find((p) => p.track === 'applied-ai')!;

    const sweProjected = ProfileProjector.projectSkills(master, sweProfile);
    const aiProjected = ProfileProjector.projectSkills(master, aiProfile);

    const swePrimaryNames = sweProjected.primary.map((s) => s.name);
    expect(swePrimaryNames).toContain('Golang');

    const aiPrimaryNames = aiProjected.primary.map((s) => s.name);
    expect(aiPrimaryNames).toContain('PyTorch');

    expect(swePrimaryNames).not.toEqual(aiPrimaryNames);
  });

  it('Step 8: Proves Master Profile is 100% immutable throughout profile selections & projections', () => {
    const currentMasterJson = JSON.stringify(storage.getMasterProfile());
    expect(JSON.stringify(master)).toBe(currentMasterJson);
  });

  it('Step 9 & 10: Resolves exact and phrased-differently questions with canonical facts', async () => {
    const savedItems = storage.getAnswerBankItems();

    const qAuth = await answerService.answerQuestion(master, {
      question: 'Are you permitted to work in Canada without restriction?',
      useSemanticAI: false,
    }, savedItems);
    expect(qAuth.status).toBe('RESOLVED');
    expect(qAuth.answer).toBe('Yes');
    expect(qAuth.safeToAutoSubmit).toBe(true);

    const qSponsor = await answerService.answerQuestion(master, {
      question: 'Do you need sponsorship for a work visa?',
      useSemanticAI: false,
    }, savedItems);
    expect(qSponsor.status).toBe('RESOLVED');
    expect(qSponsor.answer).toBe('No');

    const qNotice = await answerService.answerQuestion(master, {
      question: 'How quickly can you start?',
      useSemanticAI: false,
    }, savedItems);
    expect(qNotice.status).toBe('RESOLVED');
    expect(qNotice.answer).toBe(master.screening.noticePeriod);

    const qLoc = await answerService.answerQuestion(master, {
      question: 'Where do you live currently?',
      useSemanticAI: false,
    }, savedItems);
    expect(qLoc.status).toBe('RESOLVED');
    expect(qLoc.answer).toContain('Toronto');

    const qEdu = await answerService.answerQuestion(master, {
      question: 'What was your degree at university?',
      useSemanticAI: false,
    }, savedItems);
    expect(qEdu.status).toBe('RESOLVED');
    expect(qEdu.answer).toContain('Master of Science');
  });

  it('Step 11: Returns UNKNOWN_NEEDS_REVIEW for unknown or unverified questions without hallucinating', async () => {
    const unverifiedQuestions = [
      'What is your military security clearance level?',
      'Do you have 10 years of experience managing Kubernetes clusters in production?',
      'What is your favorite book about philosophy?',
    ];

    for (const q of unverifiedQuestions) {
      const res = await answerService.answerQuestion(master, { question: q, useSemanticAI: false });
      expect(res.status).toBe('UNKNOWN_NEEDS_REVIEW');
      expect(res.answer).toBeNull();
      expect(res.safeToAutoSubmit).toBe(false);
      expect(res.requiresHumanConfirmation).toBe(true);
    }
  });

  it('Step 12: Automatically records versions with provenance source, actor, and diffs on change', () => {
    const initialHistory = storage.getProfileHistory(master.id);
    const initialVersionCount = initialHistory.length;

    const updated = JSON.parse(JSON.stringify(master)) as MasterProfile;
    updated.personal.city = 'Waterloo';
    updated.screening.targetSalary = '$135,000/year';

    storage.saveMasterProfile(updated, 'Relocation to Waterloo tech corridor', {
      changeSource: 'USER_ENTERED',
      actor: 'user',
    });

    const newHistory = storage.getProfileHistory(master.id);
    expect(newHistory.length).toBe(initialVersionCount + 1);

    const latest = newHistory[0];
    expect(latest.changeSource).toBe('USER_ENTERED');
    expect(latest.actor).toBe('user');
    expect(latest.changeReason).toContain('Waterloo');
    expect(latest.fieldsChanged.some((d) => d.fieldPath === 'personal.city' && d.newValue === 'Waterloo')).toBe(true);
  });

  it('Step 13: Exports profile cleanly without leaking private secrets, and re-imports successfully', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/export`);
    expect(res.status).toBe(200);

    const exportJsonText = await res.text();
    expect(exportJsonText).not.toContain('OPENROUTER_API_KEY');
    expect(exportJsonText).not.toContain('sk-or-');

    const exportData = JSON.parse(exportJsonText);
    expect(exportData.masterProfile).toBeDefined();
    expect(exportData.careerProfiles.length).toBe(4);
    expect(exportData.answerBank.length).toBeGreaterThan(0);

    const importRes = await fetch(`http://127.0.0.1:${testPort}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportData),
    });
    expect(importRes.status).toBe(200);
    const importResult = await importRes.json();
    expect(importResult.success).toBe(true);
  });

  it('Step 14: Performs rollback to earlier version and proves exact data integrity', () => {
    const history = storage.getProfileHistory(master.id);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const v1Entry = history.find((h) => h.versionNumber === 1);
    expect(v1Entry).toBeDefined();

    const rolledBackProfile = storage.rollbackMasterProfile(v1Entry!.id!, 'Rollback to v1 baseline');
    expect(rolledBackProfile.personal.city).toBe('Toronto');
    expect(rolledBackProfile.screening.targetSalary).toBe('$2,500/month');

    const activeInStorage = storage.getMasterProfile()!;
    expect(activeInStorage.personal.city).toBe('Toronto');

    const afterRollbackHistory = storage.getProfileHistory(master.id);
    expect(afterRollbackHistory[0].changeReason).toContain('Rollback to v1 baseline');
  });

  it('Step 15: Verifies REST API operations and status codes across all resources', async () => {
    const r1 = await fetch(`http://127.0.0.1:${testPort}/api/master-profile`);
    expect(r1.status).toBe(200);
    const pData = await r1.json();
    expect(pData.personal.firstName).toBe('Noor ul Ain');

    const r2 = await fetch(`http://127.0.0.1:${testPort}/api/career-profiles`);
    expect(r2.status).toBe(200);
    const cpData = await r2.json();
    expect(cpData.length).toBe(4);

    const r3 = await fetch(`http://127.0.0.1:${testPort}/api/skill-intelligence`);
    expect(r3.status).toBe(200);
    const siData = await r3.json();
    expect(siData.registry.length).toBeGreaterThan(0);

    const r4 = await fetch(`http://127.0.0.1:${testPort}/api/answer-bank`);
    expect(r4.status).toBe(200);
    const abData = await r4.json();
    expect(abData.length).toBeGreaterThan(0);

    const r5 = await fetch(`http://127.0.0.1:${testPort}/api/history`);
    expect(r5.status).toBe(200);
    const hData = await r5.json();
    expect(hData.length).toBeGreaterThan(0);
  });
});

