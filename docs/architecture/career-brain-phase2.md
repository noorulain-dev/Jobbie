# Phase 2 Architecture & Implementation Plan: Career Brain / Master Profile System

## 1. Codebase Baseline & Current State Assessment

A comprehensive audit of the workspace at `d:\Coding stuff\jobby` confirms the current baseline:

1. **Frontend Architecture:**
   - **Current State:** Clean slate in `jobby`.
   - **Phase 2 Target:** A local-first web UI / dashboard (e.g., React + Vite) designed to review, verify, and edit Master Profile facts, browse career-profile projections, and approve/reject AI suggestions.

2. **Browser-Extension Architecture:**
   - **Current State:** Clean slate in `jobby`.
   - **Phase 2 / Downstream Target:** Communicates strictly with the local agent/backend via standard REST or WebSocket on `localhost` to fetch tailored application snippets and fill job applications based on the active Career Profile.

3. **Local-Agent / Backend Architecture:**
   - **Current State:** Clean slate.
   - **Phase 2 Target:** Node.js/TypeScript local daemon serving endpoints on `localhost`, orchestrating profile storage, provenance validation, profile projection, and OpenRouter LLM requests.

4. **Database & Persistence Approach:**
   - **Current State:** File-based data storage inside `data/`:
     - `data/source/`: Raw canonical source files (`NoorUlAin_Khurshid_Resume_MUST.pdf`, `profile-seed.json`).
     - `data/profile/`: Holds active structured profiles (`master-profile.json`, `career-profiles/`).
     - `data/generated/`: Derived artifacts, tailored resumes, application exports.
   - **Phase 2 Target:** Local-first schema with versioned atomic JSON storage and SQLite index for audit logs, full-text search, and quick queries.

5. **OpenRouter Integration:**
   - **Current State:** None yet initialized.
   - **Phase 2 Target:** Direct HTTPS API client to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) using standard structured JSON schemas, strict system prompts, and strict provenance enforcement rules.

6. **Existing Shared Types & Interfaces:**
   - **Current State:** Defined implicitly in `data/source/profile-seed.json` (sections: `personal`, `screening`, `education`, `technical`, `experience`, `projects`, `certifications`, `awards`, `leadershipAndVolunteering`, `languagesSpoken`).
   - **Phase 2 Target:** Formalized TypeScript interfaces with JSON schema validation (Zod) enforcing provenance tags and verification states on every fact node.

7. **Authentication & Security Boundaries:**
   - **Current State:** Completely local environment.
   - **Phase 2 Target:** Localhost-only binding (`127.0.0.1`), zero cloud telemetry, API keys stored exclusively in local `.env` files (never committed or exposed). No PII is sent to external services except prompts explicitly dispatched through user-controlled OpenRouter models.

8. **File-Storage Approach:**
   - **Current State:** Hierarchical directories under `data/`:
     - `data/source/`: Ingestion inputs.
     - `data/profile/`: Master Profile and Career Profiles.
     - `data/generated/`: Projections, resume exports, tailored outputs.
   - **Phase 2 Target:** Keep and expand this clean directory structure with versioned backups and append-only changelogs (`master-profile.history.jsonl`).

9. **Testing Setup:**
   - **Current State:** None yet configured.
   - **Phase 2 Target:** Vitest test runner testing schemas, provenance immutability rules, projection algorithms, and negative assertion suites (verifying the AI cannot fabricate unverified facts).

10. **Environment & Configuration System:**
    - **Current State:** Clean slate.
    - **Phase 2 Target:** `.env` loaded via `dotenv` (`OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL`, `JOBBY_DATA_DIR`, `PORT`).


---

## 2. Core Architectural Principles for the Career Brain

The Career Brain is built on five non-negotiable principles:

```
┌──────────────────────────────────────────────────────────┐
│                   MASTER PROFILE                         │
│  (Canonical Truth: Verified Facts + Strict Provenance)   │
└────────────────────────────┬─────────────────────────────┘
                             │ Projections & Weightings
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  CAREER PROFILES                         │
│   (Software Eng, Applied AI, RevTech, Support, etc.)     │
└────────────────────────────┬─────────────────────────────┘
                             │ Tailoring & Screening Align
                             ▼
┌──────────────────────────────────────────────────────────┐
│          JOB-SPECIFIC APPLICATION PROFILE                │
│    (Context-tailored bullets, cover letters, Q&A)        │
└──────────────────────────────────────────────────────────┘
```

1. **Master Profile is the Immutable Canonical Source of Truth:**
   AI agents **MUST NOT** silently insert, alter, or delete canonical facts. Any AI recommendation remains in a pending quarantine (`inferred-pending-approval`) until explicitly authorized by the user.

