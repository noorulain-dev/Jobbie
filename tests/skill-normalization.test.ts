import { describe, it, expect } from 'vitest';
import { normalizeSkillName } from '../src/core/skill-normalizer.js';

describe('Skill Keyword Normalization', () => {
  it('normalizes Node / Node.js / NodeJS variations to canonical "Node.js"', () => {
    const v1 = normalizeSkillName('Node');
    const v2 = normalizeSkillName('Node.js');
    const v3 = normalizeSkillName('NodeJS');
    const v4 = normalizeSkillName('Node js');

    expect(v1.canonical).toBe('Node.js');
    expect(v2.canonical).toBe('Node.js');
    expect(v3.canonical).toBe('Node.js');
    expect(v4.canonical).toBe('Node.js');
    expect(v1.aliases).toContain('NodeJS');
  });

  it('normalizes React / React.js / ReactJS to canonical "React"', () => {
    const v1 = normalizeSkillName('React');
    const v2 = normalizeSkillName('React.js');
    const v3 = normalizeSkillName('ReactJS');

    expect(v1.canonical).toBe('React');
    expect(v2.canonical).toBe('React');
    expect(v3.canonical).toBe('React');
    expect(v1.aliases).toContain('React.js');
    expect(v1.aliases).toContain('ReactJS');
  });

  it('normalizes Postgres / PostgreSQL to canonical "PostgreSQL"', () => {
    const v1 = normalizeSkillName('Postgres');
    const v2 = normalizeSkillName('PostgreSQL');
    const v3 = normalizeSkillName('Postgres DB');

    expect(v1.canonical).toBe('PostgreSQL');
    expect(v2.canonical).toBe('PostgreSQL');
    expect(v3.canonical).toBe('PostgreSQL');
  });

  it('normalizes Golang / Go to canonical "Golang"', () => {
    const v1 = normalizeSkillName('Golang');
    const v2 = normalizeSkillName('Go');
    const v3 = normalizeSkillName('Go Language');

    expect(v1.canonical).toBe('Golang');
    expect(v2.canonical).toBe('Golang');
    expect(v3.canonical).toBe('Golang');
  });

  it('normalizes REST / REST API / RESTful API to canonical "REST"', () => {
    const v1 = normalizeSkillName('REST');
    const v2 = normalizeSkillName('REST API');
    const v3 = normalizeSkillName('RESTful API');

    expect(v1.canonical).toBe('REST');
    expect(v2.canonical).toBe('REST');
    expect(v3.canonical).toBe('REST');
  });

  it('preserves novel unmapped skills with trimmed casing fallback', () => {
    const custom = normalizeSkillName('   Solidity Smart Contracts  ');
    expect(custom.canonical).toBe('Solidity Smart Contracts');
    expect(custom.aliases).toEqual([]);
  });
});
