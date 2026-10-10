# Phase 3 Architecture & Design: Job Discovery, Ingestion, Parsing & Deduplication

## 1. Baseline & Current State Assessment (Phase 2 Completed State)

Before designing Phase 3, a thorough audit of the existing Phase 2 codebase was conducted across all 10 inspection vectors:

1. **Browser Extension Architecture:**
   - *Current State:* Clean slate in the repo. Extension files (`manifest.json`, content scripts, background service worker) are slated for Phase 3/4 integration.
   - *Phase 3 Architecture:* Extension acts as the active sensor and ingestion trigger. Operates via Manifest V3 with a Content Script running in the job posting tab, communicating with the local daemon at `http://127.0.0.1:3141` via REST/JSON.

2. **Local Agent / Backend Architecture:**
   - *Current State:* Lightweight, native Node.js HTTP server (`src/server/index.ts`) serving on `http://127.0.0.1:3141` with CORS enabled for local requests. Clean separation between routes, storage, and domain logic.
   - *Phase 3 Design:* Expand `src/server/index.ts` with dedicated job discovery endpoints:
     - `POST /api/jobs/extract`: Accepts raw page payload (HTML, DOM text, metadata, page URL) from the browser extension or discovery crawler.
     - `GET /api/jobs`: Lists tracked jobs with filters (company, status, date, deduplication group).
     - `GET /api/jobs/:id`: Fetches detailed job, extraction history, and snapshots.
     - `POST /api/jobs/:id/select-profile`: Invokes Phase 2 `CareerProfileSelector` directly on the parsed job.

3. **Database Schema:**
   - *Current State:* SQLite WAL-mode (`better-sqlite3`) in `src/db/database.ts` with tables: `master_profile`, `profile_history`, `career_profiles`, `conflicts`, `answer_bank`, and `skill_index`.
   - *Phase 3 Design:* Introduce 4 new relational tables in SQLite with transactional integrity:
     - `jobs`: Canonical normalized jobs.
     - `job_sources`: Sources through which jobs were discovered or imported.
     - `job_snapshots`: Immutable historical snapshots of raw content and parsed state at point-of-encounter.
     - `job_dedup_clusters`: Groups linking duplicate/reposted postings across different sources.

4. **Master Profile Schema:**
   - *Current State:* Canonical Zod schema in `src/types/master-profile.ts` with complete personal, screening, work experience, projects, skills, certifications, awards, leadership, and languages.
   - *Phase 3 Integration:* Parsed job requirements (skills, seniority, education, work authorization) map 1:1 against Master Profile facts for requirement matching.

5. **Career Profile Schema:**
   - *Current State:* Defined in `src/types/career-profile.ts` with 4 tracks (`software-engineering`, `applied-ai`, `revenue-tech`, `customer-success`) and existing input schema `JobDescriptionInputSchema`.
   - *Phase 3 Integration:* The normalized job parser directly produces `JobDescriptionInput`, enabling seamless handoff to `CareerProfileSelector`.

6. **OpenRouter Integration:**
   - *Current State:* `src/ai/openrouter-client.ts` configured with `anthropic/claude-3.5-sonnet` (or user model), strict temperature 0.0, zero-hallucination prompts, and structured JSON parsing.
   - *Phase 3 Guardrail:* **Deterministic extraction first.** OpenRouter is reserved exclusively for complex semantic unstructured fallback (e.g. messy unstructured free-text descriptions lacking semantic HTML tags).

7. **Storage & Persistence Layer:**
   - *Current State:* `src/core/storage.ts` provides file sync (`data/profile/`) + SQLite atomic transactions.
   - *Phase 3 Design:* `src/core/job-storage.ts` manages job persistence, snapshot logging (`data/jobs/snapshots/`), and atomic deduplication index updates.

8. **Browser & Page Interaction Capabilities:**
   - *Current State:* CLI tools (`src/cli/`) and local HTTP server.
   - *Phase 3 Design:* Dual-mode ingestion:
     - *Primary Mode (User-Driven):* Browser Extension captures live authenticated DOM, handles client-side rendering (SPA/React/Angular), and pushes extraction payloads to the local daemon.
     - *Secondary Mode (Future Autonomous Discovery):* Local fetcher using headless engine (Playwright/Puppeteer) or direct API endpoints for public ATS pages (Greenhouse, Lever, Ashby).

9. **Testing Infrastructure:**
   - *Current State:* Vitest runner (`vitest.config.ts`) with 11 suites and 72 tests passing in <2 seconds.
   - *Phase 3 Design:* High-fidelity test fixtures reproducing real DOMs from LinkedIn, Indeed, Wellfound, Greenhouse, Lever, Ashby, Workday, and unstructured generic company career pages.

