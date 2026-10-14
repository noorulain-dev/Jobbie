# Phase 4 Architecture & Design: Application Context & Session Audit

## 1. Executive Summary

Phase 4 bridges Jobby's **Career Brain & Master Profile** (Phase 2) and **Job Extraction Layer** (Phase 3 partial) with actual application workflows. This is a **personal-use MVP**. It prioritizes accuracy, minimal implementation, reuse of existing functionality, and maintainability—avoiding unnecessary commercial abstractions or heavy orchestration frameworks.

The core objective is to allow the user to:
1. Open a job posting manually in the browser.
2. Invoke Jobby and click **Start Application**.
3. Extract the job using existing Phase 3 extractors.
4. Persist the job and its usable context.
5. Create an **Application Session** linked to that specific job.
6. Remember the selected Career Profile and relevant profile versions (Master Profile point-in-time snapshot and history version number).
7. Navigate to a separate application form or ATS page (e.g. from LinkedIn to Greenhouse) and associate that new page with the active session.
8. Find and resume previously saved application sessions.

---

## 2. Current Architecture & Codebase Baseline

### 2.1 Extension Framework, Background/Service Worker & Content Scripts
- **Current State:** Clean slate in the repository. There is currently **no extension directory**, `manifest.json`, background service worker, popup, side panel, or content script.
- **Phase 3 Extraction Implementation:** Implemented as a standalone, deterministic DOM extraction engine in `src/extractor/`:
  - `page-detector.ts` (`JobPageDetector`)
  - `content-extractor.ts` (`ContentExtractor`)
  - `sources/` (`LinkedInExtractor`, `IndeedExtractor`, `GreenhouseExtractor`, `LeverExtractor`, `AshbyExtractor`, `WorkdayExtractor`, `WellfoundExtractor`, `GenericCompanyPageExtractor`)
- **Implication:** The extraction layer already parses real DOMs via standard `Document` objects (`jsdom` in tests, standard browser DOM in content scripts). The minimal extension needed for Phase 4 is a lightweight Manifest V3 extension with:
  1. A Content Script that extracts the active page DOM and calls the local backend.
  2. A clean Popup with "Start Application", "Select Session", and active session status.

### 2.2 Local Backend Architecture & Extension Communication
- **Current State:** A native Node.js HTTP server in `src/server/index.ts` listening on `http://127.0.0.1:3141` (customizable via `JOBBY_PORT`/`JOBBY_HOST`).
  - CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`) are **already enabled** on all endpoints.
  - JSON body parser and clean request routing already exist.
  - Existing endpoints:
    - `/api/master-profile` (GET, PUT)
    - `/api/career-profiles` (GET, PUT)
    - `/api/skill-intelligence` (GET, POST)
    - `/api/answer-bank` (GET, POST, PUT)
    - `/api/history` & `/api/history/rollback/:id` (GET, POST)
    - `/api/export` & `/api/import` (GET, POST)
- **Communication Pattern:** The browser extension communicates directly with `http://127.0.0.1:3141/api/*` using standard `fetch()` with JSON payloads. No complex WebSocket or proxy layer is required.

### 2.3 Existing Database, ORM & Persistence Patterns
- **Database Engine:** SQLite in WAL mode via `better-sqlite3` (`src/db/database.ts`).
- **ORM / Migrations:** No heavy ORM (no Prisma, TypeORM, Drizzle). Uses handwritten, prepared statements and atomic transactions with Zod validation (`JobSchema.parse`, `MasterProfileSchema.parse`). Schema migrations are performed via `CREATE TABLE IF NOT EXISTS` and runtime `PRAGMA table_info` checks with `ALTER TABLE ADD COLUMN`.
- **Existing Tables in `master-profile.db`:**
  - `master_profile`: canonical profile
  - `profile_history`: versioned snapshots with `version_number`, `change_source`, `actor`, `fields_changed_json`, `snapshot_json`
  - `career_profiles`: track lenses (SWE, Applied AI, RevTech, Support)
  - `conflicts`: provenance conflicts
  - `answer_bank`: application Q&A bank
  - `skill_index`: skill search index
  - `jobs`: normalized jobs table
  - `job_snapshots`: point-in-time posting states
  - `job_dedup_clusters`: duplicate groupings
