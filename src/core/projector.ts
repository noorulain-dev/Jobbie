import crypto from 'node:crypto';
import { MasterProfile, SkillItem, ExperienceItem, ProjectItem } from '../types/master-profile.js';
import { CareerProfile, CareerProfileTrack, CareerProfileSchema } from '../types/career-profile.js';
import { ProvenanceGuard } from './provenance-guard.js';

export interface ProjectorOptions {
  id?: string;
  track: CareerProfileTrack;
  name: string;
  description: string;
  headline: string;
  narrativeSummary: string;
  targetJobTitles: string[];
  excludedJobTitles?: string[];
  preferredIndustries?: string[];
  primarySkillNames: string[];
  secondarySkillNames: string[];
  deemphasizedSkillNames?: string[];
  priorityCompanyNames?: string[];
  highlightedProjectNames?: string[];
  preferredAccomplishments?: string[];
  preferredKeywords?: string[];
  salaryPreferences?: CareerProfile['salaryPreferences'];
  locationPreferences?: CareerProfile['locationPreferences'];
  remotePreferences?: CareerProfile['remotePreferences'];
  seniorityPreferences?: CareerProfile['seniorityPreferences'];
  customResumeInstructions?: string;
  customCoverLetterInstructions?: string;
  applicationStrategyRules?: string[];
  prohibitedClaims?: string[];
}