10. **UI / Navigation Structure:**
    - *Current State:* Tabbed Single Page App (`src/ui/`) with Master Profile, Career Profiles, Skill Intelligence, Application Answer Bank, and Version History.
    - *Phase 3 Design:* Add a 6th top-level tab: **Job Tracker & Discovery** (`tab-jobs`) displaying discovered jobs, parser confidence, deduplication clusters, snapshot diffs, and 1-click Career Profile matching.

---

## 2. Core Processing Pipeline

```
JOB SOURCE (Active Browser Tab / Extension OR Autonomous Crawler)
    ↓
PAGE DETECTION (URL Regex + Meta Fingerprints + JSON-LD Detection)
    ↓
CONTENT EXTRACTION (Targeted ATS Selectors + Microdata + Semantic Containers)
    ↓
JOB PARSING (Deterministic Regex / DOM Headers [Fallback: OpenRouter])
    ↓
NORMALIZATION (Clean Titles, Locations, Remote Status, Salaries, Skills)
    ↓
VALIDATION (Zod JobSchema + Zero Inventions Guard)
    ↓
DEDUPLICATION (Tier 1: Deterministic IDs/URLs/Keys | Tier 2: Text Similarity)
    ↓
PERSISTENCE (Atomic Normalized Job + Immutable Content Snapshot in SQLite)
```

---

## 3. Normalized Job Data Model & Types

### 3.1 Job Schema (`src/types/job.ts`)

```typescript
import { z } from 'zod';

export const RemoteStatusEnum = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type RemoteStatus = z.infer<typeof RemoteStatusEnum>;

export const EmploymentTypeEnum = z.enum([
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
  'unknown',
]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const SeniorityLevelEnum = z.enum([
  'intern',
  'entry',
  'mid',
  'senior',
  'lead',
  'staff',
  'principal',
  'executive',
  'unknown',
]);
export type SeniorityLevel = z.infer<typeof SeniorityLevelEnum>;

export const ApplicationMethodEnum = z.enum([
  'easy-apply',
  'ats-redirect',
  'email',
  'company-form',
  'unknown',
]);
export type ApplicationMethod = z.infer<typeof ApplicationMethodEnum>;

export const JobSourceTypeEnum = z.enum([
  'linkedin',
  'indeed',
  'wellfound',
  'greenhouse',
  'lever',
  'workday',
  'ashby',
  'company-page',
  'generic',
]);
export type JobSourceType = z.infer<typeof JobSourceTypeEnum>;

export const SalaryInfoSchema = z.object({
  currency: z.string().default('USD'),
  minimum: z.number().nullable().default(null),
  maximum: z.number().nullable().default(null),
  target: z.number().nullable().default(null),
  period: z.enum(['yearly', 'monthly', 'hourly']).default('yearly'),
  rawText: z.string().nullable().default(null),
});
export type SalaryInfo = z.infer<typeof SalaryInfoSchema>;

export const JobLocationSchema = z.object({
  rawLocationText: z.string().default(''),
  city: z.string().nullable().default(null),
  regionStateProvince: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  remoteStatus: RemoteStatusEnum.default('unknown'),
  allowedLocations: z.array(z.string()).default([]),
});
export type JobLocation = z.infer<typeof JobLocationSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  source: JobSourceTypeEnum,
  sourceJobId: z.string().nullable().default(null),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().nullable().default(null),
  applicationUrl: z.string().url().nullable().default(null),
  applicationMethod: ApplicationMethodEnum.default('unknown'),

  // Company Facts
  company: z.string().min(1, 'Company name is required').trim(),
  companyUrl: z.string().url().nullable().default(null),
  department: z.string().nullable().default(null),
  industry: z.string().nullable().default(null),

  // Title & Classification
  jobTitle: z.string().min(1, 'Job title is required').trim(),
  normalizedTitle: z.string().trim(),
  seniority: SeniorityLevelEnum.default('unknown'),
  employmentType: EmploymentTypeEnum.default('unknown'),

  // Location Facts
  location: JobLocationSchema,

  // Compensation
  salary: SalaryInfoSchema.default({}),

  // Detailed Description & Sections
  descriptionRaw: z.string().min(1, 'Job description cannot be empty'),
  descriptionCleanText: z.string(),
  responsibilities: z.array(z.string()).default([]),
  requiredQualifications: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),

  // Extracted Technical Requirements
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  yearsOfExperienceRequired: z.number().nullable().default(null),
  educationRequirements: z.string().nullable().default(null),
  workAuthorizationRequired: z.boolean().nullable().default(null),
  sponsorshipProvided: z.boolean().nullable().default(null),

  // Point-in-time & Audit Metadata
  postedDate: z.string().nullable().default(null),
  closingDate: z.string().nullable().default(null),
  extractionTimestamp: z.string(),
  firstDiscoveredAt: z.string(),
  lastUpdatedSnapshotAt: z.string(),
  rawSourceMetadata: z.record(z.string(), z.unknown()).default({}),

  // Parser & Confidence Metrics
  parserConfidence: z.number().min(0).max(1),
  extractionWarnings: z.array(z.string()).default([]),
  dedupClusterId: z.string().nullable().default(null),
});
export type Job = z.infer<typeof JobSchema>;
```