- **Existing Job Storage Methods in `src/core/storage.ts` & `src/db/database.ts`:**
  - `saveJob(job: Job)`
  - `getJobs(): Job[]`
  - `getJob(id: string): Job | null`
  - `findJobByDedupHash(dedupHash: string): Job | null`
  - `saveJobSnapshot(snapshot: JobSnapshot)`
  - `getJobSnapshots(jobId: string): JobSnapshot[]`
  - `saveDedupCluster(cluster: JobDedupCluster)`
  - `getDedupCluster(clusterId: string): JobDedupCluster | null`

### 2.4 Job Schema & Source URL Handling
- Defined in `src/types/job.ts`:
  - `source`: `JobSourceTypeEnum` ('linkedin', 'indeed', 'wellfound', 'greenhouse', 'lever', 'workday', 'ashby', 'company-page', 'generic')
  - `sourceJobId`: string | null
  - `sourceUrl`: original URL where user found the posting
  - `canonicalUrl`: sanitized URL with UTM and tracking parameters stripped via `normalizeJobUrl()`
  - `applicationUrl`: direct application / ATS URL
- Normalization in `src/core/job-normalizer.ts`:
  - `normalizeJobUrl()`: strips `utm_*`, `ref`, `source`, `trackingid`, `gh_src`, `currentjobid`, trailing slashes.
  - `normalizeCompanyName()`: strips corporate legal suffixes ('inc', 'llc', 'corp', 'technologies', etc.).
  - `normalizeJobTitle()`: converts Roman numerals to Arabic numbers, standardizes seniority terms.
  - `normalizeJobLocation()`: normalizes permutations like "Remote - Canada" vs "Canada - Remote".
  - `computeJobDedupHash()`: SHA-256 of `company_normalized | title_normalized | location_normalized`.

### 2.5 Job Detection, Extraction & Parsing Functions
- `JobPageDetector` (`src/extractor/page-detector.ts`):
  - Deterministically inspects URL, metadata, DOM landmarks, and JSON-LD schema.
  - Returns `PageDetectionResult`: `{ isJobPage, confidence, source, detectedJobTitle, detectedCompany, reason, matchingSignals }`.
- `ContentExtractor` (`src/extractor/content-extractor.ts`):
  - Returns `StructuredRawContent`: `{ url, title, headings, visibleText, structuredMetadata, links, buttons, formApplicationLinks, jsonLd, relevantDomSections }`.
- **Status of Parsing into a `Job` entity:**
  - `JobPageDetector` and `ContentExtractor` extract the raw page material.
  - To bridge raw extracted content into a validated `Job` entity, a lightweight parser service (`src/core/job-parser.ts`) is needed to map `(PageDetectionResult, StructuredRawContent)` $\to$ `Job`.

### 2.6 Current-Page Import UI
- There is currently **no current-page import UI** or browser extension interface.
- In the local web UI (`src/ui/`), there are tabs for Master Profile, Career Profiles, Skill Intelligence, Application Answer Bank, and Version History.
- A dedicated **Job Sessions** view in the UI or Extension Popup is needed to trigger extraction and show the active session.

### 2.7 Profile Versioning & Career Profile Selection
- **Master Profile Versioning:**
  - `storage.getProfileHistory()` returns immutable version entries with sequential `version_number`, `timestamp`, `changeSource`, `actor`, `changeReason`, `fieldsChanged`, and `snapshotJson`.
  - The current version number can be retrieved directly from `history[0].versionNumber`.
- **Career Profile Selection:**
  - `CareerProfileSelector` (`src/core/profile-selector.ts`) already implements `selectProfile(master, profiles, jobInput, options)`.
  - It accepts `JobDescriptionInput` (which maps directly from job fields: `jobTitle`, `company`, `jobDescription`, `requiredSkills`, `preferredSkills`, `responsibilities`, `seniority`, `industry`, `locationRemoteRequirements`).
  - Returns `CareerProfileSelectionResult`: `{ selectedProfileId, selectedProfileTrack, selectedProfileName, confidenceScore, secondaryProfile, isHybridStrategy, hybridStrategyNotes, reasoning, matchedSkills, missingSkills, potentialConcerns }`.
  - This logic is completely reusable without modification.

