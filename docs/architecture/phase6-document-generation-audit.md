# Phase 6: Resume & Cover Letter Generation — Architecture Audit

*Performed: 2026-10-10 | Audit only, not implemented*

## 1. Runtime & Environment

- **Node.js v22.23.2** (ESM, `"type": "module"`)
- **TypeScript 7.0.2** with `tsx` runner
- **pnpm** package manager
- Backend: `http://127.0.0.1:3141`

### Filesystem
Backend has full local write access (`fs.writeFileSync`, `fs.mkdirSync`, `fs.appendFileSync` used throughout `ProfileStorage` and server). No sandbox restrictions.

### Configuration
`.env.example` defines `JOBBY_DATA_DIR`, `JOBBY_DB_PATH`, `JOBBY_PORT`, `JOBBY_HOST`. No output-directory config yet.

### LaTeX / PDF Tooling
**None installed.** `pdflatex`, `xelatex`, `lualatex`, `latexmk` all return "not found." No PDF library in `package.json` (no `puppeteer`, `pdfkit`, `jspdf`). No LaTeX templates exist. `.gitignore` excludes `data/source/*.pdf` and `data/generated/*` — patterns already anticipated.

**Decision required:** Install TeX distribution or choose a Node.js-native PDF approach.

## 2. Authoritative Data Sources

### Master Profile (`data/profile/master-profile.json`)
Canonical source: personal info, screening, education, experience (with bullet points), projects, skills (with status), certifications, awards, leadership, languages. Full provenance on every field.

### Career Profiles (`data/profile/career-profiles/*.json`)
Lenses on Master Profile, not copies:
- Priority ordering for experience, projects, skills
- **`customResumeInstructions`** — user-authored prompt for resume generation
- **`customCoverLetterInstructions`** — user-authored prompt for cover letter generation
- `prohibitedClaims`, `applicationStrategyRules`, preferred keywords

### Job Context (per Application Session)
- `JobContextSnapshot` — immutable capture at creation
- `JobContextOverrides` — manual corrections with per-field provenance
- `getEffectiveContext()` — merged view (`extracted` | `corrected` | `supplied`)

### Answer Bank (`data/profile/answer-bank/*.json`)
Saved answers with `parameterizedTemplate` field for template reuse.

### Phase 5 Narrative Generator
`buildProfileEvidence()`, `buildJobContext()`, `buildAnswerBankContext()` — directly reusable for document prompts.

## 3. Reusable Services

| Component | File | Reusability |
|-----------|------|------------|
| `OpenRouterClient` | `src/ai/openrouter-client.ts` | Same API key, model, error handling |
| Evidence assembly | `src/core/narrative-generator.ts` | `buildProfileEvidence`, `buildJobContext` |
| `getEffectiveContext()` | `src/core/session-service.ts:303` | Entry point for document context |
| `ProfileStorage` | `src/core/storage.ts` | `fs.mkdirSync`, `fs.writeFileSync`, append logs |
| Static file serving | `src/server/index.ts:54-94` | Reuse for serving generated PDFs |
| Session detail UI | `src/ui/app.js:656-710` | Add generate buttons here |
| Tabs, toasts, badges | `src/ui/index.html`, `app.js` | Reuse all UI patterns |
| Status badges | CSS | Reuse for document status (draft/generated/reviewed) |

## 4. Missing Capabilities

### Blockers
| Gap | Risk |
|-----|------|
| **No PDF generation method** | HIGH — must decide before implementation |
| No document prompt templates | Prompt must be built from scratch |
| No document-to-session association | Need metadata field or separate entity |
| No output dir config | Need `JOBBY_GENERATED_DIR` env var |
| No revision tracking | Need generation log at minimum |
| No `.gitkeep` in `data/generated/` | Directory exists but empty |

### Important
- No document status lifecycle model
- No UI for document list/generation actions
- No download/open mechanism from UI

## 5. Architecture Questions — Answered
### Q: What is the authoritative source for resume facts?
**A:** Master Profile (`data/profile/master-profile.json`) is canonical. Career Profiles reorder/prioritize but never duplicate. Phase 5 evidence assembly pattern directly reusable.

### Q: How do manual corrections interact with generation?
**A:** `getEffectiveContext()` merges snapshot + overrides with per-field provenance (`extracted` | `corrected` | `supplied`). Document generation should consume the effective context so manual corrections flow through.

### Q: How can a generated document be associated with a session?
**A:** Minimal: add `generatedDocuments` array to `JobContextOverrides`. With generation log file (`data/generated/generation-log.jsonl`) for history.

### Q: What is the existing mechanism for server-side OpenRouter requests?
**A:** `OpenRouterClient` in `src/ai/openrouter-client.ts`. Phase 5 `narrative-generator.ts` already uses same patterns. New `document-generator.ts` follows this pattern.

