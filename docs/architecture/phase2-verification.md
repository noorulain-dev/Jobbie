# Phase 2 Verification: Career Brain & Master Profile System

## Executive Summary

Phase 2 implementation for Jobby's **Career Brain & Master Profile System** has been completed, tested, and verified against all architectural and operational requirements.

All **11 test suites** comprising **72 automated tests** run cleanly and pass 100%.

---

## 1. What Was Implemented

### 1.1 Canonical Master Profile Engine
- **Zod Schema Validation & Data Modeling** (`src/types/master-profile.ts`, `src/types/provenance.ts`):
  - Strictly models all candidate facts: personal details, contact URLs, work screening (authorization, sponsorship, salary, notice period), education, work experience, projects, skills, certifications, awards, leadership, and languages.
- **Evidence Linking & Seed Migration** (`src/core/migrator.ts`):
  - Ingests canonical raw source data (`profile-seed.json`) and establishes bidirectional evidence links between skills, experience bullet points, and project repositories.
- **SQLite Persistence & JSON Atomic File Sync** (`src/db/database.ts`, `src/core/storage.ts`):
  - Dual local persistence: WAL-mode SQLite database (`master-profile.db`) and human-readable formatted JSON (`master-profile.json`).

### 1.2 Multi-Track Career Profiles & Projections
- **4 Initial Targeted Profiles**:
  - `software-engineering`: Golang, Python, TypeScript, PostgreSQL, Celery, Docker, high-availability distributed systems.
  - `applied-ai`: PyTorch, Transformers, Vision Transformers, RAG pipelines, Ollama, model optimization.
  - `revenue-tech`: Stripe, Chargebee, Postfix, Dovecot, Postal, deliverability warming, CRM syncing (HubSpot, Attio).
  - `customer-success`: Vitally, client onboarding velocity, technical troubleshooting, support engineering.
- **Profile Projection Engine** (`src/core/projector.ts`):
  - Emphasizes and filters skills, experience, and projects for specific tracks without duplicating facts or altering the canonical Master Profile.

### 1.3 Automatic Career Profile Selection
- **Deterministic & Semantic Matcher** (`src/core/profile-selector.ts`, `src/types/career-profile.ts`):
  - Inputs: title, company, description, required skills, preferred skills, responsibilities, seniority, industry, location/remote requirements.
  - Outputs: selected profile, confidence score, secondary profile (if hybrid), reasoning evidence, matched skills, missing skills, potential concerns.
  - Hybrid Role Blending: detects positions bridging multiple specialties (e.g. AI + software engineering) and formulates a blended strategy.

### 1.4 Application Answer Bank
- **Deterministic Pattern & Normalization Rules** (`src/core/answer-bank-rules.ts`, `src/core/answer-bank-normalizer.ts`):
  - Canonical resolution of repetitive screening questions: work authorization, visa sponsorship, notice period, salary, highest education level, professional experience years, location, remote eligibility, and direct contact links.
  - Normalized matching for punctuation, spacing, and casing differences.
- **Answer Bank Service & Persistence** (`src/core/answer-bank-service.ts`):
  - Resolves exact and paraphrased questions.
  - Formats dropdown selections and Yes/No answers.
  - Supports conditional question branching.
  - Learns newly confirmed answers so they become automatically reusable.
  - **Zero Fabrication Guardrail**: returns `UNKNOWN_NEEDS_REVIEW` with `answer: null`, `safeToAutoSubmit: false`, and `requiresHumanConfirmation: true` for unverified questions.

### 1.5 Skill Intelligence & Suggestion Engine
- **Inference Engine** (`src/core/skill-intelligence.ts`, `src/core/skill-rules.ts`):
  - Discovers foundational omitted skills (e.g., detecting React experience and inferring HTML/CSS proficiency).
  - One-click approval workflow merges inferred skills into Master Profile as `USER_APPROVED_KNOWN`.
  - Supports `LEARNING_TARGET` and `DO_NOT_CLAIM` directives.

### 1.6 Profile Versioning, Provenance & Rollback Integrity
- **Provenance Sources** (`src/types/provenance.ts`):
  - Categorizes fact origins: `USER_ENTERED`, `RESUME_IMPORT`, `PROFILE_IMPORT`, `USER_APPROVED_INFERENCE`, `SYSTEM_GENERATED_SUGGESTION`.
- **Field Diffing Engine** (`src/core/profile-differ.ts`):
  - Tracks `timestamp`, `fieldPath`, `previousValue`, `newValue`, `action`, `actor`, and `changeReason`.
- **Rollback Engine** (`src/core/storage.ts`, `src/db/database.ts`):
  - Restores any historical snapshot with full data integrity.
  - Automatically records the rollback event as a new version entry.
- **Provenance Guard** (`src/core/provenance-guard.ts`):
  - Strictly prevents unapproved LLM or system suggestions from being recorded as verified canonical facts.

### 1.7 Local Management UI & REST API Server
- **Server** (`src/server/index.ts`, `src/cli/ui.ts`):
  - Serves local SPA on `http://127.0.0.1:3141/`.
  - Exposes REST endpoints for Master Profile facts, Career Profiles, Skill Intelligence, Answer Bank, Version History, and Rollback.
  - Includes JSON import and export with recursive secret sanitization (`src/core/profile-sanitizer.ts`).

---

## 2. Tests Performed

The test suite covers unit, integration, guardrail, and end-to-end flows:

1. **`tests/phase2-verification.test.ts` (13 tests)**: Complete 16-step end-to-end verification flow from seed migration to API validation.
2. **`tests/profile-selector.test.ts` (7 tests)**: Deterministic role classification across Software Engineering, Applied AI, Revenue Tech, and Customer Success; hybrid role blending; concerns detection; and Master Profile immutability.
3. **`tests/answer-bank.test.ts` (13 tests)**: Screening categories, dropdown & yes/no formatting, zero fabrication unknown review, learned answers reusability, conditional branching.
4. **`tests/profile-versioning.test.ts` (6 tests)**: Version creation, field diffs tracking (`previousValue` vs. `newValue`), rollback and data integrity restoration, rejection of unapproved LLM suggestions.
5. **`tests/server-ui.test.ts` (8 tests)**: SPA delivery, REST endpoints, recursive secret stripping on JSON export.
6. **`tests/provenance-guard.test.ts` (4 tests)**: Rejection of invented credentials and claim permissions.
7. **`tests/skill-intelligence.test.ts` (5 tests)**: Skill registry compilation, inference discovery, and user approval workflow.
8. **`tests/skill-normalization.test.ts` (6 tests)**: Canonical name mapping and alias resolution.
9. **`tests/storage-projector.test.ts` (4 tests)**: SQLite persistence and Career Profile projection isolation.
10. **`tests/seed-migrator.test.ts` (1 test)**: Seed ingestion and evidence linking.
11. **`tests/schema-validation.test.ts` (5 tests)**: Zod schema validations and regex validators.

---

## 3. Failures Found and Fixes Made During Phase 2

1. **Sponsorship vs. Work Authorization Regex Collision:**
   - *Issue*: Questions like *"Will you now or in the future require visa sponsorship to maintain employment authorization?"* matched the work authorization regex because of the word "authorization", returning "Yes" instead of "No".
   - *Fix*: Prioritized the sponsorship rule before work authorization in `src/core/answer-bank-rules.ts` and refined patterns to distinguish sponsorship inquiries.
2. **Education Level Dropdown Normalization:**
   - *Issue*: Canonical degree string *"Master of Science in Computer Science"* failed to match dropdown option *"Master's Degree"*.
   - *Fix*: Enhanced `formatAnswer()` in `src/core/answer-bank-service.ts` with semantic degree matching (handling Bachelor's, Master's, Doctorate/PhD).
3. **Conditional Question Trigger Matching:**
   - *Issue*: Conditional questions were evaluating canonical rules before checking condition triggers.
   - *Fix*: Positioned saved item conditional checks prior to generic pattern fallback.
4. **Paraphrased Question Rule Expansions:**
   - *Issue*: Phrasings such as *"Are you permitted to work in Canada without restriction?"*, *"Where do you live currently?"*, and *"How quickly can you start?"* were falling through to unknown review.
   - *Fix*: Expanded canonical question pattern regexes to cover "permitted to work", "where do you live", "how quickly can you start", and "university degree".
5. **Profile Selector Skill Matching on Dynamic Profiles:**
   - *Issue*: When testing with newly created/migrated profiles, random UUID mismatches between static JSON and ephemeral in-memory profiles caused skill match misses.
   - *Fix*: Created dynamic profile generator helpers in test suites using `ProfileProjector.createCareerProfile()`, ensuring skill IDs reference the active Master Profile.
6. **Answer Bank In-Memory Seeding for Server Tests:**
   - *Issue*: When running tests against an in-memory SQLite storage (`:memory:`), `seedInitialAnswerBank()` had executed before the master profile was migrated.
   - *Fix*: Updated test setup to invoke `seedInitialAnswerBank(storage)` after the master profile is saved.

---

## 4. Remaining Limitations

1. **OpenRouter Network Dependency for Semantic Inference:**
   - While deterministic matching operates 100% offline with zero external calls, semantic fallback requires an active internet connection and valid `OPENROUTER_API_KEY`. When offline, the system safely falls back to deterministic matching and returns `UNKNOWN_NEEDS_REVIEW` rather than guessing.
2. **Single-User Architecture:**
   - Jobby is intentionally designed as a local-first single-user application bound to `127.0.0.1`. It does not support multi-tenant role-based access control (RBAC).
3. **Pre-configured Career Profile Tracks:**
   - 4 foundational tracks are pre-configured (`software-engineering`, `applied-ai`, `revenue-tech`, `customer-success`). Custom tracks can be created via `ProfileProjector`, but dynamic track creation is not yet exposed as a separate UI builder.

---

## 5. Recommended Next Phase (Phase 3)

With the Career Brain, Master Profile, Career Profiles, Answer Bank, Versioning, and UI verified, the foundation is ready for Phase 3:

1. **Phase 3: Tailored Resume & Cover Letter Generation**
   - Implement the Resume Projection Formatter (exporting markdown, clean plain text, and ATS-friendly PDF/JSON Resume formats).
   - Inject track-specific custom instructions (`customResumeInstructions`, `customCoverLetterInstructions`) into generation prompts.
   - Enforce provenance guardrails during generation to guarantee zero fabrication of metrics, titles, or dates.
2. **Phase 4: Browser Extension & Application Auto-Fill**
   - Connect the browser extension to the local REST API on `localhost:3141`.
   - Use the Answer Bank and active Career Profile to populate Greenhouse, Lever, and Workday application forms with human-in-the-loop review.