2. **Absolute Grounding (Zero Hallucination / Zero Fabrication):**
   The system must **NEVER** invent:
   - Employers or company names
   - Degrees, institutions, or graduation dates
   - Employment dates or gaps
   - Job titles or seniority history
   - Certifications or licenses
   - Geographic locations or residency
   - Inflated years of experience
   - Factually untrue metric claims

3. **Fine-Grained Fact Provenance & Source Taxonomy:**
   Every fact (experience bullet, skill, degree, metric, tool) carries explicit provenance metadata:
   - `provenance`:
     - `user-entered`: Direct user input, including `data/source/profile-seed.json` (user-supplied canonical baseline).
     - `document-derived`: Parsed directly from official uploaded documents (e.g., `data/source/NoorUlAin_Khurshid_Resume_MUST.pdf`).
     - `inferred-but-user-approved`: Skills or facts suggested by AI or inferred by the system that were explicitly approved by the user.
     - `learning-target`: Skills/knowledge the user is intentionally learning; never claimed as past or present work experience.
     - `prohibited-from-claiming`: Explicitly banned claims, skills, or metrics that Jobby must NEVER assert.
     - `verified`: Confirmed by user against official documentation or verified credentials.
   - `sourceRef`: Pointer to the document path, user entry session, or timestamp where it originated.

4. **Skill & Knowledge Categorization Matrix:**
   Skills must NOT be assumed to be `Category A` merely because they appear in the seed JSON. The seed represents user-supplied data, but each skill retains an appropriate categorization:
   - **Category A (Explicitly Known):** Direct user-confirmed, demonstrable knowledge actively practiced.
   - **Category B (Safely Inferrable):** Directly tied to proven work (e.g., extensive React/TypeScript implying HTML/CSS/DOM knowledge, or Postfix/Dovecot implying SMTP/IMAP understanding).
   - **Category C (Known but Omitted):** Valid skills the user possesses, but omitted from specific one-page resumes due to brevity.
   - **Category D (Learning Targets):** Skills currently being acquired; valid for career interest or future study, but never falsely listed as past work experience.
   - **Category E (Prohibited Claims):** Tools, domains, or claims the user refuses to claim (e.g., claims of production C++ driver development or deceptive enterprise architecture).

5. **Conflict Preservation & User Review Gate (Never Silent Overwrites):**
   Where `data/source/profile-seed.json` (`user-entered`) and an uploaded resume PDF (`document-derived`) contain differing or conflicting information:
   - The system **MUST NOT** automatically choose one or overwrite the other.
   - The conflict is explicitly preserved in the data structure under a `conflicts` quarantine array on the node or profile level.
   - The field is flagged as `conflict-pending-resolution`.
   - The user must explicitly review and resolve the conflict before the Master Profile treats the value as canonical and settled.

6. **Multi-Track Career Profiles (Projections without Mutation):**
   A Career Profile does not copy or overwrite the Master Profile. Instead, it defines:
   - Priority weightings on skill tags and project domains.
   - Selected bullet points tailored for the discipline.
   - Framing guidance (e.g., emphasizing distributed systems vs. ML fine-tuning vs. billing pipeline reliability).
   - Supported default profiles:
     1. Software Engineering
     2. Applied AI / AI Engineering
     3. Revenue Tech / Automation
     4. Customer Success / Technical Support
     5. Custom / Future extensions
---

## 3. Data Schema & Types Design

### 3.1 Provenance Types
```typescript
export type FactProvenance =
  | 'verified'
  | 'user-entered'
  | 'document-derived'
  | 'inferred-but-user-approved'
  | 'learning-target'
  | 'prohibited-from-claiming';

export type SkillCategory = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ProvenanceMetadata {
  provenance: FactProvenance;
  category?: SkillCategory;
  sourceDocId?: string;
  sourceTextExcerpt?: string;
  verifiedAt?: string;
  approvedByUser: boolean;
  notes?: string;
  isConflictPending?: boolean;
}

export interface FactConflict {
  id: string;
  factPath: string; // e.g. "experience[0].dates", "screening.yearsExperience"
  values: {
    source: 'user-entered' | 'document-derived';
    sourceRef: string;
    value: any;
  }[];
  detectedAt: string;
  resolved: boolean;
  resolvedValue?: any;
  resolvedBy?: 'user';
  resolvedAt?: string;
}
```

