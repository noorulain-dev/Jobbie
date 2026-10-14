# Phase 7: Manual Verification Checklist

## Preparation
- [ ] Backend running: `pnpm ui` at `http://127.0.0.1:3141`
- [ ] Master Profile seeded, at least one Career Profile
- [ ] At least one job posting page open in browser

## Tracker Creation
- [ ] Open the extension popup, click "Start Application" on a job posting
- [ ] Open Jobby UI → 📊 Tracker tab
- [ ] Confirm a DRAFT entry appears with correct company and role
- [ ] Click "Start Application" again for the same job
- [ ] Confirm still only ONE entry (not duplicated)
- [ ] Start a different job → confirm a second, separate entry

## Document Links
- [ ] Generate a resume for one application (via session detail → Documents)
- [ ] Generate a cover letter
- [ ] Return to Tracker tab, refresh
- [ ] Confirm 📄 and ✉️ icons are active links for that entry
- [ ] Click each → confirm PDF opens in new tab

## Status Changes
- [ ] Change status via dropdown (e.g., APPLIED → INTERVIEWING)
- [ ] Confirm toast: "Status updated"
- [ ] Check dateApplied column still shows original date
- [ ] Change status back → confirm notes preserved

## Mark Applied
- [ ] Click "✅" on a DRAFT entry
- [ ] Confirm dialog: "Have you submitted this application?"
- [ ] Click OK
- [ ] Confirm dateApplied appears (today's date)
- [ ] Click "✅" again on same entry
- [ ] Confirm dialog still appears but dateApplied does NOT change

## Notes
- [ ] Click 📝 on any entry
- [ ] Type multiline notes with special chars: commas, quotes, emoji
- [ ] Save → refresh → confirm notes persist

## Search & Filter
- [ ] Type partial company name in search → only matching rows shown
- [ ] Select APPLIED from filter dropdown → only APPLIED entries
- [ ] Uncheck "Show archived" → archived entries hidden
- [ ] Clear search + filter → all entries shown

## Session Navigation
- [ ] Click 📋 (View Session) on any entry
- [ ] Confirm switches to Sessions tab and opens that session's detail
- [ ] Verify session shows same company/role as tracker entry

## CSV Export
- [ ] Click "📥 Export CSV"
- [ ] Confirm file downloads as `application-tracker.csv`
- [ ] Open in Excel → confirm UTF-8 characters display correctly
- [ ] Verify 15 columns with headers
- [ ] Verify ALL entries exported (not just filtered view)
- [ ] Verify notes with commas/quotes display correctly
- [ ] Verify no formula-triggering characters execute in Excel
- [ ] Verify no API keys, passwords, or sensitive data in CSV

## Persistence
- [ ] Restart backend (`pnpm ui`)
- [ ] Return to Tracker tab → confirm all entries, statuses, notes, dates persist

## Failure Handling
- [ ] Stop backend → try loading tracker → confirm error message shown
- [ ] Try exporting without backend → confirm meaningful error
- [ ] Confirm no data corruption after failed operations