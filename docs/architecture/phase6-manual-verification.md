# Phase 6: Manual Verification Checklist

Perform each step manually. Check off as completed.

## Preparation
- [ ] Backend running: `pnpm ui` at `http://127.0.0.1:3141`
- [ ] Master Profile seeded: `pnpm seed`
- [ ] OPENROUTER_API_KEY set in `.env`
- [ ] pdflatex installed and on PATH (verify: `GET /api/compiler/status` returns `available: true`)
- [ ] At least one Career Profile exists
- [ ] At least one Application Session exists with company and role populated

## 1. Generate Resume
- [ ] Open UI → Application Sessions tab
- [ ] Click a session row to view detail
- [ ] Scroll to 📄 Documents section
- [ ] Click "📝 Generate Resume"
- [ ] Observe loading state on buttons
- [ ] Wait for success toast: "Resume v001 generated!"
- [ ] Confirm document appears in list with v001, PDF_COMPILED, "current" tag
- [ ] Click "📄 Open PDF" → new tab shows the PDF
- [ ] Verify PDF contains: name, contact, experience, education, skills, projects
- [ ] Verify employer names, job titles, dates match Master Profile exactly
- [ ] Verify no fabricated metrics or invented facts

## 2. Generate Cover Letter
- [ ] Click "✉️ Generate Cover Letter"
- [ ] Wait for completion
- [ ] Open PDF → verify: sender info, date, company/role, body paragraphs, signature
- [ ] Verify letter references actual experience from profile
- [ ] Verify no invented contact name or fabricated claims

## 3. Check Output Files
- [ ] Navigate to `data/generated/Applications/`
- [ ] Find the correct folder: `{Company} - {Role} - {SessionRef}`
- [ ] Verify `resume/` contains `resume-v001.tex` and `resume-v001.pdf`
- [ ] Verify `cover-letter/` contains `cover-letter-v001.tex` and `cover-letter-v001.pdf`

## 4. Revision
- [ ] In the document list, click "✏️ Revise" on the resume
- [ ] Type: "Make the summary more focused on backend engineering"
- [ ] Click "Submit Revision"
- [ ] Confirm new version v002 appears in list
- [ ] Confirm v001 is still visible (not overwritten)
- [ ] Open v002 PDF → verify changes applied
- [ ] Open v001 PDF → verify still available unchanged

## 5. Version History
- [ ] Confirm both v001 and v002 shown in document list
- [ ] Confirm v002 has "current" tag, v001 does not
- [ ] Confirm timestamps and revision reasons shown correctly

## 6. Missing Context Handling
- [ ] Create or use a session with no job description
- [ ] Generate resume → should succeed (deterministic content works without description)
- [ ] Generate cover letter → should warn about missing description
- [ ] Verify letter generated but may be more generic

## 7. Compiler Missing
- [ ] Temporarily rename pdflatex or note that `GET /api/compiler/status` returns `available: false`
- [ ] Generate resume → should fail with compilation error
- [ ] Verify document shows COMPILATION_FAILED status
- [ ] Verify error message explains pdflatex not found

## 8. LLM Unavailable
- [ ] Temporarily set invalid OPENROUTER_API_KEY
- [ ] Generate resume → should succeed with unrefined content + warning
- [ ] Generate cover letter → should fail (requires OpenRouter)

## 9. Different Sessions Stay Separate
- [ ] Generate a resume for Session A
- [ ] Generate a resume for Session B (different company/role)
- [ ] Confirm different application folders under `data/generated/Applications/`
- [ ] Confirm document lists show only the correct session's documents

## 10. No Profile Modification
- [ ] After generating resume and cover letter
- [ ] Check Master Profile tab → confirm no data was modified
- [ ] Check Career Profile → confirm no data was modified
- [ ] Check Answer Bank → confirm no entries auto-created