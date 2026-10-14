# Phase 5: Intelligent Page Filler — Architecture Audit

This audit inspects every relevant subsystem to determine how Phase 5 should integrate. No code changes are made in this step.

---

## 1. Browser Extension Architecture

### Files
- `extension/manifest.json` — MV3, permissions: `activeTab`, `scripting`, `storage`; host: `http://127.0.0.1:3141/*`
- `extension/content.js` — Simple IIFE returning `{ url, html, title }` on injection
- `extension/popup.html` — Connection indicator, detection badge, preview, action buttons, session list
- `extension/popup.js` — Full session lifecycle logic

### ⚠️ Critical Bug Found
**Line 26-27 of `extension/popup.js`**: `checkBackend()` is missing its closing `});` and `}` after `.catch()`. The `function getCurrentTab()` declaration begins inside `.catch()` without the previous function closing. This is a syntax error. **Must be fixed before Phase 5.**

### Trigger Mechanism
- User clicks extension icon → `popup.html` loads → `popup.js` runs
- `checkBackend()` pings `http://127.0.0.1:3141/api/master-profile`
- `getCurrentTab()` calls `chrome.tabs.query` → `chrome.scripting.executeScript` injects `content.js`
- Detection sent to `POST /api/sessions/detect`; session actions to `/api/sessions/start`, etc.

### Communication
- Extension communicates exclusively over `fetch()` to `http://127.0.0.1:3141/api/*`
- No WebSocket, no message passing to service worker
- Content script injected on-demand (not persistently)
- Tab associations in `chrome.storage.local` under `tab_sessions`

### Limitations for Phase 5
- Content script only extracts DOM; does NOT read/write form fields
- No persistent content script injection on application pages
- No form field identification or ATS platform detection

---

## 2. Application Session Model & Service

### Files
- `src/types/application-session.ts` — Sessions, snapshots, overrides, pages
- `src/core/session-service.ts` — Lifecycle service
- `src/core/storage.ts` — `ProfileStorage` session methods
- `src/db/database.ts` — `application_sessions` table

### Session Context for Phase 5
`GET /api/sessions/:id/effective-context` returns merged snapshot+overrides with per-field provenance. Session stores `selectedCareerProfileId`, `careerProfileSelectionSource`, `masterProfileVersion`.

### How Tab Association Works
- `chrome.storage.local.tab_sessions` maps session IDs to `{ sessionId, attachedUrl, pageType, lastKnownUrl }`
- Per-session (not per-tab); runtime-only, lost on browser restart
- No mechanism to verify current tab IS the application page at fill time

### Limitations for Phase 5
- No field-level fill tracking; no per-session fill-state history
- `getEffectiveContext()` merges statically; no caching layer

---

## 3. Master Profile — Fillable Fields

`personal`: firstName, lastName, email, phone, city, provinceState, country, linkedin, github, portfolio
`screening`: workAuthorization, sponsorshipRequired, targetSalary, noticePeriod, yearsExperience, remoteEligibility
`education[]`: degree, institution, major
`experience[]`: title, company, bullets
`skills[]`: name, status, yearsExperience
API: `GET /api/master-profile` (sanitized, no secrets)

---

## 4. Career Profiles

Stored on session via `setCareerProfile()` with `selectionSource` (auto/manual, never downgraded). Fill-relevant: `targetJobTitles`, `headline`, `narrativeSummary`, `salaryPreferences.target`, `seniorityPreferences.yearsExperienceClaim`, `locationPreferences.willingToRelocate`. API: `GET /api/career-profiles`.

---

## 5. Skill Intelligence

Claimability: `EXPLICIT_KNOWN`/`USER_APPROVED_KNOWN` → can claim; `INFERRED_KNOWN` → pending; `LEARNING_TARGET`/`DO_NOT_CLAIM` → prohibited. API: `GET /api/skill-intelligence`.

---

## 6. Application Answer Bank

### Files
- `src/core/answer-bank-service.ts` — Question matching + answering
- `src/core/answer-bank-rules.ts` — 8 pattern-matching rule categories
- `src/core/answer-bank-normalizer.ts` — Question text normalization

### Resolution Pipeline (5 tiers, zero fabrication)
1. Saved exact/alias match (user_confirmed answers)
2. Direct profile links (LinkedIn, GitHub, portfolio URLs)
3. Deterministic canonical fact rules (work auth, sponsorship, salary, notice, education, experience years, location, relocation)
4. Semantic matching via OpenRouter (optional, temp 0.0)
5. UNKNOWN_NEEDS_REVIEW — never invents answers

### Categories: work_authorization, sponsorship, notice_period, salary, education, experience_years, location, work_preference, contact, links, skills, general
### Response Types: yes_no, dropdown, free_text, numeric, date

