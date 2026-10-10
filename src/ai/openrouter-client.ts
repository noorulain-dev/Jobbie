import dotenv from 'dotenv';
import { SkillCategory } from '../types/provenance.js';

dotenv.config();

export interface SemanticSkillSuggestionRequest {
  documentedSkills: string[];
  experienceHighlights: string[];
}

export interface SemanticSkillSuggestionResult {
  skillName: string;
  category: SkillCategory;
  rationale: string;
  suggestedAliases: string[];
}

export interface SemanticProfileClassificationRequest {
  jobTitle: string;
  company?: string;
  jobDescription?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  seniority?: string;
  industry?: string;
  locationRemoteRequirements?: string;
  availableProfiles: Array<{
    id: string;
    track: string;
    name: string;
    description: string;
    targetJobTitles: string[];
  }>;
}

export interface SemanticProfileClassificationResponse {
  selectedTrack: string;
  confidenceScore: number;
  secondaryTrack?: string;
  isHybridStrategy: boolean;
  reasoning: string;
  potentialConcerns: string[];
}

export class OpenRouterClient {
  private apiKey: string | null;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here'
      ? process.env.OPENROUTER_API_KEY
      : null;
    this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet';
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  /**
   * Performs semantic inference of potentially omitted skills using OpenRouter.
   * STRICT GUARDRAIL: Temperature 0.0, zero fabrication, strict JSON schema output.
   */
  public async suggestOmittedSkills(
    request: SemanticSkillSuggestionRequest
  ): Promise<SemanticSkillSuggestionResult[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const prompt = `You are an expert career intelligence analysis agent.
Analyze the following documented technical skills and experience highlights:

Documented Skills:
${request.documentedSkills.join(', ')}

Experience Highlights:
${request.experienceHighlights.join('\n')}

Identify 3 to 7 foundational or closely related technical skills that are strongly implied by this documented experience, but might have been omitted from a concise resume.
STRICT RULES:
1. ONLY suggest skills that are direct prerequisites or standard companions to the documented work (e.g., if React is used heavily, HTML/CSS/DOM are implied).
2. DO NOT hallucinate unrelated frameworks, companies, or tools.
3. Every suggestion must provide a clear rationale tied directly to the provided experience.

Return ONLY a valid JSON array of objects with the following format:
[
  {
    "skillName": "HTML",
    "category": "frameworks_libraries",
    "rationale": "Directly required for the frontend React architecture in Mission Inbox",
    "suggestedAliases": ["HTML5"]
  }
]
Valid categories: programming_languages, frameworks_libraries, cloud_infrastructure, databases, ai_ml, queues_async, email_infrastructure, crm_marketing, billing_auth, developer_tools, hardware_iot, methodologies, other.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby',
          'X-Title': 'Jobby Career Brain',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.0,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (!text) return [];

      // Extract JSON array
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) return [];

      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Performs semantic classification of a Job Description to select the best Career Profile.
   * STRICT GUARDRAIL: Temperature 0.0, strict schema, zero fabrication.
   */
  public async classifyJobProfile(
    request: SemanticProfileClassificationRequest
  ): Promise<SemanticProfileClassificationResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = `You are an expert career intelligence classification agent for Jobby.
Analyze the following Job Description information and determine which Career Profile is the best primary match.
Also determine if a secondary profile should be blended (e.g. AI + software engineering, or technical support + solutions engineering).

Job Title: ${request.jobTitle}
Company: ${request.company || 'Not specified'}
Job Description Excerpt:
${request.jobDescription || 'None provided'}

Required Skills: ${(request.requiredSkills || []).join(', ')}
Preferred Skills: ${(request.preferredSkills || []).join(', ')}
Responsibilities: ${(request.responsibilities || []).join(', ')}
Seniority: ${request.seniority || 'Not specified'}
Industry: ${request.industry || 'Not specified'}
Location / Remote: ${request.locationRemoteRequirements || 'Not specified'}

Available Career Profiles:
${request.availableProfiles
  .map(
    (p) => `- Track ID: "${p.track}", Name: "${p.name}", Target Titles: [${p.targetJobTitles.join(', ')}], Description: ${p.description}`
  )
  .join('\n')}

STRICT RULES:
1. Select the primary track that best aligns with the core daily responsibilities and primary title.
2. If the role strongly bridges two domains (e.g., AI/LLM + backend systems, or customer success + solutions/automation), specify secondaryTrack and set isHybridStrategy to true.
3. Provide a confidenceScore between 0.0 and 1.0.
4. List any potentialConcerns (e.g., missing required seniority, stack mismatch, strict on-site requirement).

Return ONLY valid JSON matching this structure:
{
  "selectedTrack": "applied-ai",
  "confidenceScore": 0.95,
  "secondaryTrack": "software-engineering",
  "isHybridStrategy": true,
  "reasoning": "Detailed justification...",
  "potentialConcerns": ["..."]
}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/noor-ul-ain-k/jobby',
          'X-Title': 'Jobby Profile Selector',
        },
        body: JSON.stringify({
          model: this.defaultModel,
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
      return parsed;
    } catch {
      return null;
    }
  }
}

