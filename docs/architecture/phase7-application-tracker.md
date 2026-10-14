# Phase 7: Application Tracker & CSV Export

## Tracker Statuses (separate from session status)
DRAFT → APPLIED → INTERVIEWING → OFFER → REJECTED | WITHDRAWN → ARCHIVED

## Persistence
Tracker state stored in `JobContextOverrides` (session JSON blob in SQLite). No new tables. Fields: `trackerStatus`, `dateApplied`, `trackerNotes`.

## Files
`src/types/application-tracker.ts`, `src/core/tracker-service.ts`, `src/core/csv-writer.ts`, `src/core/session-service.ts` (integration), `src/server/index.ts` (6 endpoints + export), `src/ui/index.html` + `src/ui/app.js` (tracker tab).

## CSV Export
15 columns, UTF-8 with BOM, formula injection protection, full tracker export. Downloaded as `application-tracker.csv`. One-way — Excel edits don't sync back.

## Date Rules
- `dateStarted`: session.createdAt, never changes
- `dateApplied`: set on first markApplied, preserved on repeat, corrected via explicit action
- `markApplied`: confirmation dialog required, records today

## Limitations
No bulk edits, no date filtering, no CSV import, document paths in CSV are relative filenames only.