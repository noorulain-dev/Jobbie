# Phase 5: Intelligent Page Filler — Architecture

## Overview

Phase 5 implements deterministic and AI-assisted page filling. It reads form fields from job application pages, classifies them, resolves answers from known profile facts and saved answers, optionally generates narrative answers via OpenRouter, and safely writes values into the DOM — or shows copy-ready answers on restricted sites.

## Entry Point

User clicks "Fill Page" in the Jobby extension popup. The button runs scanning automatically if not yet performed.

## End-to-End Flow

```
1. unifiedFillPage() → guard isFilling, resolve session + policy
2. runFillPipeline() → auto-scan if needed, then classify
3. runClassification() → POST /classify-fields, then augmentWithNarratives
4. augmentWithNarratives() → POST /generate-narratives (batched, conditional)
5. Dispatch: assisted_only (preview) or allowed (doFillPage → inject fillFields)
6. completeFill() → merge results → finishFill()
7. renderFillSummary() + renderFillDetails() + renderFillActions()
```

## Files

| File | Role |
|------|------|
| `extension/popup.html` | UI structure, CSS |
| `extension/popup.js` | Pipeline orchestration, rendering, undo |
| `extension/content.js` | scanFormFields, fillFields, writeValue, undoFields |
| `src/server/index.ts` | /classify-fields, /generate-narratives endpoints |
| `src/core/field-classifier.ts` | 30+ intent rules |
| `src/core/field-resolver.ts` | 4-tier answer resolution |
| `src/core/narrative-generator.ts` | Prompt construction, OpenRouter call, validation |

## Supported & Unsupported Fields

**Supported:** name, contact, links, location, employment, education, skills (approved), work authorization/sponsorship, salary, years experience, relocation, remote preference, narrative (AI).

**Never filled:** passwords, SSN, credit cards, demographics, file uploads, hidden inputs, LEARNING_TARGET/DO_NOT_CLAIM skills.

## Source Provenance

- `master_profile_fact` — direct MasterProfile facts
- `user_approved_skill` — EXPLICIT_KNOWN / USER_APPROVED_KNOWN
- `answer_bank_entry` — saved Application Answer Bank
- `generated_approved_evidence` — AI-generated from evidence
- `inferred_needs_review` — low confidence, review required

## What Goes to OpenRouter

**Sent:** Career headline, top 4 experience with ≤4 bullets, top 2 education, ≤25 approved skills, top 3 projects, languages, ≤3 certifications, relocation/remote (yes/no only), job context (≤1500 chars desc, ≤5 each: responsibilities, quals, skills), matched saved answers.

**Never sent:** Email, phone, address, URLs, salary, visa, demographics, passwords, full profiles, raw HTML, API keys.

## Site Policy

- `linkedin.com`, `indeed.com` → assisted_only (copy-ready, no DOM mutation)
- All others → allowed (full fill)

## Error Handling

- No session → message, no fill
- Scan/classification fails → error, button re-enables
- OpenRouter unavailable/invalid → narratives stay NEEDS_USER_INPUT, deterministic fill proceeds
- One write fails → others fill normally
- isFilling guard prevents duplicate runs

## Undo

Stores changed fields. Verifies live value matches inserted value before restoring. User-modified fields are skipped.

## Limitations

1. No submit prevention against framework handlers
2. Radio dedup assumes consecutive elements
3. No multi-select proper handling
4. Checkbox groups treated individually
5. DOM changes between scan and fill may cause mismatches
6. Undo only available per popup session
7. Page policy is client-side only

## Configuration

- `OPENROUTER_API_KEY` in `.env`
- Backend at `http://127.0.0.1:3141`
- Extension loaded unpacked from `extension/`
- Extension reload after code changes