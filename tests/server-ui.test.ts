import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createCareerBrainServer } from '../src/server/index.js';
import { ProfileStorage } from '../src/core/storage.js';
import { sanitizeProfileForExport } from '../src/core/profile-sanitizer.js';
import { MasterProfile } from '../src/types/master-profile.js';

describe('Career Brain Server & UI REST Endpoints', () => {
  const port = 3148;
  let app: any;
  let storage: ProfileStorage;

  beforeAll(async () => {
    storage = new ProfileStorage();
    app = createCareerBrainServer({ port, host: '127.0.0.1', storage });
    await app.listen();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the single page application HTML at root', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Jobby Career Brain');
    expect(html).toContain('tab-master');
    expect(html).toContain('tab-career');
    expect(html).toContain('tab-skills');
    expect(html).toContain('tab-answers');
  });

  it('serves static assets styles.css and app.js', async () => {
    const resCss = await fetch(`http://127.0.0.1:${port}/styles.css`);
    expect(resCss.status).toBe(200);
    expect(resCss.headers.get('content-type')).toContain('text/css');

    const resJs = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(resJs.status).toBe(200);
    expect(resJs.headers.get('content-type')).toContain('javascript');
  });

  it('provides sanitized master profile facts via GET /api/master-profile', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/master-profile`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.personal.firstName).toBe('Noor ul Ain');
    expect(data.screening.workAuthorization).toBe('Yes');
    expect(data.education.length).toBeGreaterThan(0);
    expect(data.experience.length).toBeGreaterThan(0);
    expect(data.skills.length).toBeGreaterThan(0);
  });

  it('fetches all 4 Career Profiles via GET /api/career-profiles', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/career-profiles`);
    expect(res.status).toBe(200);
    const profiles = await res.json();
    expect(profiles.length).toBe(4);
    const tracks = profiles.map((p: any) => p.track);
    expect(tracks).toContain('software-engineering');
    expect(tracks).toContain('applied-ai');
    expect(tracks).toContain('revenue-tech');
    expect(tracks).toContain('customer-success');
  });

  it('provides skill intelligence breakdown via GET /api/skill-intelligence', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/skill-intelligence`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.registry)).toBe(true);
    expect(data.registry.length).toBeGreaterThan(0);
    expect(Array.isArray(data.inferredPending)).toBe(true);
  });

  it('provides application answer bank facts via GET /api/answer-bank', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/answer-bank`);
    expect(res.status).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const questions = items.map((i: any) => i.questionPattern);
    expect(questions.some((q: string) => q.includes('authorized to work'))).toBe(true);
  });

  it('exports JSON without exposing secrets or private API keys', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/export`);
    expect(res.status).toBe(200);
    const rawText = await res.text();
    expect(rawText).not.toContain('OPENROUTER_API_KEY');
    expect(rawText).not.toContain('sk-or-');
    const exportData = JSON.parse(rawText);
    expect(exportData.masterProfile).toBeDefined();
    expect(exportData.careerProfiles).toBeDefined();
    expect(exportData.answerBank).toBeDefined();
  });

  it('guarantees profile sanitizer strips secrets', () => {
    const mockProfileWithSecret: any = {
      personal: { firstName: 'Test', email: 'test@example.com', apiKey: 'secret-123' },
      screening: { password: 'cleartext-password' },
      conflicts: [],
    };
    const sanitized = sanitizeProfileForExport(mockProfileWithSecret as MasterProfile);
    expect((sanitized.personal as any).apiKey).toBeUndefined();
    expect((sanitized.screening as any).password).toBeUndefined();
  });
});
