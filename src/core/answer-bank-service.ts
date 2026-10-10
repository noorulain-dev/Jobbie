import crypto from 'node:crypto';
import { MasterProfile } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import {
  SavedAnswerItem,
  SavedAnswerItemSchema,
  QueryAnswerResult,
  QueryAnswerResultSchema,
  QuestionCategory,
  QuestionResponseType,
} from '../types/answer-bank.js';
import { OpenRouterClient } from '../ai/openrouter-client.js';
import { normalizeQuestionText } from './answer-bank-normalizer.js';
import { ALL_CANONICAL_QUESTION_RULES } from './answer-bank-rules.js';

export interface AnswerQueryOptions {
  question: string;
  careerProfile?: CareerProfile | null;
  allowedDropdownOptions?: string[];
  expectedResponseType?: QuestionResponseType;
  contextAnswers?: Record<string, string>;
  useSemanticAI?: boolean;
}

export class AnswerBankService {
  private openRouterClient: OpenRouterClient;

  constructor(openRouterClient?: OpenRouterClient) {
    this.openRouterClient = openRouterClient || new OpenRouterClient();
  }

  public async answerQuestion(
    master: MasterProfile,
    options: AnswerQueryOptions,
    savedItems: SavedAnswerItem[] = []
  ): Promise<QueryAnswerResult> {
    const rawQuestion = options.question.trim();
    const normalized = normalizeQuestionText(rawQuestion);

    // 1. Saved Exact / Alias Match
    for (const item of savedItems) {
      const itemPatternNorm = normalizeQuestionText(item.questionPattern);
      const isExactMatch =
        itemPatternNorm === normalized || item.questionPattern.toLowerCase() === rawQuestion.toLowerCase();
      const isAliasMatch = item.aliases.some((alias) => normalizeQuestionText(alias) === normalized);

      if (isExactMatch || isAliasMatch) {
        if (item.conditionTrigger && options.contextAnswers) {
          const trigger = item.conditionTrigger;
          const contextVal =
            options.contextAnswers[trigger.dependsOnQuestion] ||
            options.contextAnswers[normalizeQuestionText(trigger.dependsOnQuestion)];
          if (contextVal && contextVal.toLowerCase() !== trigger.expectedValue.toLowerCase()) {
            continue;
          }
        }

        const resolvedAnswer = this.formatAnswer(
          item.canonicalAnswer,
          options.allowedDropdownOptions,
          item.responseType
        );

        return QueryAnswerResultSchema.parse({
          status: 'RESOLVED',
          question: rawQuestion,
          matchedPattern: item.questionPattern,
          category: item.category,
          responseType: item.responseType,
          answer: resolvedAnswer,
          source: item.source || 'user_confirmed',
          confidence: 'high',
          safeToAutoSubmit: item.safeToAutoSubmit,
          requiresHumanConfirmation: item.requiresHumanConfirmation,
          notes: 'Matched saved answer bank entry',
        });
      }
    }

    // 2. Direct Profile Links & Contact Check
    const directContactResult = this.resolveContactAndLinks(master, rawQuestion);
    if (directContactResult) return directContactResult;

    // 3. Deterministic Canonical Fact Rules
    for (const rule of ALL_CANONICAL_QUESTION_RULES) {
      const matches = rule.patterns.some((p) => p.test(rawQuestion) || p.test(normalized));
      if (matches) {
        const resolved = rule.canonicalFactResolver(master, options.careerProfile);
        if (resolved.answer !== null) {
          const finalAnswer = this.formatAnswer(
            resolved.answer,
            options.allowedDropdownOptions,
            rule.defaultResponseType
          );

          return QueryAnswerResultSchema.parse({
            status: 'RESOLVED',
            question: rawQuestion,
            matchedPattern: rule.category,
            category: rule.category,
            responseType: options.expectedResponseType || rule.defaultResponseType,
            answer: finalAnswer,
            source: `canonical_fact:${rule.category}`,
            confidence: 'high',
            safeToAutoSubmit: true,
            requiresHumanConfirmation: false,
            notes: resolved.notes,
          });
        }
      }
    }

    // 4. Semantic Matching via OpenRouter if enabled and available
    if (options.useSemanticAI !== false && this.openRouterClient.isAvailable()) {
      const semanticMatch = await this.semanticMatchQuestion(master, rawQuestion, options);
      if (semanticMatch) {
        return semanticMatch;
      }
    }

    // 5. UNKNOWN / NEEDS REVIEW (Zero Hallucination Guardrail)
    return QueryAnswerResultSchema.parse({
      status: 'UNKNOWN_NEEDS_REVIEW',
      question: rawQuestion,
      category: 'general',
      responseType: options.expectedResponseType || 'free_text',
      answer: null,
      source: 'unknown',
      confidence: 'unknown',
      safeToAutoSubmit: false,
      requiresHumanConfirmation: true,
      notes: 'No verified canonical fact or saved answer matched this question. Human input required.',
    });
  }