export class ProfileProjector {
  /**
   * Builds a CareerProfile configuration projection referencing Master Profile entities
   * WITHOUT duplicating canonical facts or altering the Master Profile.
   */
  public static createCareerProfile(
    master: MasterProfile,
    options: ProjectorOptions
  ): CareerProfile {
    const primarySkillIds: string[] = [];
    const secondarySkillIds: string[] = [];
    const deemphasizedSkillIds: string[] = [];

    for (const name of options.primarySkillNames) {
      const match = ProvenanceGuard.findSkill(master.skills, name);
      if (match && !primarySkillIds.includes(match.id)) primarySkillIds.push(match.id);
    }

    for (const name of options.secondarySkillNames) {
      const match = ProvenanceGuard.findSkill(master.skills, name);
      if (match && !secondarySkillIds.includes(match.id)) secondarySkillIds.push(match.id);
    }

    if (options.deemphasizedSkillNames) {
      for (const name of options.deemphasizedSkillNames) {
        const match = ProvenanceGuard.findSkill(master.skills, name);
        if (match && !deemphasizedSkillIds.includes(match.id)) deemphasizedSkillIds.push(match.id);
      }
    }

    const priorityExperienceIds: string[] = [];
    if (options.priorityCompanyNames) {
      for (const compName of options.priorityCompanyNames) {
        const exp = master.experience.find((e) => e.company.toLowerCase().includes(compName.toLowerCase()));
        if (exp && !priorityExperienceIds.includes(exp.id)) priorityExperienceIds.push(exp.id);
      }
    }

    const highlightedProjectIds: string[] = [];
    if (options.highlightedProjectNames) {
      for (const projName of options.highlightedProjectNames) {
        const p = master.projects.find((proj) => proj.name.toLowerCase().includes(projName.toLowerCase()));
        if (p && !highlightedProjectIds.includes(p.id)) highlightedProjectIds.push(p.id);
      }
    }

    const now = new Date().toISOString();

    const profileData: CareerProfile = {
      id: options.id || `${options.track}-${crypto.randomUUID().slice(0, 8)}`,
      track: options.track,
      name: options.name,
      description: options.description,
      headline: options.headline,
      narrativeSummary: options.narrativeSummary,
      targetJobTitles: options.targetJobTitles,
      excludedJobTitles: options.excludedJobTitles || [],
      preferredIndustries: options.preferredIndustries || [],
      primarySkillIds,
      secondarySkillIds,
      deemphasizedSkillIds,
      priorityExperienceIds,
      highlightedProjectIds,
      preferredAccomplishments: options.preferredAccomplishments || [],
      preferredKeywords: options.preferredKeywords || [],
      salaryPreferences: options.salaryPreferences || {
        minimum: '$70,000',
        target: '$90,000',
        currency: 'USD',
        period: 'yearly',
      },
      locationPreferences: options.locationPreferences || {
        allowedCountries: ['Canada', 'United States'],
        preferredCities: ['Toronto', 'Remote'],
        willingToRelocate: false,
      },
      remotePreferences: options.remotePreferences || {
        remoteOnly: false,
        hybridAllowed: true,
        onSiteAllowed: false,
        allowedTimezones: ['EST', 'PST', 'CST', 'MST'],
      },
      seniorityPreferences: options.seniorityPreferences || {
        targetLevels: ['Mid-Level', 'Senior'],
        yearsExperienceClaim: '2+',
      },
      customResumeInstructions: options.customResumeInstructions || '',
      customCoverLetterInstructions: options.customCoverLetterInstructions || '',
      applicationStrategyRules: options.applicationStrategyRules || [],
      prohibitedClaims: options.prohibitedClaims || [],
      createdAt: now,
      updatedAt: now,
    };

    return CareerProfileSchema.parse(profileData);
  }
  /**
   * Projects active skills from Master Profile through the CareerProfile lens.
   * Guarantees DO_NOT_CLAIM skills, deemphasized skills, and prohibited claims are respected.
   */
  public static projectSkills(master: MasterProfile, careerProfile: CareerProfile): {
    primary: SkillItem[];
    secondary: SkillItem[];
    other: SkillItem[];
    deemphasized: SkillItem[];
  } {
    const primarySet = new Set(careerProfile.primarySkillIds);
    const secondarySet = new Set(careerProfile.secondarySkillIds);
    const deemphasizedSet = new Set(careerProfile.deemphasizedSkillIds);
    const prohibitedSet = new Set(careerProfile.prohibitedClaims.map((c) => c.toLowerCase().trim()));

    const primary: SkillItem[] = [];
    const secondary: SkillItem[] = [];
    const other: SkillItem[] = [];
    const deemphasized: SkillItem[] = [];

    for (const skill of master.skills) {
      if (skill.status === 'DO_NOT_CLAIM') continue;
      if (prohibitedSet.has(skill.name.toLowerCase().trim())) continue;

      if (primarySet.has(skill.id)) {
        primary.push(skill);
      } else if (secondarySet.has(skill.id)) {
        secondary.push(skill);
      } else if (deemphasizedSet.has(skill.id)) {
        deemphasized.push(skill);
      } else {
        other.push(skill);
      }
    }

    return { primary, secondary, other, deemphasized };
  }

  /**
   * Projects priority experiences through the Career Profile lens.
   */
  public static projectExperiences(master: MasterProfile, careerProfile: CareerProfile): {
    prioritized: ExperienceItem[];
    standard: ExperienceItem[];
  } {
    const prioritySet = new Set(careerProfile.priorityExperienceIds);
    const prioritized: ExperienceItem[] = [];
    const standard: ExperienceItem[] = [];

    for (const exp of master.experience) {
      if (prioritySet.has(exp.id)) {
        prioritized.push(exp);
      } else {
        standard.push(exp);
      }
    }

    return { prioritized, standard };
  }

  /**
   * Projects priority projects through the Career Profile lens.
   */
  public static projectProjects(master: MasterProfile, careerProfile: CareerProfile): {
    highlighted: ProjectItem[];
    standard: ProjectItem[];
  } {
    const highlightedSet = new Set(careerProfile.highlightedProjectIds);
    const highlighted: ProjectItem[] = [];
    const standard: ProjectItem[] = [];

    for (const proj of master.projects) {
      if (highlightedSet.has(proj.id)) {
        highlighted.push(proj);
      } else {
        standard.push(proj);
      }
    }

    return { highlighted, standard };
  }

}

