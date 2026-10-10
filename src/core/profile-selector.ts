import { MasterProfile } from '../types/master-profile.js';
import {
  CareerProfile,
  JobDescriptionInput,
  JobDescriptionInputSchema,
  CareerProfileSelectionResult,
  CareerProfileSelectionResultSchema,
  CareerProfileTrack,
} from '../types/career-profile.js';
import { OpenRouterClient } from '../ai/openrouter-client.js';
import { normalizeSkillName } from './skill-normalizer.js';

export interface ProfileMatchScore {
  profile: CareerProfile;
  titleScore: number;
  skillScore: number;
  industryScore: number;
  totalScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export class CareerProfileSelector {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterClient?: OpenRouterClient) {
    this.openRouterClient = openRouterClient || new OpenRouterClient();
  }

  public async selectProfile(
    master: MasterProfile,
    profiles: CareerProfile[],
    jobInput: JobDescriptionInput,
    options: { useSemanticAI?: boolean } = { useSemanticAI: true }
  ): Promise<CareerProfileSelectionResult> {
    const validatedInput = JobDescriptionInputSchema.parse(jobInput);

    if (profiles.length === 0) {
      throw new Error('No Career Profiles available for selection.');
    }

    // 1. Calculate deterministic scores for each profile
    const scoredProfiles = profiles.map((profile) =>
      this.calculateDeterministicScore(master, profile, validatedInput)
    );

    // Sort descending by total score
    scoredProfiles.sort((a, b) => b.totalScore - a.totalScore);

    const bestScored = scoredProfiles[0];
    const secondScored = scoredProfiles.length > 1 ? scoredProfiles[1] : null;

    // 2. Check for OpenRouter semantic classification if available and enabled
    let aiClassification = null;
    if (options.useSemanticAI !== false && this.openRouterClient.isAvailable()) {
      aiClassification = await this.openRouterClient.classifyJobProfile({
        jobTitle: validatedInput.jobTitle,
        company: validatedInput.company,
        jobDescription: validatedInput.jobDescription,
        requiredSkills: validatedInput.requiredSkills,
        preferredSkills: validatedInput.preferredSkills,
        responsibilities: validatedInput.responsibilities,
        seniority: validatedInput.seniority,
        industry: validatedInput.industry,
        locationRemoteRequirements: validatedInput.locationRemoteRequirements,
        availableProfiles: profiles.map((p) => ({
          id: p.id,
          track: p.track,
          name: p.name,
          description: p.description,
          targetJobTitles: p.targetJobTitles,
        })),
      });
    }

    return this.buildFinalResult(
      master,
      profiles,
      validatedInput,
      scoredProfiles,
      aiClassification
    );
  }

