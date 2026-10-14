# Phase 4: Application Context & Session — Implementation Report

## Overview

Phase 4 connects Jobby's browser-side job detection and extraction (Phase 3) to persistent, cross-tab application sessions. The user can start, pause, resume, cancel, and review application sessions—each pinned to the Master Profile version and a selected Career Profile at capture time.

## What Was Implemented

### 1. Types & Schema (`src/types/application-session.ts`)
- `ApplicationSessionStatusEnum`: ACTIVE, PAUSED, COMPLETED, CANCELLED
- `VALID_SESSION_TRANSITIONS` with terminal states
- `JobContextSnapshotSchema`: immutable point-in-time capture
- `JobContextOverridesSchema`: user corrections stored separately
- `AssociatedPageSchema`: URL + page type + timestamp
- `ApplicationSessionSchema`: full session entity
- `careerProfileSelectionSource`: 'auto' or 'manual', never downgraded

### 2. Session Management Service (`src/core/session-service.ts`)
| Method | Purpose |
|--------|---------|
| `startApplicationFromJob()` | Detect → extract → parse → save Job → create/resume session |
| `getSessionById()` | Single session lookup |
| `listRecentSessions()` | Filterable list |
| `updateSessionStatus()` | Validated transition |
| `updateSessionJobContext()` | Write overrides, preserving snapshot |
| `getEffectiveContext()` | Merge snapshot+overrides with per-field provenance |
| `setCareerProfile()` | Attach profile with selection source |
| `attachPageToSession()` | Add APPLICATION_PAGE or OTHER URL |
| `getExistingSessionForJob()` | Match by job ID or normalized URL |
| `cancelSession()` | Terminal cancellation |

### 3. REST API Endpoints (`src/server/index.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sessions/detect` | Detection + preview |
| POST | `/api/sessions/start` | Create or resume session |
| GET | `/api/sessions` | List (filterable) |
| GET | `/api/sessions/:id` | Full session |
| GET | `/api/sessions/:id/effective-context` | Merged context with provenance |
| POST | `/api/sessions/:id/associate` | Attach page URL |
| PUT | `/api/sessions/:id/status` | Lifecycle transition |
| PUT | `/api/sessions/:id/context` | Write overrides |
| PUT | `/api/sessions/:id/career-profile` | Set Career Profile |

### 4. Browser Extension (`extension/`)
- Manifest V3: permissions activeTab, scripting, storage
- `content.js`: extracts {url, html, title} from active tab
- `popup.html`: connection status, detection badge, session indicator, action buttons, session list
- `popup.js`: detect, start, attach, pause, resume, cancel; tab associations via chrome.storage.local

### 5. Web UI — Sessions Tab (`src/ui/`)
- Sessions table with View/Pause/Resume/Cancel buttons
- Session Detail: context review (provenance badges) + manual recovery form + career profile picker

### 6. Context Merging & Provenance
`GET /api/sessions/:id/effective-context` returns snapshot, overrides, effective merge, and per-field source markers (`extracted`, `corrected`, `supplied`).

## Existing Services Reused
- Phase 3: JobPageDetector, ContentExtractor, parseHtmlToDocument, JobParser
- Phase 2: ProfileStorage, JobbyDatabase, CareerProfileSelector, SeedMigrator, ProfileProjector
- Answer Bank: AnswerBankService, seedInitialAnswerBank

## Database Changes
New table `application_sessions` in SQLite with columns: id, job_id, status, source_job_url, application_url, associated_pages_json, job_context_snapshot_json, job_context_overrides_json, selected_career_profile_id, selected_career_profile_version, career_profile_selection_source, master_profile_version, created_at, updated_at, last_activity_at. Indexes on job_id, status, last_activity_at. Auto-migrated by JobbyDatabase on first access.

## Known Limitations
1. **Tab associations**: Single tab-to-session mapping per session (last-attached tab wins).
2. **Extension start flow**: Uses `manualContext` for extension-initiated sessions rather than full DOM payload.
3. **Profile version reconstruction**: Sessions store version number only; full reconstruction requires profile_history table.
4. **No automatic tab tracking**: User must explicitly attach new tabs/pages.
5. **Extension only**: Full lifecycle requires browser extension or direct REST API.

## Migration / Restart
1. Backend: `pnpm jobby:ui` → http://127.0.0.1:3141
2. Extension: Load `extension/` as unpacked in Chrome
3. Database: Auto-migrated, no manual steps required

## Test Status
120 tests passing across 15 test suites (`pnpm test`).

## Recommended Next Step (Phase 5)
Answer Bank integration: use the stored `selectedCareerProfileId` and `masterProfileVersion` to fetch appropriate Answer Bank items and generate tailored application answers for each session's job context.