### 2.8 Test & Error Handling Conventions
- **Test Runner:** Vitest with Node environment (`vitest run`).
- **Fixtures:** Stored in `tests/fixtures/jobs/*.html`.
- **Pattern:** Clear, descriptive `describe` and `it` blocks verifying both positive and negative constraints (e.g. zero hallucination, provenance enforcement, immutability guarantees).
- **Error Handling:** Zod schema validation errors return descriptive messages; REST server returns `{ error: string }` with appropriate 4xx/5xx status codes.

---

## 3. Existing Functionality to Reuse

| Capability | Existing Module | Reuse in Phase 4 |
| :--- | :--- | :--- |
| **Page Job Detection** | `src/extractor/page-detector.ts` | Detects ATS source and confirms job page without LLM. |
| **DOM Raw Content Extraction** | `src/extractor/content-extractor.ts` | Extracts headings, visible text, links, buttons, and JSON-LD. |
| **URL & Text Normalization** | `src/core/job-normalizer.ts` | Normalizes URL (strips tracking), company name, title, location, and computes deduplication hash. |
| **Normalized Job Entity Schema** | `src/types/job.ts` | Validates canonical Job structure. |
| **Job Point-in-Time Snapshotting** | `src/types/job-snapshot.ts` | Captures immutable posting state for audit trail. |
| **Database Persistence & Queries** | `src/db/database.ts` & `src/core/storage.ts` | `saveJob`, `getJob`, `saveJobSnapshot`, `findJobByDedupHash`, `saveDedupCluster`. |
| **Career Profile Selection Engine** | `src/core/profile-selector.ts` | Matches extracted job against candidate's Career Profiles. |
| **Profile Versioning & Provenance** | `src/core/storage.ts` | Links session to exact Master Profile `versionNumber` and Career Profile ID. |
| **Local REST API Server** | `src/server/index.ts` | Hosts session endpoints on localhost:3141 with CORS enabled. |

---

## 4. Missing Functionality to Implement

1. **Application Session Schema & Types (`src/types/application-session.ts`):**
   - New Zod schema for tracking an application lifecycle: session ID, job reference, selected career profile, snapshot ID, master profile version number, current status, active tab/page URLs, and timestamps.
2. **Database Table & Methods for Sessions:**
   - Table `application_sessions` in SQLite (`src/db/database.ts`).
   - Storage methods in `src/core/storage.ts`: `saveSession`, `getSession`, `getActiveSession`, `listSessions`, `updateSessionStatus`, `attachUrlToSession`.
3. **Structured Raw Content to Job Parser (`src/core/job-parser.ts`):**
   - Takes `(PageDetectionResult, StructuredRawContent)` and constructs a validated `Job` object (using JSON-LD when present, falling back to clean text and DOM headers) ready for persistence and profiling.
4. **Session Management Service (`src/core/session-service.ts`):**
   - Coordinates: extract $\to$ normalize $\to$ save Job $\to$ save Snapshot $\to$ run Profile Selector $\to$ create Session.
   - Handles associating subsequent URLs (e.g. Greenhouse apply page) with the active session.
   - Resuming previously saved sessions.
5. **Backend REST Endpoints for Sessions (`src/server/index.ts`):**
   - `POST /api/sessions/start`: Accepts raw HTML/URL, extracts job, selects career profile, and creates session.
   - `GET /api/sessions`: Lists existing sessions (active, draft, applied).
   - `GET /api/sessions/:id`: Retrieves full session context (job, snapshot, selected profile, matched skills).
   - `POST /api/sessions/:id/associate`: Associates an ATS application URL with an existing session.
   - `PUT /api/sessions/:id/status`: Updates session status (`draft`, `in_progress`, `applied`, `archived`).
6. **Minimal Browser Extension (`extension/`):**
   - Manifest V3 extension configured to run against `localhost:3141`.
   - Content script to extract active tab DOM on demand.
   - Popup UI displaying:
     - Page detection badge ("Job Posting Detected" or "Not a Job Posting").
     - Button: **Start Application**.
     - Display: Selected Career Profile, Matched Skills, and Session Status.
     - Button: **Associate Tab with Active Session** (for separate ATS pages).
     - Link to view/resume previous sessions.

