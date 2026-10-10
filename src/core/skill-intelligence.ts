import crypto from 'node:crypto';
import { MasterProfile, SkillItem } from '../types/master-profile.js';
import { SkillRegistryEntry, SkillSuggestion } from '../types/skills.js';
import { DETERMINISTIC_INFERENCE_RULES } from './skill-rules.js';
import { normalizeSkillName } from './skill-normalizer.js';
import { OpenRouterClient } from '../ai/openrouter-client.js';

export class SkillIntelligenceService {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterClient?: OpenRouterClient) {
    this.openRouterClient = openRouterClient || new OpenRouterClient();
  }

  /**
   * Builds the comprehensive Skill Registry from the canonical Master Profile.
   * Maps each skill to canonical name, unified aliases, and deterministic claimability.
   */
  public buildRegistry(master: MasterProfile): SkillRegistryEntry[] {
    return master.skills.map((skill) => {
      const norm = normalizeSkillName(skill.name);
      const combinedAliases = Array.from(new Set([...norm.aliases, ...skill.aliases]));

      const canClaimOnResume = skill.status === 'EXPLICIT_KNOWN' || skill.status === 'USER_APPROVED_KNOWN';
      const canClaimOnScreening = canClaimOnResume;
      let claimReason = undefined;

      if (skill.status === 'DO_NOT_CLAIM') {
        claimReason = 'Prohibited by user directive. Must never be claimed.';
      } else if (skill.status === 'LEARNING_TARGET') {
        claimReason = 'Learning target in progress. Cannot be claimed as work experience.';
      } else if (skill.status === 'INFERRED_KNOWN') {
        claimReason = 'Inferred recommendation awaiting one-time user approval.';
      }

      return {
        id: skill.id,
        canonicalName: norm.canonical,
        aliases: combinedAliases,
        category: skill.category,
        status: skill.status,
        evidence: skill.evidence,
        lastVerifiedAt: skill.provenance.verifiedAt || master.lastUpdated,
        notes: skill.provenance.notes,
        claimability: {
          canClaimOnResume,
          canClaimOnScreening,
          reason: claimReason,
        },
        source: skill.provenance.sourceRef,
        provenance: skill.provenance,
      };
    });
  }

  /**
   * Analyzes existing documented skills and experiences to identify potentially omitted skills.
   * Employs deterministic inference rules first, then semantic OpenRouter reasoning if available.
   * Returned suggestions are marked as INFERRED_KNOWN with status "pending".
   */
  public async discoverInferredSkills(
    master: MasterProfile,
    options: { useSemanticAI?: boolean } = { useSemanticAI: true }
  ): Promise<SkillSuggestion[]> {
    const existingCanonicalMap = new Map<string, SkillItem>();
    for (const skill of master.skills) {
      const norm = normalizeSkillName(skill.name);
      existingCanonicalMap.set(norm.canonical.toLowerCase(), skill);
      for (const a of skill.aliases) {
        existingCanonicalMap.set(a.toLowerCase(), skill);
      }
    }

    const suggestions: SkillSuggestion[] = [];
    const suggestedCanonicalNames = new Set<string>();

    // 1. Deterministic Inference Rules (No LLM required)
    for (const rule of DETERMINISTIC_INFERENCE_RULES) {
      const sourceKey = rule.sourceSkillCanonical.toLowerCase();
      const targetNorm = normalizeSkillName(rule.inferredSkillCanonical);
      const targetKey = targetNorm.canonical.toLowerCase();

      if (existingCanonicalMap.has(sourceKey) && !existingCanonicalMap.has(targetKey) && !suggestedCanonicalNames.has(targetKey)) {
        const sourceSkill = existingCanonicalMap.get(sourceKey)!;

        suggestions.push({
          id: crypto.randomUUID(),
          canonicalName: targetNorm.canonical,
          aliases: Array.from(new Set([...targetNorm.aliases, ...rule.suggestedAliases])),
          category: rule.category,
          rationale: rule.rationale,
          source: 'deterministic_rule',
          derivedFromSkill: sourceSkill.name,
          evidence: sourceSkill.evidence,
          status: 'INFERRED_KNOWN',
          createdAt: new Date().toISOString(),
          decision: 'pending',
        });

        suggestedCanonicalNames.add(targetKey);
      }
    }

    // 2. Semantic OpenRouter Reasoning (Only where API key is configured and semantic reasoning requested)
    if (options.useSemanticAI && this.openRouterClient.isAvailable()) {
      const documentedSkills = master.skills.map((s) => s.name);
      const experienceHighlights = master.experience.flatMap((e) =>
        e.bulletPoints.map((b) => `${e.company} (${e.title}): ${b.text}`)
      );

      const aiSuggestions = await this.openRouterClient.suggestOmittedSkills({
        documentedSkills,
        experienceHighlights,
      });

      for (const aiSugg of aiSuggestions) {
        const norm = normalizeSkillName(aiSugg.skillName);
        const targetKey = norm.canonical.toLowerCase();

        if (!existingCanonicalMap.has(targetKey) && !suggestedCanonicalNames.has(targetKey)) {
          suggestions.push({
            id: crypto.randomUUID(),
            canonicalName: norm.canonical,
            aliases: Array.from(new Set([...norm.aliases, ...aiSugg.suggestedAliases])),
            category: aiSugg.category,
            rationale: aiSugg.rationale,
            source: 'semantic_openrouter',
            evidence: [],
            status: 'INFERRED_KNOWN',
            createdAt: new Date().toISOString(),
            decision: 'pending',
          });

          suggestedCanonicalNames.add(targetKey);
        }
      }
    }

    return suggestions;
  }

  /**
   * One-time user approval workflow:
   * Converts an INFERRED_KNOWN suggestion to USER_APPROVED_KNOWN and merges into Master Profile.
   * Once approved, future applications can use this skill freely without re-asking.
   */
  public approveInferredSkill(
    master: MasterProfile,
    suggestion: SkillSuggestion,
    userNotes?: string
  ): { updatedMaster: MasterProfile; newSkill: SkillItem } {
    const norm = normalizeSkillName(suggestion.canonicalName);
    const now = new Date().toISOString();

    const newSkill: SkillItem = {
      id: crypto.randomUUID(),
      name: norm.canonical,
      category: suggestion.category,
      status: 'USER_APPROVED_KNOWN',
      aliases: Array.from(new Set([...norm.aliases, ...suggestion.aliases])),
      evidence: suggestion.evidence,
      provenance: {
        provenance: 'inferred-but-user-approved',
        sourceRef: `suggestion:${suggestion.id}:${suggestion.source}`,
        sourceExcerpt: suggestion.rationale,
        approvedByUser: true,
        verifiedAt: now,
        notes: userNotes || `User approved from inference (${suggestion.rationale})`,
      },
    };

    const updatedSkills = [...master.skills, newSkill];
    const updatedMaster: MasterProfile = {
      ...master,
      lastUpdated: now,
      skills: updatedSkills,
    };

    return { updatedMaster, newSkill };
  }

  /**
   * Marks a skill or suggestion as a LEARNING_TARGET (never claimed as active work experience).
   */
  public markAsLearningTarget(
    master: MasterProfile,
    skillName: string,
    category: SkillItem['category'] = 'other',
    notes?: string
  ): { updatedMaster: MasterProfile; learningSkill: SkillItem } {
    const norm = normalizeSkillName(skillName);
    const now = new Date().toISOString();

    const learningSkill: SkillItem = {
      id: crypto.randomUUID(),
      name: norm.canonical,
      category,
      status: 'LEARNING_TARGET',
      aliases: norm.aliases,
      evidence: [],
      provenance: {
        provenance: 'learning-target',
        sourceRef: 'user_goals',
        approvedByUser: true,
        notes: notes || 'Target learning goal; strictly prohibited from claiming as active experience.',
      },
    };

    const updatedMaster: MasterProfile = {
      ...master,
      lastUpdated: now,
      skills: [...master.skills, learningSkill],
    };

    return { updatedMaster, learningSkill };
  }

  /**
   * Prohibits a skill or claim (DO_NOT_CLAIM) from ever appearing in any application or resume.
   */
  public prohibitClaim(
    master: MasterProfile,
    skillName: string,
    reason: string
  ): { updatedMaster: MasterProfile; prohibitedSkill: SkillItem } {
    const norm = normalizeSkillName(skillName);
    const now = new Date().toISOString();

    const prohibitedSkill: SkillItem = {
      id: crypto.randomUUID(),
      name: norm.canonical,
      category: 'other',
      status: 'DO_NOT_CLAIM',
      aliases: norm.aliases,
      evidence: [],
      provenance: {
        provenance: 'prohibited-from-claiming',
        sourceRef: 'user_directive',
        approvedByUser: true,
        notes: reason,
      },
    };

    const updatedMaster: MasterProfile = {
      ...master,
      lastUpdated: now,
      skills: [...master.skills, prohibitedSkill],
    };

    return { updatedMaster, prohibitedSkill };
  }

  }