### 3.2 Job Snapshot Schema (`src/types/job-snapshot.ts`)

```typescript
export const JobSnapshotSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  snapshotTimestamp: z.string(),
  contentHash: z.string(), // SHA-256 of raw DOM/HTML text
  rawHtmlExcerpt: z.string().optional(),
  cleanTextContent: z.string(),
  parsedStateJson: z.string(), // Full serialized Job state at this moment
  changeDeltaFromPrevious: z.array(z.string()).default([]),
});
export type JobSnapshot = z.infer<typeof JobSnapshotSchema>;

---

## 4. Extraction Strategy Across Supported Sources

### 4.1 Page Detection & Fingerprinting Matrix

The extractor uses a multi-layered detection strategy: URL patterns + meta tag inspection + DOM selectors + JSON-LD structured microdata.

| Source Platform | URL Pattern Regex | DOM / Meta Fingerprints | Primary Content Strategy |
| :--- | :--- | :--- | :--- |
| **LinkedIn** | `linkedin\.com\/jobs\/(view\|collections)\|currentJobId=\d+` | `.jobs-description`, `.job-details-jobs-unified-top-card` | Specialized selector parser + fallback to container text |
| **Indeed** | `indeed\.com\/(viewjob\|jobs\?vjk=)` | `#jobDescriptionText`, `.jobsearch-JobInfoHeader` | Targeted ID extractors + salary guide parsing |
| **Wellfound (AngelList)** | `wellfound\.com\/jobs\/` | `[data-test="JobDescription"]`, `.styles_jobDescription__` | React state extract / SSR container |
| **Greenhouse** | `boards\.greenhouse\.io\/.*\/jobs\/\d+` | `#app_body`, `#content`, `.job-post` | Structured HTML semantic container + standard metadata |
| **Lever** | `jobs\.lever\.co\/[^\/]+\/[a-f0-9-]+` | `.posting-headline`, `.posting-description` | Clean semantic containers with categorized bullet sections |
| **Workday** | `myworkdayjobs\.com\/` | `[data-automation-id="jobPostingDescription"]` | Single-page app container extraction from dynamic DOM |
| **Ashby** | `jobs\.ashbyhq\.com\/` | `[class*="JobPosting_description"]`, `__NEXT_DATA__` | High-fidelity Next.js JSON state or article body |
| **Generic / Company Careers** | Any standard HTTP(S) URL | JSON-LD schema (`JobPosting`), `<article>`, `<main>` | Microdata parse + readability heuristic content extraction |

### 4.2 Standard Microdata: JSON-LD `JobPosting` Prioritization
Most enterprise career sites (Google Jobs compliant ATSs like Greenhouse, Ashby, Workday, and Lever) embed structured JSON-LD in the `<head>`:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior AI Systems Engineer",
  "hiringOrganization": { "name": "Acme Robotics" },
  "datePosted": "2026-10-01",
  "baseSalary": { ... }
}
</script>
```
*Rule:* Whenever valid `schema.org/JobPosting` JSON-LD is detected in the document, Jobby extracts it first as high-confidence deterministic seed facts, then enriches it with the rendered DOM selectors.

---

## 5. Generic Fallback Strategy (Unknown ATS / JavaScript-Heavy / Hidden Text)

When encountering proprietary company career pages without standard ATS fingerprints:

1. **Readability Heuristic Container Extraction:**
   - Scan for semantic landmark elements: `<main>`, `<article>`, `[role="main"]`, `[class*="job-description"]`, `[id*="job-detail"]`.
   - Compute text-density score against surrounding boilerplate (header, navigation, footer, cookie consent banners).
2. **Hidden Text / "Show More" Handling:**
   - Detect truncated description controls (e.g. `button:contains("Show more")`, `button:contains("Read full description")`, `[aria-expanded="false"]`).
   - If in browser extension context: simulate click or inspect full unbounded element in background DOM.
   - If via crawler: inspect hidden sibling text or query inner container text without CSS clipping.
3. **Structured Section Segmenter:**
   - Split description into logical blocks by searching for common section headers:
     - `Responsibilities / What You'll Do / Role Overview`
     - `Requirements / What You Bring / Qualifications / Must-Haves`
     - `Preferred Qualifications / Nice-to-Haves / Bonus Points`
     - `Benefits / What We Offer / Perks`
     - `Compensation / Salary Range`
