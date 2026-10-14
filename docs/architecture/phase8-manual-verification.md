# Phase 8: Manual Verification Guide

Use actual commands and UI actions. Perform each section independently.

## A. Startup & Persistence
- [ ] Start backend: `pnpm ui` — confirm "Jobby Career Brain UI running at: http://127.0.0.1:3141"
- [ ] Open http://127.0.0.1:3141 — confirm UI loads with tabs
- [ ] Check Master Profile tab — confirm profile data is present
- [ ] Check Application Sessions tab — confirm existing sessions visible
- [ ] Check Tracker tab — confirm existing entries visible
- [ ] Check Documents section in session detail — confirm existing docs listed
- [ ] Stop backend (Ctrl+C) and restart — confirm all data persists
- [ ] Check `.env` has `OPENROUTER_API_KEY` set — confirm startup shows no warning

## B. Configuration & Error Detection
- [ ] Temporarily set an invalid port (port already in use): no easy way — skip
- [ ] Check console output after restart for `[startup]` warnings
- [ ] If pdflatex is installed: no warning. If not: `[startup] pdflatex not found` appears
- [ ] If OpenRouter key is set: no warning. If not: `[startup] OPENROUTER_API_KEY not set` appears
- [ ] Open extension popup — confirm green dot + "Backend Connected"

## C. Session & Tracker Creation
- [ ] Navigate to a job posting page
- [ ] Open extension popup → click Start Application
- [ ] Open UI → Tracker tab → confirm DRAFT entry for that company/role
- [ ] Return to same job page → click Start Application again
- [ ] Tracker tab → confirm STILL only one entry (no duplicate)
- [ ] Open UI → Sessions tab → view the session → confirm context shows correct company/role

## D. Document Generation
- [ ] In session detail, click "Generate Resume"
- [ ] Wait for completion (may take 30-60 seconds)
- [ ] Confirm "Resume v001 generated!" toast
- [ ] Click "Open PDF" → new tab shows PDF with name, experience, education, skills
- [ ] Click "Generate Cover Letter"
- [ ] Wait → confirm "Cover letter v001 generated!"
- [ ] Open PDF → confirm company/role match, body paragraphs present

## E. Revision & Version History
- [ ] In document list, click "Revise" on the resume
- [ ] Type: "Make the summary shorter"
- [ ] Click Submit → wait → confirm "Revision v002 created!"
- [ ] Confirm v002 appears with "current" tag, v001 still listed
- [ ] Open v001 PDF → confirm still works
- [ ] Open v002 PDF → confirm changes applied

## F. Tracker Operations
- [ ] In Tracker tab, find the DRAFT entry for your application
- [ ] Click "✅" or select APPLIED from dropdown → confirm dialog
- [ ] Click OK → confirm dateApplied shows today
- [ ] Change status to INTERVIEWING via dropdown
- [ ] Confirm dateApplied still shows, notes preserved
- [ ] Click "📝 Notes" → type "Follow up next week. Special chars: comma, \"quote\", émoji: 🎉"
- [ ] Save → refresh → confirm notes persist with all characters

## G. CSV Export
- [ ] Click "📥 Export CSV"
- [ ] File downloads as `application-tracker.csv`
- [ ] Open in Excel/Google Sheets
- [ ] Confirm all 15 column headers present
- [ ] Confirm ALL tracker entries exported (not just visible/filtered)
- [ ] Confirm notes with commas, quotes, and Unicode display correctly
- [ ] Confirm no formula-triggering characters execute in spreadsheet
- [ ] Confirm document paths show versioned filenames (e.g., `resume-v001.pdf`)
- [ ] Confirm no API keys, credentials, or personal profile data in CSV

## H. Error Recovery
- [ ] Stop backend → open extension popup → confirm red dot + "Backend Unavailable"
- [ ] In UI, click refresh on Tracker tab → confirm error shown, no data lost
- [ ] Restart backend → confirm all data still present
- [ ] Generate resume → click again while generating → confirm second click ignored (no duplicate)
- [ ] If pdflatex missing: generate resume → confirm "PDF compiler not found" message
- [ ] If OpenRouter key missing: try generate cover letter → confirm "OpenRouter unavailable" message

## I. Security Boundaries
- [ ] In browser console, type `fetch('/api/master-profile')` — confirm profile returns (local only)
- [ ] In browser, try `fetch('/api/generated/../../../etc/passwd')` — confirm 403/404, not served
- [ ] Open generated PDF → confirm URL is `/api/documents/{id}/pdf`, not a filesystem path
- [ ] Check browser network tab for any request → confirm `OPENROUTER_API_KEY` never appears
- [ ] After filling, confirm form was NOT automatically submitted