---

## 5. Proposed Minimal Application Session Schema

```typescript
// src/types/application-session.ts
import { z } from 'zod';
import { CareerProfileTrackEnum } from './career-profile.js';

export const ApplicationSessionStatusEnum = z.enum([
  'draft',        // Job extracted, session created, not yet submitted
  'in_progress',  // User is actively filling out the application
  'applied',      // Application completed/submitted
  'archived',     // User decided not to apply or closed session
]);
export type ApplicationSessionStatus = z.infer<typeof ApplicationSessionStatusEnum>;

export const ApplicationSessionSchema = z.object({
  id: z.string().uuid(),
  
  // Link to canonical Job
  jobId: z.string().uuid(),
  jobSnapshotId: z.string().uuid(),
  
  // Job reference fields for instant display without secondary joins
  jobTitle: z.string().min(1),
  companyName: z.string().min(1),
  jobUrl: z.string().url(),
  applicationUrl: z.string().url().nullable().default(null),
  
  // Associated ATS/Form URLs (e.g. redirected from LinkedIn to Greenhouse)
  associatedUrls: z.array(z.string().url()).default([]),
  
  // Preserved Career Profile Context
  careerProfileId: z.string(),
  careerProfileTrack: CareerProfileTrackEnum,
  careerProfileName: z.string(),
  isHybridStrategy: z.boolean().default(false),
  secondaryCareerProfileId: z.string().optional(),
  
  // Point-in-time Master Profile Versioning
  masterProfileId: z.string().uuid(),
  masterProfileVersion: z.number().int().positive(),
  
  // Requirements & Alignment Summary
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  potentialConcerns: z.array(z.string()).default([]),
  selectionReasoning: z.string().default(''),
  
  // Session Lifecycle
  status: ApplicationSessionStatusEnum.default('draft'),
  notes: z.string().optional(),
  
  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
  lastAccessedAt: z.string(),
});
export type ApplicationSession = z.infer<typeof ApplicationSessionSchema>;
```

### Database Table DDL (`src/db/database.ts` Addition)

```sql
CREATE TABLE IF NOT EXISTS application_sessions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_snapshot_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT NOT NULL,
  application_url TEXT,
  associated_urls_json TEXT NOT NULL DEFAULT '[]',
  career_profile_id TEXT NOT NULL,
  career_profile_track TEXT NOT NULL,
  career_profile_name TEXT NOT NULL,
  master_profile_id TEXT NOT NULL,
  master_profile_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (job_snapshot_id) REFERENCES job_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_job_id ON application_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON application_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_company ON application_sessions(company_name);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON application_sessions(updated_at);
```

---

## 6. Proposed Session Lifecycle

```
[ User Views Job Page in Browser ]
                 │
                 ▼
[ User clicks "Start Application" in Extension Popup ]
                 │
                 ├─► Extension grabs DOM & URL
                 │
                 ▼
[ POST /api/sessions/start ]
  ├── 1. JobPageDetector.detect() -> confirms job page & source platform
  ├── 2. ContentExtractor.extract() -> extracts structured raw material & JSON-LD
  ├── 3. JobParser.parse() -> constructs normalized Job entity
  ├── 4. storage.saveJob() & storage.saveJobSnapshot() -> persists job & snapshot
  ├── 5. CareerProfileSelector.selectProfile() -> selects optimal Career Profile
  └── 6. storage.saveSession() -> creates ApplicationSession (status: 'draft')
                 │
                 ▼
[ Extension displays Session Dashboard ]
  ├── Job Title & Company Name
  ├── Selected Career Profile (e.g. "Software Engineering")
  ├── Matched Skills & Missing Skills
  └── Status: Draft
                 │
                 ▼
[ User clicks "Apply" on Job Page -> Navigates / Redirects to ATS Page (e.g. Greenhouse) ]
                 │
                 ▼
[ User opens Extension on ATS Page ]
  ├── Option A (Automatic): Extension detects current tab URL matches job.applicationUrl
  └── Option B (Explicit 1-Click): User clicks "Attach to Current Session: [Company - Title]"
                 │
                 ▼
[ POST /api/sessions/:id/associate { url: currentTabUrl } ]
  └── Adds ATS page URL to session.associatedUrls & updates session.lastAccessedAt
                 │
                 ▼
[ Resume Later / Find Saved Sessions ]
  ├── GET /api/sessions -> lists sessions with status, company, title, date
  └── User clicks "Resume" -> loads all preserved context (job facts, profile lens, answers)
```