4. **Zero-Inventions Guarantee:**
   - If salary, years of experience, or closing dates are not explicitly written, they remain `null`. The parser will **never invent** placeholder estimates.

---

## 6. Deduplication Strategy

Job seekers encounter the same job posting across multiple touchpoints (e.g. LinkedIn aggregator link, Indeed posting, and the direct Greenhouse URL).

### 6.1 Deterministic Signals (Tier 1 - Zero Cost)
1. **Canonical Source Job ID Match:**
   - If `source === 'greenhouse'` and `sourceJobId === '54321'` matches an existing posting, it is an exact duplicate.
2. **Normalized Application URL Match:**
   - URLs often contain tracking parameters (e.g. `?utm_source=linkedin&gh_jid=12345`).
   - The normalizer strips all UTM parameters, session tokens, and query noise to compute a clean `canonicalUrl`. If two postings share the identical sanitized URL, they are grouped.
3. **Company + Normalized Job Title + Geographic Fingerprint:**
   - Strip company legal entity suffixes (`Acme Inc.` -> `acme`, `Google LLC` -> `google`).
   - Strip title fluff (`Senior Backend Engineer (Remote - US)` -> `senior backend engineer`).
   - Location key (`Toronto, ON` -> `toronto-on-canada`, `Remote US` -> `remote-us`).
   - Composite Key: `company_key | title_key | location_key`.
   - Exact match on composite key indicates a duplicate/reposting.

### 6.2 Fuzzy & Semantic Signals (Tier 2 - Offline / Low Cost)
1. **Content Jaccard / Levenshtein Similarity:**
   - Calculate MinHash / 3-gram similarity on `descriptionCleanText`.
   - If similarity $> 0.88$ and company names match, link postings into a single `job_dedup_cluster`.
2. **Repost Detection:**
   - If the same company, title, and location are encountered with a new URL and a posted date $> 30$ days later, link it as a `REPOSTED` status rather than creating an isolated job.

---

## 7. OpenRouter Usage & Boundary Rules

OpenRouter is strictly restricted to secondary semantic classification:

| Task | Deterministic First? | OpenRouter Permitted? | Guardrail |
| :--- | :--- | :--- | :--- |
| Extracting Title, Company, URL | **Yes** (DOM / Meta) | **NO** | Zero hallucination. Use exact text. |
| Extracting Salary Range | **Yes** (Regex pattern) | Only if complex phrasing | Output must cite source excerpt. |
| Extracting Known Tech Skills | **Yes** (`SkillNormalizer`) | **NO** | Match against canonical skill registry. |
| Parsing unstructured blob text | Attempt Regex headers | **Yes** (Fallback only) | Temperature 0.0, strict JSON schema output. |
| Deduplication clustering | **Yes** (Hash / Composite) | Only if borderline ($0.80 - 0.88$) | Temperature 0.0. |

---

## 8. Failure Handling & Resilience

1. **Authentication / Login Walls (e.g. LinkedIn / Glassdoor wall):**
   - In browser extension mode: Uses the user's active browser session without needing credentials.
   - In autonomous mode: Logs warning `EXTRACTION_AUTH_WALL`, stores URL, and marks status `NEEDS_USER_BROWSER_IMPORT`.
2. **Anti-Bot / CAPTCHA Pages:**
   - Detects Cloudflare / DataDome challenge signatures.
   - Aborts autonomous scrape immediately with flag `CAPTCHA_BLOCKED`.
   - Instructs user to open the URL in browser where extension can import directly.
3. **Incomplete or Corrupt DOM:**
   - Flags `extractionWarnings.push('INCOMPLETE_DESCRIPTION')`.
   - Records confidence score $< 0.50$ requiring manual review in the UI.

---

## 9. Security, Privacy & Local-First Principles

1. **No External Scraping Cloud Services:**
   - Parsing runs 100% locally on Node.js / TypeScript.
2. **Zero PII Exposure:**
   - Extracted job descriptions are scrubbed of any personal browser session cookies or authorization tokens before persistence.
3. **Local Database Isolation:**
   - Jobs are stored strictly in `data/profile/master-profile.db` or dedicated `data/jobs/`.