  private resolveContactAndLinks(master: MasterProfile, rawQuestion: string): QueryAnswerResult | null {
    if (/\blinkedin\b/i.test(rawQuestion)) {
      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question: rawQuestion,
        matchedPattern: 'LinkedIn URL',
        category: 'links',
        responseType: 'free_text',
        answer: master.personal.linkedin,
        source: 'canonical_fact:personal.linkedin',
        confidence: 'high',
        safeToAutoSubmit: true,
        requiresHumanConfirmation: false,
      });
    }

    if (/\bgithub\b/i.test(rawQuestion)) {
      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question: rawQuestion,
        matchedPattern: 'GitHub URL',
        category: 'links',
        responseType: 'free_text',
        answer: master.personal.github,
        source: 'canonical_fact:personal.github',
        confidence: 'high',
        safeToAutoSubmit: true,
        requiresHumanConfirmation: false,
      });
    }

    if (/\bportfolio\b|\bwebsite\b/i.test(rawQuestion)) {
      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question: rawQuestion,
        matchedPattern: 'Portfolio URL',
        category: 'links',
        responseType: 'free_text',
        answer: master.personal.portfolio,
        source: 'canonical_fact:personal.portfolio',
        confidence: 'high',
        safeToAutoSubmit: true,
        requiresHumanConfirmation: false,
      });
    }

    if (/\bphone\b|\bmobile\b|\btelephone\b/i.test(rawQuestion)) {
      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question: rawQuestion,
        matchedPattern: 'Phone Number',
        category: 'contact',
        responseType: 'free_text',
        answer: master.personal.phone,
        source: 'canonical_fact:personal.phone',
        confidence: 'high',
        safeToAutoSubmit: true,
        requiresHumanConfirmation: false,
      });
    }

    if (/\bemail\b/i.test(rawQuestion)) {
      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question: rawQuestion,
        matchedPattern: 'Email Address',
        category: 'contact',
        responseType: 'free_text',
        answer: master.personal.email,
        source: 'canonical_fact:personal.email',
        confidence: 'high',
        safeToAutoSubmit: true,
        requiresHumanConfirmation: false,
      });
    }

    return null;
  }

  public formatAnswer(
    answer: string,
    allowedDropdownOptions?: string[],
    responseType?: QuestionResponseType
  ): string {
    if (!allowedDropdownOptions || allowedDropdownOptions.length === 0) {
      if (responseType === 'yes_no') {
        const lower = answer.toLowerCase().trim();
        if (lower.startsWith('y') || lower === 'true' || lower === '1') return 'Yes';
        if (lower.startsWith('n') || lower === 'false' || lower === '0') return 'No';
      }
      return answer;
    }

    const normAnswer = answer.toLowerCase().trim();

    // Exact match in dropdown options
    const exact = allowedDropdownOptions.find((opt) => opt.toLowerCase().trim() === normAnswer);
    if (exact) return exact;

    // Substring / partial match or semantic degree match
    const partial = allowedDropdownOptions.find((opt) => {
      const optNorm = opt.toLowerCase().trim();
      if (optNorm.includes(normAnswer) || normAnswer.includes(optNorm)) return true;
      if (/master/i.test(optNorm) && /master/i.test(normAnswer)) return true;
      if (/bachelor/i.test(optNorm) && /bachelor/i.test(normAnswer)) return true;
      if (/doctor|ph\.?d/i.test(optNorm) && /doctor|ph\.?d/i.test(normAnswer)) return true;
      return false;
    });
    if (partial) return partial;

    return answer;
  }
  public createSavedAnswerItem(params: {
    question: string;
    answer: string;
    category: QuestionCategory;
    responseType: QuestionResponseType;
    aliases?: string[];
    allowedDropdownOptions?: string[];
    safeToAutoSubmit?: boolean;
    conditionTrigger?: { dependsOnQuestion: string; expectedValue: string };
  }): SavedAnswerItem {
    const now = new Date().toISOString();
    return SavedAnswerItemSchema.parse({
      id: crypto.randomUUID(),
      questionPattern: params.question.trim(),
      aliases: params.aliases || [],
      category: params.category,
      responseType: params.responseType,
      canonicalAnswer: params.answer.trim(),
      allowedDropdownOptions: params.allowedDropdownOptions,
      conditionTrigger: params.conditionTrigger,
      safeToAutoSubmit: params.safeToAutoSubmit ?? true,
      requiresHumanConfirmation: !(params.safeToAutoSubmit ?? true),
      source: 'user_confirmed',
      createdAt: now,
      updatedAt: now,
    });
  }

  private async semanticMatchQuestion(
    master: MasterProfile,
    question: string,
    options: AnswerQueryOptions
  ): Promise<QueryAnswerResult | null> {
    const prompt = `You are Jobby's strict factual question-answering agent.
You are given a job application question and canonical facts about the applicant.
Your task is to determine if the question can be definitively answered using ONLY the verified facts provided below.
DO NOT fabricate or guess. If the answer cannot be determined with certainty, answer "UNKNOWN".

Canonical Facts:
- Full Name: ${master.personal.firstName} ${master.personal.lastName}
- Email: ${master.personal.email}
- Phone: ${master.personal.phone}
- Location: ${master.personal.city}, ${master.personal.provinceState}, ${master.personal.country}
- Work Authorization: ${master.screening.workAuthorization}
- Sponsorship Required: ${master.screening.sponsorshipRequired}
- Notice Period: ${master.screening.noticePeriod}
- Years Experience: ${master.screening.yearsExperience}
- Remote Eligibility: ${master.screening.remoteEligibility}
- Highest Degree: ${master.education[0]?.degree || 'None'}
- Allowed Dropdown Options: ${options.allowedDropdownOptions ? options.allowedDropdownOptions.join(', ') : 'None specified'}

Application Question:
"${question}"

Return ONLY a JSON object:
{
  "canAnswer": boolean,
  "answer": string or null,
  "category": "work_authorization" | "sponsorship" | "notice_period" | "salary" | "education" | "experience_years" | "location" | "work_preference" | "contact" | "general",
  "confidence": "high" | "medium" | "low" | "unknown",
  "reasoning": string
}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(this.openRouterClient as any).apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby',
          'X-Title': 'Jobby Answer Bank',
        },
        body: JSON.stringify({
          model: (this.openRouterClient as any).defaultModel || 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content;
      if (!text) return null;

      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return null;

      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      if (!parsed.canAnswer || !parsed.answer) return null;

      const finalAnswer = this.formatAnswer(
        parsed.answer,
        options.allowedDropdownOptions,
        options.expectedResponseType
      );

      return QueryAnswerResultSchema.parse({
        status: 'RESOLVED',
        question,
        matchedPattern: 'openrouter_semantic_inference',
        category: parsed.category || 'general',
        responseType: options.expectedResponseType || 'free_text',
        answer: finalAnswer,
        source: 'openrouter_semantic_reasoning',
        confidence: parsed.confidence || 'medium',
        safeToAutoSubmit: parsed.confidence === 'high',
        requiresHumanConfirmation: parsed.confidence !== 'high',
        notes: parsed.reasoning,
      });
    } catch {
      return null;
    }
  }
}

