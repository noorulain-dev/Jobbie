# Phase 7: Application Tracker & CSV Export — Architecture Audit

*Performed: 2026-10-10 | Audit only*

## 1. Existing Models & Services

**ApplicationSession** (`src/types/application-session.ts`): UUID id, jobId (nullable FK), status (ACTIVE|PAUSED|COMPLETED|CANCELLED), sourceJobUrl, applicationUrl, associatedPages[], jobContextSnapshot (company, role, description, skills, salary, etc.), jobContextOverrides (user corrections), selectedCareerProfileId, masterProfileVersion, timestamps.

**Session Service** (`src/core/session-service.ts`): `startApplicationFromJob()` creates sessions with deduplication; `getEffectiveContext()` merges snapshot+overrides with provenance; `updateSessionStatus()` with validated transitions.

**Database** (`src/db/database.ts`): `application_sessions` table with columns: id, job_id, status, source_job_url, application_url, associated_pages_json, selected_career_profile_id, master_profile_version, timestamps, data_json (full JSON blob). Indexes on job_id, status, last_activity_at, updated_at. `listSessions()` returns all, filtered by status/jobId.

**Document Artifacts** (`src/core/document-store.ts`): `listSessionDocuments(sessionId)` returns UI-safe list; `getLatestDocument(sessionId, docType)` for resume/cover letter metadata. Persisted in `data/generated/generation-log.jsonl`.

**UI** (`src/ui/app.js`): Sessions tab table: Company, Role, Status, Pages, Profile, Last Activity, Actions. Session detail with context review + corrections + career profile + documents. No tracker tab, no export, no CSV deps.

## 2. Architecture Questions — Answered

**What uniquely identifies a session?** `ApplicationSession.id` (UUID). `jobId` is nullable FK.

**Can the same job be applied to more than once?** Yes. Dedup only prevents duplicate ACTIVE/PAUSED sessions. COMPLETED/CANCELLED sessions allow new ones.

**How does Start Application create/resume?** Resolves job → checks for existing ACTIVE/PAUSED → creates snapshot → auto-selects career profile → creates session.

**Correct place for tracker record?** The ApplicationSession IS the tracker record. It already captures company, role, status, dates, career profile. Missing: dateApplied, outcome (should be added to JobContextOverrides).

**Duplicate prevention?** Existing session dedup by jobId/URL. Each session is a unique tracker entry.

**Effective context retrieval?** `sessionService.getEffectiveContext(sessionId)` at `src/core/session-service.ts:303`.

**Career profile and documents?** `session.selectedCareerProfileId` → `storage.getCareerProfile()`. `documentStore.getLatestDocument(sessionId, docType)`.

**New storage needed?** No. Sessions table already has all core fields. Add `dateApplied` and `outcome` to `JobContextOverrides` (user-supplied application metadata).

**Date/time handling?** ISO 8601 strings, UTC. Sufficient for local tool.

**CSV write/serve?** `fs.writeFileSync` (existing pattern). Serve via `GET /api/exports/applications.csv`. No CSV library — manual RFC 4180 construction needed.

## 3. Proposed Tracker Data Model

```typescript
interface TrackerEntry {
  sessionId: string;
  company: string;           // effective context
  role: string;              // effective context
  status: string;
  sourceUrl: string;
  applicationUrl: string | null;
  careerProfile: string | null;
  hasResume: boolean;
  hasCoverLetter: boolean;
  resumeVersion: number | null;
  coverLetterVersion: number | null;
  dateApplied: string | null;   // NEW: JobContextOverrides
  outcome: string | null;       // NEW: e.g. interview, offer, rejected
  notes: string;
  createdAt: string;
  lastActivityAt: string;
}
```

New fields `dateApplied` and `outcome` belong in `JobContextOverridesSchema` — they are user-supplied application process data, not extracted job data.

## 4. Implementation Plan

### New Files
| File | Purpose |
|------|---------|
| `src/core/tracker-service.ts` | `listTrackerEntries()`, `exportCsv()` |
| `src/core/csv-writer.ts` | Lightweight CSV serializer |

### Modified Files
| File | Change |
|------|--------|
| `src/types/application-session.ts` | Add `dateApplied`, `outcome` to `JobContextOverridesSchema` |
| `src/server/index.ts` | Add `GET /api/tracker`, `GET /api/tracker/export` |
| `src/ui/index.html` | Add "📊 Tracker" tab |
| `src/ui/app.js` | Add tracker table + export button |
| `src/index.ts` | Export new modules |

### Next Smallest Step
1. Add `dateApplied` and `outcome` to `JobContextOverridesSchema`
2. Create `tracker-service.ts` with `listTrackerEntries()` 
3. Add `GET /api/tracker` endpoint
4. Verify JSON response before adding CSV/UI

## 5. Files Inspected

`src/types/application-session.ts`, `src/types/job.ts`, `src/core/session-service.ts`, `src/db/database.ts`, `src/core/storage.ts`, `src/core/document-store.ts`, `src/ui/index.html`, `src/ui/app.js`, `src/server/index.ts`, `src/types/generated-document.ts`, `.env.example`, `package.json`