---

## 7. Connecting Current-Page Job Extraction to Session Creation

1. **Extraction Request:**
   The extension sends a single lightweight payload to `POST /api/sessions/start`:
   ```json
   {
     "url": "https://boards.greenhouse.io/acme/jobs/12345",
     "html": "<html>...</html>"
   }
   ```
2. **Unified Backend Ingestion Pipeline:**
   - **Step A:** `parseHtmlToDocument(html, url)` creates a DOM context.
   - **Step B:** `JobPageDetector.detect(context)` validates whether the page is a job posting. If confidence $< 0.50$ and not a job posting, returns 400 with `isJobPage: false` and explanatory reason without persisting garbage.
   - **Step C:** `ContentExtractor.extract(context)` pulls clean text, headings, JSON-LD, and application form links.
   - **Step D:** `JobParser.fromRawContent(detection, rawContent)` converts this into a validated `Job` entity, normalizing URLs, title, company, location, and calculating `dedupHash`.
   - **Step E:** Persistence:
     - Check if job already exists via `storage.findJobByDedupHash(dedupHash)` to avoid duplicate records.
     - Save immutable snapshot via `storage.saveJobSnapshot()`.
   - **Step F:** Career Profile Alignment:
     - Retrieve active Master Profile and Career Profiles via `storage.getMasterProfile()` and `storage.getCareerProfiles()`.
     - Run `CareerProfileSelector.selectProfile(master, profiles, jobInput, { useSemanticAI: false })`.
   - **Step G:** Create and persist `ApplicationSession` containing the selected profile track and the Master Profile's current `versionNumber`.

---

## 8. Cross-Page & Cross-Tab Associations

A common user journey involves viewing a posting on an aggregator or company site (e.g. `linkedin.com/jobs/view/...` or `company.com/careers/role`), then clicking "Apply" which redirects to an ATS hosted on another domain (e.g. `boards.greenhouse.io/...` or `company.myworkdayjobs.com/...`).

To link these seamlessly without commercial complexity:

1. **Deterministic Application Link Pre-Association:**
   - When extracting the initial posting, `ContentExtractor` extracts application buttons, links, and forms into `formApplicationLinks` and `job.applicationUrl`.
   - Any URL found during extraction is automatically added to `session.associatedUrls`.
2. **Tab URL Matcher:**
   - When the extension popup opens on any browser tab, it queries the local daemon for the active session (`GET /api/sessions/active` or `GET /api/sessions`).
   - If the current tab's URL matches:
     - `session.jobUrl` OR
     - `session.applicationUrl` OR
     - Any URL in `session.associatedUrls` OR
     - The normalized domain/path matches the company's ATS path,
   - The popup immediately attaches and shows:
     **"Active Application: Acme — Senior Backend Engineer"**.
3. **Explicit 1-Click Association:**
   - If the user redirects through an unpredicted redirect chain or opens a new tab, the popup provides a dropdown:
     **"Attach this page to session: [Company - Title]"**.
   - Clicking it calls `POST /api/sessions/:id/associate` with the current tab's URL, updating the session's `associatedUrls` list.

---

## 9. Preservation of Profile Versions & Job Context

To guarantee that Jobby always knows *exactly* what candidate credentials and job requirements were in effect when applying:

1. **Master Profile Version Pinning:**
   - When the session is created, Jobby reads the current Master Profile's latest version number from `profile_history`:
     `session.masterProfileVersion = latestHistoryEntry.versionNumber`.
   - If the user later edits their Master Profile (e.g. in Phase 5), the session retains `masterProfileVersion: 3`. If Jobby ever needs to inspect what facts were active when this application occurred, it can fetch snapshot version #3 via `storage.getProfileHistoryEntry(versionId)`.