### 3.2 Master Profile Schema
```typescript
export interface ProvenancedSkill {
  id: string;
  name: string;
  category: SkillCategory; // A, B, C, D, E
  group: 'languages' | 'frameworks' | 'cloud' | 'data' | 'async' | 'email' | 'billing' | 'crm' | 'tools';
  provenance: ProvenanceMetadata;
}

export interface ProvenancedExperienceBullet {
  id: string;
  text: string;
  associatedSkills: string[];
  metrics?: string[];
  provenance: ProvenanceMetadata;
}

export interface ProvenancedExperience {
  id: string;
  company: string;
  role: string;
  dates: string;
  location: string;
  bulletPoints: ProvenancedExperienceBullet[];
  provenance: ProvenanceMetadata;
}

export interface ProvenancedEducation {
  id: string;
  degree: string;
  major?: string;
  institution: string;
  location?: string;
  status?: string;
  gpa?: string;
  coursework?: string[];
  provenance: ProvenanceMetadata;
}

export interface MasterProfile {
  schemaVersion: '1.0.0';
  lastUpdated: string;
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    provinceState: string;
    country: string;
    linkedin: string;
    github: string;
    portfolio: string;
    provenance: ProvenanceMetadata;
  };
  screening: {
    workAuthorization: string;
    sponsorshipRequired: string;
    targetSalary: string;
    noticePeriod: string;
    yearsExperience: string;
    provenance: ProvenanceMetadata;
  };
  skills: ProvenancedSkill[];
  experience: ProvenancedExperience[];
  projects: ProvenancedProject[];
  education: ProvenancedEducation[];
  certifications: ProvenancedCertification[];
  awards: string[];
  languagesSpoken: { language: string; proficiency: string }[];
  conflicts: FactConflict[]; // Preserved conflicts flagged for explicit user review
}
```

### 3.3 Career Profile Schema (View / Lens)
```typescript
export interface CareerProfile {
  id: string; // e.g., 'applied-ai', 'software-eng', 'rev-tech', 'support'
  name: string;
  targetTitles: string[];
  summaryHeadline: string;
  summaryNarrative: string;
  primarySkills: string[]; // Skill IDs from Master Profile prioritized
  secondarySkills: string[];
  hiddenSkills: string[]; // Exclude irrelevant clutter
  highlightedProjectIds: string[];
  experienceBulletRankings: Record<string, string[]>; // experienceId -> ordered bullet IDs
  prohibitedClaims: string[]; // Direct assertions never to output
}
```
---

## 4. Exact Files to Create and Structure in Phase 2

Below is the directory map of the modular files to be created:

```
jobby/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── data/
│   ├── source/
│   │   ├── NoorUlAin_Khurshid_Resume_MUST.pdf
│   │   └── profile-seed.json
│   ├── profile/
│   │   ├── master-profile.json
│   │   ├── pending-suggestions.json
│   │   └── career-profiles/
│   │       ├── software-engineering.json
│   │       ├── applied-ai.json
│   │       ├── revenue-tech.json
│   │       └── customer-success.json
│   └── generated/
├── src/
│   ├── types/
│   │   ├── provenance.ts
│   │   ├── master-profile.ts
│   │   ├── career-profile.ts
│   │   └── application-profile.ts
│   ├── core/
│   │   ├── storage.ts              // Reads/writes data/profile with atomic locks & schema validation
│   │   ├── provenance-guard.ts     // Prevents hallucination, validates Category A-E rules
│   │   ├── migrator.ts             // Converts profile-seed.json -> master-profile.json with initial provenance
│   │   └── projector.ts            // Generates Career Profile projections from Master Profile
│   ├── ai/
│   │   ├── openrouter-client.ts    // Local client with token tracking & schema validation
│   │   ├── prompts/
│   │   │   ├── inference-recommender.prompt.ts  // Suggests missing Category B or C skills to user
│   │   │   └── bullet-aligner.prompt.ts         // Re-weights bullets for job matching
│   │   └── guardrails.ts           // Negative assertions: blocks invention of companies, dates, credentials
│   ├── server/
│   │   ├── index.ts                // Localhost HTTP server (e.g., Express or Fastify)
│   │   └── routes/
│   │       ├── profile.routes.ts
│   │       ├── career.routes.ts
│   │       └── suggestions.routes.ts
│   └── index.ts
├── tests/
│   ├── provenance-guard.test.ts
│   ├── projector.test.ts
│   ├── negative-assertions.test.ts
│   └── migration.test.ts
└── docs/
    └── architecture/
        └── career-brain-phase2.md
```

---

## 5. Implementation Roadmap (Step-by-Step)