4. **Point-in-Time Audit Proof:**
   - Raw HTML excerpt hash is stored with every job snapshot. If an employer changes the posting requirements after application, Jobby retains the original snapshot as evidence.

---

## 10. Database Architecture (`src/db/database.ts` Additions)

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_job_id TEXT,
  source_url TEXT NOT NULL,
  canonical_url TEXT,
  application_url TEXT,
  application_method TEXT NOT NULL,
  company TEXT NOT NULL,
  company_url TEXT,
  job_title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  location_json TEXT NOT NULL,
  salary_json TEXT NOT NULL,
  seniority TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  description_raw TEXT NOT NULL,
  description_clean TEXT NOT NULL,
  responsibilities_json TEXT NOT NULL,
  required_qualifications_json TEXT NOT NULL,
  preferred_qualifications_json TEXT NOT NULL,
  required_skills_json TEXT NOT NULL,
  preferred_skills_json TEXT NOT NULL,
  technologies_json TEXT NOT NULL,
  years_experience INTEGER,
  posted_date TEXT,
  first_discovered_at TEXT NOT NULL,
  last_updated_snapshot_at TEXT NOT NULL,
  parser_confidence REAL NOT NULL,
  extraction_warnings_json TEXT NOT NULL,
  dedup_cluster_id TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_snapshots (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  snapshot_timestamp TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_html_excerpt TEXT,
  clean_text_content TEXT NOT NULL,
  parsed_state_json TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_dedup_clusters (
  cluster_id TEXT PRIMARY KEY,
  primary_job_id TEXT NOT NULL,
  company_normalized TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  location_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (primary_job_id) REFERENCES jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_title ON jobs(normalized_title);
CREATE INDEX IF NOT EXISTS idx_jobs_dedup_cluster ON jobs(dedup_cluster_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_job_id ON job_snapshots(job_id);

---

## 11. Exact Files and Modules to Be Created or Modified in Phase 3

### 11.1 Types & Schemas
- `src/types/job.ts`: Complete normalized Job schema and sub-schemas (salary, location, employment type, seniority, requirements).
- `src/types/job-snapshot.ts`: Job point-in-time snapshot and content hash types.
- `src/types/job-dedup.ts`: Deduplication signals, cluster types, and similarity thresholds.

### 11.2 Core Discovery & Extraction Engines
- `src/core/job-normalizer.ts`: Title cleaning, seniority extraction, salary regex parsing, location decomposition, and tracking parameter removal.
- `src/core/job-parsers/base-parser.ts`: Abstract parser interface contract.
- `src/core/job-parsers/linkedin-parser.ts`: Specialized LinkedIn DOM / metadata parser.
- `src/core/job-parsers/indeed-parser.ts`: Specialized Indeed DOM / metadata parser.
- `src/core/job-parsers/greenhouse-parser.ts`: Greenhouse ATS parser with JSON-LD microdata integration.
- `src/core/job-parsers/lever-parser.ts`: Lever ATS structured section parser.
- `src/core/job-parsers/ashby-parser.ts`: Ashby ATS next-data and DOM parser.
- `src/core/job-parsers/generic-parser.ts`: Readability heuristic fallback with section segmentation.
- `src/core/job-deduplicator.ts`: Deterministic composite key and fuzzy text deduplication engine.
- `src/core/job-storage.ts`: Dedicated Job persistence, snapshotting, and querying service.

### 11.3 AI Integration (Semantic Fallback Only)
- `src/ai/job-semantic-parser.ts`: Strict fallback prompt for unstructured text blobs using OpenRouter client (temperature 0.0).

### 11.4 Backend Server & Extension API
- `src/server/index.ts`: Expose `POST /api/jobs/extract`, `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/dedup`.
- `src/ui/`: Add the **Job Tracker & Discovery** tab to review extracted jobs and view snapshot audit history.

### 11.5 Browser Extension Ingestion Script
- `extension/`: Minimal Manifest V3 content script extracting page DOM/JSON-LD when user clicks "Import to Jobby".

### 11.6 Comprehensive Test Suites
- `tests/fixtures/jobs/`: Raw sample HTML/DOM files for LinkedIn, Indeed, Greenhouse, Lever, Ashby, and generic job postings.
- `tests/job-normalization.test.ts`: Seniority, salary, location, and title regex normalization tests.
- `tests/job-parsers.test.ts`: Extraction fidelity tests across all supported ATS platforms.
- `tests/job-deduplication.test.ts`: Duplicate detection, repost detection, and cluster tests.
- `tests/job-snapshot-integrity.test.ts`: Snapshot hashing and point-in-time immutability tests.
- `tests/job-pipeline-e2e.test.ts`: End-to-end flow from page payload to profile selection.