2. **Career Profile Lens Pinning:**
   - The session saves `careerProfileId`, `careerProfileTrack`, and `careerProfileName`.
   - Even if other Career Profiles are modified, this session strictly applies through the pinned track lens.
3. **Job Snapshot Pinning:**
   - The session points to `jobSnapshotId`.
   - The snapshot contains the SHA-256 `contentHash` and clean text content of the job posting at that exact moment.
   - If the employer later modifies the job posting (e.g. removes remote eligibility or changes salary), a new snapshot is created, preserving the delta while the original session remains anchored to its encounter snapshot.


---

## 10. Step-by-Step Implementation Sequence

```
Step 1: Session & Extraction Data Models
  └── Create `src/types/application-session.ts`
  └── Export types in `src/types/index.ts`

Step 2: Database Schema & Storage Methods
  └── Update `src/db/database.ts` with `application_sessions` table
  └── Implement `saveSession`, `getSession`, `getActiveSession`, `listSessions`, `attachUrlToSession` in `src/core/storage.ts`

Step 3: Raw Extraction to Job Parser
  └── Create `src/core/job-parser.ts` to bridge `(PageDetectionResult, StructuredRawContent)` -> `Job`
  └── Wire deterministic normalization (`normalizeJobUrl`, `normalizeCompanyName`, etc.)

Step 4: Session Management Service
  └── Create `src/core/session-service.ts`
  └── Implements: `startSessionFromPage()`, `associateUrl()`, `getResumeSessionContext()`, `updateStatus()`

Step 5: Local REST API Server Endpoints
  └── Add session endpoints in `src/server/index.ts`:
        POST /api/sessions/start
        GET  /api/sessions
        GET  /api/sessions/active
        GET  /api/sessions/:id
        POST /api/sessions/:id/associate
        PUT  /api/sessions/:id/status

Step 6: Minimal Browser Extension (MV3)
  └── Create `extension/manifest.json` (permissions: activeTab, scripting, storage)
  └── Create `extension/content.js` (extracts active tab DOM and sends to localhost:3141)
  └── Create `extension/popup.html` & `extension/popup.js`:
        - Displays page detection status
        - Button: "Start Application"
        - Displays active session context (Role, Company, Selected Profile, Matched Skills)
        - Button: "Attach This Tab to Session"
        - List of previous sessions to resume

Step 7: Automated Test Suite
  └── Create `tests/application-session.test.ts`
        - Tests session creation from page extraction
        - Tests profile version and job snapshot pinning
        - Tests cross-page URL association
        - Tests finding and resuming existing sessions
```

---

## 11. Relevant Test Commands

To verify the test suite:
```bash
# Run all unit and integration tests
pnpm test

# Run specifically Phase 4 session tests
pnpm test tests/application-session.test.ts

# Build TypeScript verification
pnpm build
```

---

## 12. Important Uncertainties & Decisions for User Review

1. **Extension Architecture & Manifest:**
   - Chrome Manifest V3 loaded unpacked from an `extension/` folder in this repository is the leanest, standard approach for a local developer MVP.
   - It requires minimal permissions (`activeTab`, `scripting`, `storage`) and talks strictly over `http://127.0.0.1:3141` without external telemetry.
2. **Session Auto-Association vs Manual Dropdown:**
   - When the user navigates from a job posting to an ATS (e.g. LinkedIn $\to$ Greenhouse), the backend pre-populates `associatedUrls` with any application link found on the initial page. If the user arrives on an unpredicted URL, the extension popup offers a 1-click button to attach the current tab to the active session.
3. **Draft Session Resumption:**
   - When multiple sessions exist in `draft` status, the most recently accessed session is treated as the default candidate, while the popup/UI provides a compact list to switch between or resume any prior session.
4. **Zero-LLM Job Parser:**
   - Converting the raw DOM extraction into a normalized `Job` entity will remain 100% deterministic (using JSON-LD microdata, OpenGraph tags, and DOM heading heuristics). OpenRouter is never invoked to fabricate missing job fields.






