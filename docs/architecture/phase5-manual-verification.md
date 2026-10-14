# Phase 5: Manual Verification Checklist

Perform on real job application pages. Each step should pass.

## Preparation
- [ ] Backend running at `http://127.0.0.1:3141`
- [ ] Backend shows "Backend Connected" (green dot in popup)
- [ ] `.env` has `OPENROUTER_API_KEY` set
- [ ] Extension loaded unpacked from `extension/`
- [ ] Extension reloaded after latest code changes
- [ ] Master Profile configured (first name, last name, email, phone, city, education, 1+ experience, 3+ skills)
- [ ] At least one Career Profile selected
- [ ] At least one saved Answer Bank entry

## 1. Basic Fill — Known Facts
- [ ] Attach application page to correct session
- [ ] Click "Fill Page"
- [ ] Observe progress: "Scanning..." → "Classifying N fields..." → "Applying..."
- [ ] Summary shows filled count > 0
- [ ] First name, last name, email, phone filled on page
- [ ] Values match Master Profile
- [ ] Popup shows ✅ icons for filled fields
- [ ] Source labels show "Master Profile"

## 2. Existing Values Protected
- [ ] Fill on a page with some pre-filled fields
- [ ] Already-populated fields NOT overwritten
- [ ] Summary shows ▶ "N kept"
- [ ] Reason: "Already populated" or "Value already matches"

## 3. Repeat Safety
- [ ] Click "Fill Page" twice
- [ ] No duplicate values, no checkbox toggle
- [ ] No concurrent run error

## 4. Dropdown / Select
- [ ] Form with `<select>` dropdowns → Fill Page
- [ ] Dropdown set to matching option
- [ ] No-match: field marked FAILED with reason

## 5. Radio Groups
- [ ] Form with radio buttons → Fill Page
- [ ] Matching radio selected, others deselected

## 6. Approved Skills
- [ ] EXPLICIT_KNOWN / USER_APPROVED_KNOWN skills in profile
- [ ] Fill Page on form with skill inputs
- [ ] Approved skills filled; LEARNING_TARGET / DO_NOT_CLAIM NOT filled

## 7. AI Narrative Generation  
- [ ] Form with "Why are you interested?", "Describe a project", etc.
- [ ] Click Fill Page, observe "Generating N narrative answer(s)..."
- [ ] Answer shows 🤖 icon + "AI-generated — review" badge
- [ ] Answer references actual experience/skills (not fabricated)
- [ ] Tailored to company/role from job context
## 8. Missing Facts — Needs User Input
- [ ] Form with field having no matching profile fact → Fill Page
- [ ] ❓ icon shown
- [ ] Reason shown (e.g., "No verified answer")

## 9. Sensitive Fields — Never Filled
- [ ] Form with password, SSN, or demographic questions → Fill Page
- [ ] Fields marked ❌ UNSUPPORTED
- [ ] NO value written to these fields

## 10. Assisted-Only (LinkedIn/Indeed)
- [ ] LinkedIn or Indeed application page → Fill Page
- [ ] Warning banner: "[site] restricts automated form interaction"
- [ ] Answers displayed in popup, NOT written to page
- [ ] Copy button functional
- [ ] No DOM mutation

## 11. Safe Undo
- [ ] After successful fill → "Undo (N changes)" button visible
- [ ] Confirm prompt with correct count
- [ ] Fields restored to previous values
- [ ] Manually edit a field, fill again, undo → that field SKIPPED
- [ ] Reason: "User has modified the field since fill"

## 12. Missing Session
- [ ] No session attached → Fill Page
- [ ] Error: "No session attached"
- [ ] Button re-enables

## 13. Backend Down
- [ ] Stop backend → Fill Page
- [ ] Error about backend unavailability
- [ ] Button re-enables

## 14. LLM Failure
- [ ] Invalid OpenRouter key or no internet → Fill Page (narrative form)
- [ ] Deterministic fields still filled
- [ ] Narrative fields show ❓ with reason

## 15. No Auto-Submit
- [ ] After fill, verify form NOT submitted
- [ ] "Submit"/"Apply"/"Continue" NOT clicked
- [ ] Page still at same URL

## 16. React/Framework Forms
- [ ] Test on Greenhouse, Lever, or similar
- [ ] Text inputs accept values
- [ ] Select dropdowns update correctly
- [ ] Radio/checkbox changes reflected

Report failures with: website URL, specific field, expected vs actual, browser console errors.
- [ ] Assisted-only: Copy button works