### Q: Where should generated files live?
**A:** `data/generated/` (already in `.gitignore`, directory exists). Naming: `{sessionId}-resume-{timestamp}.pdf`. Add `JOBBY_GENERATED_DIR` env var.

### Q: How should the app return a local PDF path to the UI?
**A:** Add `GET /api/generated/:filename` route. Serve with `Content-Type: application/pdf`. UI opens via `window.open()`. Return URL in API response.

### Q: What existing components can be reused for revisions?
**A:** Append-only changelog pattern → generation log. Session detail view → document detail. Toast notifications → progress/errors. Status badges → document status.

## 6. PDF Generation — Options

| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| **A: LaTeX + pdflatex** | Highest quality, industry standard, version-controllable .tex | Requires TeX install (~500MB+), opaque errors | Medium + user setup |
| **B: Puppeteer HTML→PDF** | No system deps, reliable, easy templates | ~300MB Chromium, less typographic control | Low-Medium |
| **C: Plain Text/Markdown** | Zero deps, simplest | Not a PDF, manual formatting needed | Very Low |
| **D: PDFKit (Node.js)** | No external deps, programmatic | Manual layout, high effort for professional look | High |

**Recommendation:** Option A (LaTeX) if user installs TeX, with Option B (Puppeteer) as fallback.

## 7. Minimal Implementation Plan

### Files to Create
| File | Purpose |
|------|---------|
| `src/types/generated-document.ts` | Document type schema |
| `src/core/document-generator.ts` | Prompt construction + OpenRouter call |
| `src/core/pdf-renderer.ts` | LaTeX/Puppeteer PDF compilation |
| `data/generated/.gitkeep` | Keep directory tracked |

### Files to Modify
| File | Change |
|------|--------|
| `src/server/index.ts` | Add `POST /api/sessions/:id/generate-resume`, `POST /api/sessions/:id/generate-cover-letter`, `GET /api/generated/:filename` |
| `src/ui/index.html` | Add document section to session detail |
| `src/ui/app.js` | Add generate buttons, document list, open PDF logic |
| `.env.example` | Add `JOBBY_GENERATED_DIR` |
| `src/index.ts` | Export new modules |

### Step 1: Types & Storage
Define `GeneratedDocument` interface, add endpoints, store metadata in generation log.

### Step 2: Prompt Construction
Create `document-generator.ts`, reuse Phase 5 evidence assembly, build resume prompt (structured, Career Profile instructions), build cover letter prompt (narrative, company-specific).

### Step 3: PDF Rendering
Check for `pdflatex`; if missing, report clearly. LaTeX template + compilation, or Puppeteer HTML→PDF fallback.

### Step 4: UI Integration
"Generate Resume" / "Generate Cover Letter" buttons in session detail. Document list with status. Open PDF in new tab. Generation progress (loading state, toast).

### Step 5: Revision Tracking
`data/generated/generation-log.jsonl` append on each generation. Show history in session detail. Allow re-generation without overwriting.

## 8. Decisions Pending User Input

1. **PDF approach:** Install TeX distribution or use Node.js-native library?
2. **Document format:** Separate resume + cover letter, or combined?
3. **Output directory:** `data/generated/` default, or configurable?
4. **Template customization:** Use Career Profile instructions as-is, or add UI?
5. **File naming:** `{sessionId}-resume-{timestamp}.pdf` or `{company}-{role}-resume.pdf`?
6. **Auto-open after generation:** Open in browser or show download link?

## 9. Files Inspected During Audit

| File | Relevance |
|------|-----------|
| `package.json` | Runtime, deps, scripts — no PDF/LaTeX libraries |
| `src/server/index.ts` | Backend routes, file serving, API patterns |
| `src/core/storage.ts` | Filesystem access patterns, directory creation |
| `src/core/session-service.ts:303` | `getEffectiveContext()` — the context entry point |
| `src/ai/openrouter-client.ts` | AI client — API key, model, request pattern |
| `src/core/narrative-generator.ts` | Evidence assembly, prompt construction, response parsing |
| `src/types/answer-bank.ts` | `parameterizedTemplate` field |
| `src/types/career-profile.ts` | `customResumeInstructions`, `customCoverLetterInstructions` |
| `src/types/application-session.ts` | Session schema, snapshot, overrides |
| `src/ui/index.html` | UI structure, tabs, session detail |
| `src/ui/app.js` | UI logic, session rendering, toast, escapeHtml |
| `src/cli/seed.ts` | Career Profile seeding with custom instructions |
| `.env.example` | Configuration conventions |
| `.gitignore` | `data/generated/*` already excluded |
| `data/generated/` | Directory exists, empty, no `.gitkeep` |
| `data/profile/career-profiles/*.json` | 4 profiles with generation instructions |
| System PATH | `pdflatex` not found — no TeX installed |