### Key Method
`answerQuestion(master, options, savedItems)` → `QueryAnswerResult` with `status`, `answer`, `source`, `confidence`, `safeToAutoSubmit`, `requiresHumanConfirmation`

### Limitations for Phase 5
- No batch endpoint; one question at a time
- Requires MasterProfile + CareerProfile + saved items each call
- No form-specific dropdown option awareness

---

## 7. OpenRouter Integration

- `src/ai/openrouter-client.ts`: `OpenRouterClient` class
- API key from `process.env.OPENROUTER_API_KEY` (dotenv), server-side only
- Default model: `anthropic/claude-3.5-sonnet`
- Temperature 0.0 on ALL calls; strict JSON output
- All methods return `[]`/`null` when API key unavailable — silent graceful fallback

---

## 8. UI Conventions

- `src/ui/index.html`: Tabbed SPA; `src/ui/app.js`: ~770 lines vanilla JS
- Reusable: `switchTab(tabName)`, `.card`, `.card-title`, `.status-badge.status-*`, `.form-control`, `.btn .btn-primary/success/warning/danger`, `showToast(msg)`, table lists, Fetch API

---

## 9. Database, API & Security

- SQLite via `better-sqlite3`; tables: profiles, career_profiles, saved_answers, jobs, application_sessions, profile_history
- API: All at `http://127.0.0.1:3141/api/*`; CORS `*`; JSON; no auth (localhost)
- Security: `.env` keys server-side only; `sanitizeProfileForExport()` strips secrets from API responses

---

## 10. Phase 4 Limitations Relevant to Phase 5

1. No content script on application pages — can't auto-detect ATS forms
2. No form field detection or ATS platform identification
3. No per-form fill state tracking
4. **Extension syntax bug** in `popup.js` line 26-27 (must fix)
5. Answer Bank returns one answer at a time — no batch endpoint
6. No form-specific dropdown option awareness
7. Single-tab association (not per-tab)

---

## Proposed Minimal Implementation

### Phase 5a: Content Script Enhancement
- Extend `content.js` to READ form fields from the active page
- Return `{ url, html, title, forms: [{ fields: [{ label, type, name, id, options }] }] }`
- Injected on-demand when user clicks "Fill Page"

### Phase 5b: Backend Fill Endpoint
- `POST /api/sessions/:id/fill` — accepts form field payload, returns answers
- Server-side: session → effective context → career profile → master profile → answer bank
- Loops over fields, calls `AnswerBankService.answerQuestion()` for each
- Returns `{ matchResults: [{ fieldLabel, answer, source, confidence }], unmatched: [...] }`

### Phase 5c: Popup Fill Action
- Add "Fill Application Page" button when current tab is APPLICATION_PAGE
- Content script extracts form fields → backend fills → injects answers into DOM with visual confirmation

### Phase 5d: Human Confirmation
- Fill preview in popup with per-field confidence; `requiresHumanConfirmation: true` needs approval
- "Apply All" / "Apply Selected"; never auto-submit

---

## Integration Risks

1. **ATS diversity**: Each ATS has different field structures
2. **Dynamic forms**: JS-loaded fields; on-demand capture is one snapshot
3. **iFrames**: Greenhouse etc. embed forms in iframes; `all_frames: true` needed
4. **Cross-origin**: Content script in any origin; only 127.0.0.1 host permission
5. **Dropdown matching**: ATS options rarely match Answer Bank format
6. **Over-filling**: "Years of Experience" vs "Years at Current Company" ambiguity
7. **Auto-submission**: Must never auto-submit
8. **Field re-detection**: Dynamic forms may update after partial fills

---

## Files Inspected
`extension/*`, `src/types/application-session.ts`, `src/types/answer-bank.ts`, `src/types/master-profile.ts`, `src/types/career-profile.ts`, `src/types/provenance.ts`, `src/core/session-service.ts`, `src/core/answer-bank-service.ts`, `src/core/answer-bank-rules.ts`, `src/core/storage.ts`, `src/core/profile-selector.ts`, `src/core/skill-intelligence.ts`, `src/core/skill-normalizer.ts`, `src/ai/openrouter-client.ts`, `src/server/index.ts`, `src/ui/index.html`, `src/ui/app.js`, `src/db/database.ts`, `.env.example`

## Key Assumptions
- Phase 5 will NOT auto-submit forms
- User explicitly triggers "Fill Page" (same pattern as "Start Application")
- Content script enhanced, not replaced; sensitive data stays server-side
- No new storage needed; existing session + profile + answer bank suffices

## Recommended Next Step
1. **Fix** `popup.js` syntax bug (line 26-27)
2. **Implement Phase 5a**: Content script form field extraction
3. **Implement Phase 5b**: Backend batch fill endpoint