  public calculateDeterministicScore(
    master: MasterProfile,
    profile: CareerProfile,
    jobInput: JobDescriptionInput
  ): ProfileMatchScore {
    const jobTitleLower = jobInput.jobTitle.toLowerCase();
    const combinedJobText = `${jobInput.jobTitle} ${jobInput.jobDescription} ${jobInput.responsibilities.join(' ')}`.toLowerCase();

    // 1. Title Score (weight: up to 50 pts)
    let titleScore = 0;
    const titleSegments = jobTitleLower.split(/[/,|-]/).map((s) => s.trim()).filter(Boolean);

    for (const targetTitle of profile.targetJobTitles) {
      const targetLower = targetTitle.toLowerCase();
      // Check full title or individual slash/dash segments
      const segmentExact = titleSegments.some((seg) => seg === targetLower);
      const segmentContains = titleSegments.some((seg) => seg.includes(targetLower) || targetLower.includes(seg));

      if (jobTitleLower === targetLower || segmentExact) {
        titleScore = 50;
        break;
      } else if (jobTitleLower.includes(targetLower) || targetLower.includes(jobTitleLower) || segmentContains) {
        titleScore = Math.max(titleScore, 40);
      } else {
        const targetTokens = targetLower.split(/\s+/).filter((tok) => tok.length > 2);
        const matchCount = targetTokens.filter((tok) => jobTitleLower.includes(tok)).length;
        if (targetTokens.length > 0 && matchCount === targetTokens.length) {
          titleScore = Math.max(titleScore, 35);
        } else if (matchCount >= 2) {
          titleScore = Math.max(titleScore, 25);
        } else if (matchCount === 1) {
          titleScore = Math.max(titleScore, 15);
        }
      }
    }

    // Track keywords in title (e.g. "customer success" in "Technical Customer Success Manager")
    const trackKeywords = profile.track.replace('-', ' ').split(' ');
    const trackMatchCount = trackKeywords.filter((tk) => jobTitleLower.includes(tk)).length;
    if (trackMatchCount === trackKeywords.length) {
      titleScore = Math.max(titleScore, 35);
    } else if (trackMatchCount >= 1) {
      titleScore = Math.max(titleScore, 20);
    }

    // Excluded job title penalty
    for (const excluded of profile.excludedJobTitles) {
      if (jobTitleLower.includes(excluded.toLowerCase())) {
        titleScore = Math.max(0, titleScore - 40);
      }
    }

    // 2. Skill Alignment Score (weight: up to 35 pts)
    const profileSkills = master.skills.filter(
      (s) => profile.primarySkillIds.includes(s.id) || profile.secondarySkillIds.includes(s.id)
    );
    const profileSkillNames = new Set<string>();
    for (const s of profileSkills) {
      profileSkillNames.add(s.name.toLowerCase());
      for (const a of s.aliases) profileSkillNames.add(a.toLowerCase());
    }

    const jobRequiredSkillNorms = jobInput.requiredSkills.map((sk) => normalizeSkillName(sk).canonical.toLowerCase());
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (let i = 0; i < jobInput.requiredSkills.length; i++) {
      const orig = jobInput.requiredSkills[i];
      const norm = jobRequiredSkillNorms[i];
      if (profileSkillNames.has(norm) || profileSkillNames.has(orig.toLowerCase())) {
        matchedSkills.push(orig);
      } else {
        missingSkills.push(orig);
      }
    }

    // Check keywords and preferred skills in job text
    for (const kw of profile.preferredKeywords) {
      if (combinedJobText.includes(kw.toLowerCase())) {
        if (!matchedSkills.includes(kw)) matchedSkills.push(kw);
      }
    }

    const skillScore =
      jobInput.requiredSkills.length > 0
        ? Math.round((matchedSkills.length / jobInput.requiredSkills.length) * 35)
        : matchedSkills.length > 0
        ? Math.min(30, matchedSkills.length * 6)
        : 10;

    // 3. Industry Alignment (weight: up to 15 pts)
    let industryScore = 0;
    if (jobInput.industry) {
      const indLower = jobInput.industry.toLowerCase();
      if (profile.preferredIndustries.some((pi) => pi.toLowerCase().includes(indLower) || indLower.includes(pi.toLowerCase()))) {
        industryScore = 15;
      }
    }

    const totalScore = Math.min(100, titleScore + skillScore + industryScore);

    return {
      profile,
      titleScore,
      skillScore,
      industryScore,
      totalScore,
      matchedSkills,
      missingSkills,
    };
  }
  private buildFinalResult(
    master: MasterProfile,
    profiles: CareerProfile[],
    jobInput: JobDescriptionInput,
    scored: ProfileMatchScore[],
    aiClassification: any | null
  ): CareerProfileSelectionResult {
    let primaryMatch = scored[0];
    let secondaryMatch = scored.length > 1 ? scored[1] : null;
    let confidence = primaryMatch.totalScore / 100;
    let reasoning = `Selected ${primaryMatch.profile.name} based on alignment with title '${jobInput.jobTitle}' (title score: ${primaryMatch.titleScore}) and ${primaryMatch.matchedSkills.length} matched skills.`;
    let isHybrid = false;
    let hybridNotes: string | undefined = undefined;

    // Check hybrid conditions:
    // E.g. AI role with strong SWE responsibilities, or secondary score close to primary
    if (secondaryMatch && secondaryMatch.totalScore >= 35 && primaryMatch.totalScore - secondaryMatch.totalScore <= 25) {
      isHybrid = true;
      hybridNotes = `Hybrid role detected: blends ${primaryMatch.profile.name} (primary) with ${secondaryMatch.profile.name} (secondary emphasis).`;
    }

    // AI classification override or refinement if present
    if (aiClassification && aiClassification.selectedTrack) {
      const aiSelectedProfile = profiles.find((p) => p.track === aiClassification.selectedTrack);
      if (aiSelectedProfile) {
        const aiScored = scored.find((s) => s.profile.id === aiSelectedProfile.id);
        if (aiScored) {
          primaryMatch = aiScored;
          confidence = Math.max(0.1, Math.min(1.0, (aiClassification.confidenceScore + aiScored.totalScore / 100) / 2));
          reasoning = aiClassification.reasoning || reasoning;
          if (aiClassification.secondaryTrack) {
            const aiSecProfile = profiles.find((p) => p.track === aiClassification.secondaryTrack);
            if (aiSecProfile) {
              secondaryMatch = scored.find((s) => s.profile.id === aiSecProfile.id) || null;
            }
          }
          if (aiClassification.isHybridStrategy) {
            isHybrid = true;
            hybridNotes = `AI suggested hybrid strategy: combining ${primaryMatch.profile.name} with secondary ${secondaryMatch?.profile.name || aiClassification.secondaryTrack}.`;
          }
        }
      }
    }

    // Detect potential concerns (e.g. missing skills, location/remote constraints, seniority)
    const potentialConcerns: string[] = [];
    if (primaryMatch.missingSkills.length > 0) {
      potentialConcerns.push(`Missing required skills: ${primaryMatch.missingSkills.join(', ')}`);
    }

    if (jobInput.locationRemoteRequirements) {
      const locReq = jobInput.locationRemoteRequirements.toLowerCase();
      if (locReq.includes('on-site') && !primaryMatch.profile.remotePreferences.onSiteAllowed) {
        potentialConcerns.push(`Job requires on-site presence, but active profile prefers remote/hybrid.`);
      }
    }

    if (aiClassification?.potentialConcerns && Array.isArray(aiClassification.potentialConcerns)) {
      for (const concern of aiClassification.potentialConcerns) {
        if (!potentialConcerns.includes(concern)) {
          potentialConcerns.push(concern);
        }
      }
    }

    return CareerProfileSelectionResultSchema.parse({
      selectedProfileId: primaryMatch.profile.id,
      selectedProfileTrack: primaryMatch.profile.track,
      selectedProfileName: primaryMatch.profile.name,
      confidenceScore: Math.min(1.0, Math.max(0.1, Number(confidence.toFixed(2)))),
      secondaryProfile: secondaryMatch
        ? {
            id: secondaryMatch.profile.id,
            track: secondaryMatch.profile.track,
            name: secondaryMatch.profile.name,
            confidenceScore: Math.min(1.0, Math.max(0.1, Number((secondaryMatch.totalScore / 100).toFixed(2)))),
          }
        : undefined,
      isHybridStrategy: isHybrid,
      hybridStrategyNotes: hybridNotes,
      reasoning,
      matchedSkills: primaryMatch.matchedSkills,
      missingSkills: primaryMatch.missingSkills,
      potentialConcerns,
    });
  }
}

