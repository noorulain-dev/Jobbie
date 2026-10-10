import { MasterProfile, SkillItem } from '../types/master-profile.js';
import { FactProvenance, SkillStatus } from '../types/provenance.js';

export interface GuardViolation {
  field: string;
  attemptedValue: unknown;
  reason: string;
}

export class ProvenanceGuard {
  /**
   * Verified credentials and facts that an AI or outside process CANNOT invent.
   */
  public static validateNoCredentialFabrication(
    target: MasterProfile,
    attemptedUpdate: Partial<MasterProfile>
  ): GuardViolation[] {
    const violations: GuardViolation[] = [];

    // 1. Guard Companies / Employers
    if (attemptedUpdate.experience) {
      const canonicalCompanies = new Set(target.experience.map((e) => e.company.toLowerCase().trim()));
      for (const exp of attemptedUpdate.experience) {
        if (!canonicalCompanies.has(exp.company.toLowerCase().trim())) {
          violations.push({
            field: `experience.company`,
            attemptedValue: exp.company,
            reason: `AI or automated process attempted to invent a new employer '${exp.company}' not present in canonical Master Profile.`,
          });
        }
      }
    }

    // 2. Guard Degrees / Education Institutions
    if (attemptedUpdate.education) {
      const canonicalInstitutions = new Set(target.education.map((e) => e.institution.toLowerCase().trim()));
      for (const edu of attemptedUpdate.education) {
        if (!canonicalInstitutions.has(edu.institution.toLowerCase().trim())) {
          violations.push({
            field: `education.institution`,
            attemptedValue: edu.institution,
            reason: `Attempted to invent an unverified educational institution '${edu.institution}'.`,
          });
        }
      }
    }

    // 3. Guard Certifications
    if (attemptedUpdate.certifications) {
      const canonicalCerts = new Set(target.certifications.map((c) => c.title.toLowerCase().trim()));
      for (const cert of attemptedUpdate.certifications) {
        if (!canonicalCerts.has(cert.title.toLowerCase().trim())) {
          violations.push({
            field: `certifications.title`,
            attemptedValue: cert.title,
            reason: `Attempted to invent an unverified certification '${cert.title}'.`,
          });
        }
      }
    }

    // 4. Guard Location & Legal screening
    if (attemptedUpdate.personal) {
      if (attemptedUpdate.personal.country && attemptedUpdate.personal.country !== target.personal.country) {
        violations.push({
          field: 'personal.country',
          attemptedValue: attemptedUpdate.personal.country,
          reason: 'Attempted to silently alter country of residence.',
        });
      }
    }

    return violations;
  }

  /**
   * Validates that LLM-generated or system suggestions NEVER enter the Master Profile as verified facts
   * without explicit user approval (`approvedByUser: true` and appropriate provenance).
   */
  public static validateNoUnapprovedInferences(profile: MasterProfile): GuardViolation[] {
    const violations: GuardViolation[] = [];

    const checkMetadata = (meta: { provenance: string; approvedByUser?: boolean; sourceRef?: string }, path: string) => {
      if (meta.provenance === 'inferred-but-user-approved' && !meta.approvedByUser) {
        violations.push({
          field: path,
          attemptedValue: meta,
          reason: `Unapproved inference detected at '${path}'. Inferred facts require explicit user approval before becoming canonical facts.`,
        });
      }
      if (meta.sourceRef === 'SYSTEM_GENERATED_SUGGESTION' && !meta.approvedByUser) {
        violations.push({
          field: path,
          attemptedValue: meta,
          reason: `System or LLM suggestion at '${path}' cannot be committed as canonical without explicit user confirmation.`,
        });
      }
    };

    checkMetadata(profile.personal.provenance, 'personal.provenance');
    checkMetadata(profile.screening.provenance, 'screening.provenance');

    profile.education.forEach((e, idx) => checkMetadata(e.provenance, `education[${idx}].provenance`));
    profile.experience.forEach((e, idx) => {
      checkMetadata(e.provenance, `experience[${idx}].provenance`);
      e.bulletPoints.forEach((b, bIdx) => checkMetadata(b.provenance, `experience[${idx}].bulletPoints[${bIdx}].provenance`));
    });
    profile.projects.forEach((p, idx) => checkMetadata(p.provenance, `projects[${idx}].provenance`));
    profile.skills.forEach((s, idx) => {
      checkMetadata(s.provenance, `skills[${idx}].provenance`);
      if (s.status === 'INFERRED_KNOWN' && !s.provenance.approvedByUser) {
        violations.push({
          field: `skills[${idx}].status`,
          attemptedValue: s.status,
          reason: `Skill '${s.name}' with status INFERRED_KNOWN cannot be treated as a verified canonical skill without explicit user approval.`,
        });
      }
    });
    profile.certifications.forEach((c, idx) => checkMetadata(c.provenance, `certifications[${idx}].provenance`));
    profile.awards.forEach((a, idx) => checkMetadata(a.provenance, `awards[${idx}].provenance`));
    (profile.leadership || []).forEach((l, idx) => checkMetadata(l.provenance, `leadership[${idx}].provenance`));
    (profile.languages || []).forEach((l, idx) => checkMetadata(l.provenance, `languages[${idx}].provenance`));

    return violations;
  }


  /**
   * Checks whether a skill claim is permissible for output.
   * Hard rejects DO_NOT_CLAIM skills.
   * Warns or blocks LEARNING_TARGET from being claimed as work experience.
   */
  public static canClaimSkill(skill: SkillItem, claimingContext: 'resume' | 'screening' | 'learning_plan'): { allowed: boolean; reason?: string } {
    if (skill.status === 'DO_NOT_CLAIM') {
      return {
        allowed: false,
        reason: `Skill '${skill.name}' is marked as DO_NOT_CLAIM. Jobby is strictly prohibited from claiming this skill.`,
      };
    }

    if (skill.status === 'LEARNING_TARGET' && (claimingContext === 'resume' || claimingContext === 'screening')) {
      return {
        allowed: false,
        reason: `Skill '${skill.name}' is marked as LEARNING_TARGET. It cannot be claimed as active or past work experience.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Resolves a skill name against Master Profile skills considering primary names and all aliases.
   */
  public static findSkill(skills: SkillItem[], query: string): SkillItem | undefined {
    const normalized = query.toLowerCase().trim();
    return skills.find((s) => {
      if (s.name.toLowerCase().trim() === normalized) return true;
      return s.aliases.some((alias) => alias.toLowerCase().trim() === normalized);
    });
  }
}
