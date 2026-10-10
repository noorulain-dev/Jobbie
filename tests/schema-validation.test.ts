import { describe, it, expect } from 'vitest';
import { MasterProfileSchema, PersonalInfoSchema } from '../src/types/master-profile.js';
import { FactProvenanceEnum, SkillStatusEnum } from '../src/types/provenance.js';

describe('Canonical Profile Schema & Deterministic Validators', () => {
  it('validates a correct personal info object', () => {
    const validPersonal = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@domain.com',
      phone: '+14155552671',
      city: 'San Francisco',
      provinceState: 'California',
      country: 'USA',
      linkedin: 'https://linkedin.com/in/johnsmith',
      github: 'https://github.com/johnsmith',
      portfolio: 'https://johnsmith.dev',
      provenance: {
        provenance: 'user-entered',
        sourceRef: 'user_form',
        approvedByUser: true,
      },
    };

    const parsed = PersonalInfoSchema.parse(validPersonal);
    expect(parsed.email).toBe('john.smith@domain.com');
  });

  it('rejects invalid email formats deterministically', () => {
    const invalidPersonal = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'not-an-email',
      phone: '+14155552671',
      city: 'San Francisco',
      provinceState: 'California',
      country: 'USA',
      linkedin: 'https://linkedin.com/in/johnsmith',
      github: 'https://github.com/johnsmith',
      portfolio: 'https://johnsmith.dev',
      provenance: {
        provenance: 'user-entered',
        sourceRef: 'user_form',
        approvedByUser: true,
      },
    };

    expect(() => PersonalInfoSchema.parse(invalidPersonal)).toThrow(/Invalid email format/);
  });

  it('rejects invalid URL formats deterministically', () => {
    const invalidPersonal = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+14155552671',
      city: 'San Francisco',
      provinceState: 'California',
      country: 'USA',
      linkedin: 'ftp://not-http-url',
      github: 'https://github.com/johnsmith',
      portfolio: 'https://johnsmith.dev',
      provenance: {
        provenance: 'user-entered',
        sourceRef: 'user_form',
        approvedByUser: true,
      },
    };

    expect(() => PersonalInfoSchema.parse(invalidPersonal)).toThrow(/Invalid LinkedIn URL/);
  });

  it('verifies all expected skill status enum values are supported', () => {
    const statuses = [
      'EXPLICIT_KNOWN',
      'INFERRED_KNOWN',
      'USER_APPROVED_KNOWN',
      'LEARNING_TARGET',
      'DO_NOT_CLAIM',
    ];

    for (const status of statuses) {
      expect(SkillStatusEnum.parse(status)).toBe(status);
    }
  });

  it('verifies provenance statuses are strictly enforced', () => {
    const valid = ['user-entered', 'document-derived', 'inferred-but-user-approved', 'learning-target', 'prohibited-from-claiming', 'verified'];
    for (const p of valid) {
      expect(FactProvenanceEnum.parse(p)).toBe(p);
    }

    expect(() => FactProvenanceEnum.parse('made-up-by-ai')).toThrow();
  });
});