### Step 1: Foundation, Tooling, & Type System
1. Initialize `package.json` and TypeScript configuration (`tsconfig.json`) configured for modern Node/ESM.
2. Install minimal, lightweight dependencies:
   - `zod` for runtime validation.
   - `dotenv` for environment management.
   - `vitest` for robust automated testing.
3. Write `src/types/provenance.ts`, `src/types/master-profile.ts`, and `src/types/career-profile.ts` with complete Zod schemas.

### Step 2: Seed Ingestion, Conflict Detection & Provenance Setup
1. Implement `src/core/migrator.ts`:
   - Ingests `data/source/profile-seed.json` strictly as **`user-entered`** canonical input.
   - Assigns unique IDs to skills, bullets, projects, and education nodes.
   - Does NOT assume all seed skills are automatically `Category A`; assigns proper baseline categorization (Category A for direct work-backed skills, Category C for known/omitted where applicable, Category D for learning targets, Category E for prohibited).
   - Ingests/compares against parsed resume data (`document-derived` from `NoorUlAin_Khurshid_Resume_MUST.pdf`).
   - If discrepancies exist between `user-entered` JSON facts and `document-derived` PDF facts (e.g. differing dates, titles, bullet wording, or metrics), **does not overwrite either**.
   - Preserves both in `conflicts[]` array flagged as `isConflictPending: true`.
   - Generates and writes `data/profile/master-profile.json` with conflict flags for explicit user resolution.

### Step 3: Provenance Guard & Guardrails Engine
1. Implement `src/core/provenance-guard.ts`:
   - Enforces the Categorization Matrix (A, B, C, D, E).
   - Validates that every claim in any output is backed by an approved fact in `master-profile.json`.
   - Rejects any operation attempting to mutate canonical fields without user approval.
2. Implement negative assertion test suite (`tests/negative-assertions.test.ts`):
   - Confirms that unauthorized company names, degrees, and unapproved skills are rejected with clear violations.

### Step 4: Multi-Track Career Profiles (Projections)
1. Define the 4 initial Career Profiles under `data/profile/career-profiles/`:
   - `software-engineering.json`: Emphasizes Golang, Python, TypeScript, PostgreSQL, Celery, Docker, high-availability architecture.
   - `applied-ai.json`: Emphasizes PyTorch, Transformers, Vision Transformers, RAG, Ollama, model optimization, Shell Eco-Marathon telemetry.
   - `revenue-tech.json`: Emphasizes Stripe, Chargebee, Postfix/Dovecot, deliverability, HubSpot, Attio, MRR growth.
   - `customer-success.json`: Emphasizes Vitally, onboarding automation, technical support, student instruction, clear technical communication.
2. Implement `src/core/projector.ts`:
   - Accepts `(MasterProfile, CareerProfileId)` and returns a projection without mutating the Master Profile.

### Step 5: Safe AI Skill Recommendation & Alignment Engine (OpenRouter)
1. Implement `src/ai/openrouter-client.ts` with local caching and temperature 0.0 for deterministic factual extraction.
2. Implement suggestion flow:
   - OpenRouter analyzes user bullets and identifies potential Category B/C skills (e.g., noticing React + TypeScript and suggesting HTML5 / CSS3).
   - Output is saved to `data/profile/pending-suggestions.json`.
   - **No Master Profile mutation occurs** until the user explicitly calls an `approveSuggestion` API or CLI method.

### Step 6: Local Server & Interface
1. Expose local-first REST API (`localhost:3141`) for inspecting facts, viewing career profiles, and approving/rejecting suggestions.
2. Ensure everything operates completely offline/locally, communicating only with OpenRouter when an explicit AI analysis is requested.

---

## 6. Verification & Quality Gates

To mark Phase 2 complete, the following gates must pass:
1. **Schema Integrity:** `master-profile.json` validates 100% against Zod schemas.
2. **Zero Inventions Test:** Automated tests prove that an LLM prompt asking for fabricated credentials triggers immediate validation rejection.
3. **Category Distinction Test:** The system cleanly distinguishes Category A (explicit), B (inferrable), C (omitted), D (learning target), and E (forbidden).
4. **Projection Isolation:** Projections for Software Engineering, Applied AI, RevTech, and Support generate different highlighted facts without changing a single byte in `master-profile.json`.
5. **Conflict Preservation Gate:** Any conflict between `user-entered` JSON data and `document-derived` PDF data is preserved and flagged in `conflicts[]` without silent overwrite, verified via automated test.
6. **Provenance Accuracy Gate:** `profile-seed.json` is classified strictly as `user-entered`; document uploads as `document-derived`; approved AI recommendations as `inferred-but-user-approved`; targets as `learning-target`; and forbidden items as `prohibited-from-claiming`.




