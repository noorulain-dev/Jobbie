# Phase 4: Manual Verification Checklist

This document provides exact manual steps to verify all Phase 4 functionality.

## Prerequisites
1. Backend running: `pnpm jobby:ui` (http://127.0.0.1:3141)
2. Extension loaded: chrome://extensions → "Load unpacked" → select `extension/` folder
3. Seed data available (profile-seed.json with 4 career profiles)

---

## 1. Page Detection & Job Preview

### Steps
1. Open a Greenhouse job posting page (e.g., any job at `boards.greenhouse.io`), or use a local HTML fixture
2. Click the Jobby extension icon in the toolbar

### Verify
- [ ] Extension popup shows "Backend Connected" (green dot)
- [ ] Detection badge: "Job Posting Detected" with source name and confidence %
- [ ] Preview shows: Company, Role Title, Source URL
- [ ] If metadata is incomplete, extraction warnings are shown

---

## 2. Start Application

### Steps
1. On a detected job posting, click **"Start Application"**
2. Wait for confirmation

### Verify
- [ ] Confirmation shows: "Session created: [Company] — [Role]"
- [ ] Session appears in "Recent Application Sessions" section with status ACTIVE
- [ ] "Current Tab Session" shows company, role, status

---

## 3. Resume Application (Duplicate Prevention)

### Steps
1. While the session from Step 2 is still ACTIVE, reopen the extension on the same job URL
2. Observe the primary action

### Verify
- [ ] Button shows "Resume Application" (not "Start Application")
- [ ] Clicking it does NOT create a duplicate session
- [ ] Session count in the list remains the same

---

## 4. Session Lifecycle (Pause / Resume / Cancel)

### Steps
1. In the "Recent Application Sessions" section, find the session
2. Click **"Pause"**
3. Click **"Resume"**
4. Click **"Cancel"**

### Verify
- [ ] Status badge changes: ACTIVE → PAUSED → ACTIVE → CANCELLED
- [ ] Cancelled sessions show no Pause/Resume buttons
- [ ] Cancelled sessions show no Cancel button

---

## 5. Attach Application Page (Cross-Tab)

### Steps
1. Create a new session (repeat Steps 1-2)
2. Navigate to a different URL in the same or another tab (e.g., an ATS form page)
3. Open the extension popup on that tab
4. In "Attach Current Page" dropdown, select the session
5. Set page type to "Application Page"
6. Click **"Attach Current Page"**

### Verify
- [ ] Confirmation: "Page attached to: [Company]"
- [ ] Session now shows Application URL: Yes in the list
- [ ] In Web UI (http://127.0.0.1:3141 → Sessions tab), click "View" on the session → Application URL is hyperlinked
- [ ] Original Source URL is NOT overwritten

---

## 6. Context Review & Manual Recovery

### Steps
1. Open http://127.0.0.1:3141 → "Application Sessions" tab
2. Click **"View"** on any session

### Verify
- [ ] Context Review shows all fields with colored provenance badges
- [ ] Green = extracted, Yellow = corrected, Blue = supplied
- [ ] Missing fields show "missing" in grey italic
- [ ] If no description: warning about reduced accuracy is shown
- [ ] **"Open Original Posting"** opens the source URL in a new tab

### Manual Recovery
3. Edit Company name, Role Title, or paste a Description
4. Click **"Save Corrections"**
5. Verify badges change to yellow "corrected" or blue "supplied"
6. Click "View" on the same session again to verify corrections persist

---

## 7. Career Profile Selection

### Steps
1. In the Session Detail view, find the Career Profile section
2. Note the current selection (auto or manual)
3. Change the profile via dropdown
4. Click **"Update Career Profile"**

### Verify
- [ ] Label changes to "(manual)"
- [ ] The new profile persists after page refresh
- [ ] The sessions table now shows the profile with "(manual)" tag

---

## 8. Web UI Sessions Tab

### Steps
1. Open http://127.0.0.1:3141 → "Application Sessions" tab

### Verify
- [ ] All sessions listed with Company, Role, Status badge, Pages count, Profile, Last Activity
- [ ] Pause/Resume/Cancel buttons update status and refresh the table
- [ ] "View" opens detail panel with context review + manual recovery
- [ ] "Close" (✕) hides the detail panel

---

## 9. Backend Restart Persistence

### Steps
1. Create a session and make corrections via the extension
2. Stop the backend (Ctrl+C in terminal running `pnpm jobby:ui`)
3. Restart the backend
4. Open http://127.0.0.1:3141 → Sessions tab

### Verify
- [ ] All sessions are still present
- [ ] Statuses are preserved
- [ ] Manual corrections are preserved
- [ ] Career Profile selection is preserved

---

## 10. Multiple Simultaneous Sessions

### Steps
1. Create 2+ sessions for different jobs
2. Verify each appears separately in the session list
3. Attach different pages to different sessions

### Verify
- [ ] Sessions do NOT mix context
- [ ] Each session has its own company, role, source URL, associated pages
- [ ] Correct session is shown when attaching a page

---

## 11. Error Handling

### Steps
1. Stop the backend
2. Open the extension popup

### Verify
- [ ] "Backend Unavailable" shown with red dot
- [ ] No crash or blank screen
- [ ] Restart backend → popup reconnects on next open

### Non-Job Page
3. Navigate to a non-job page (e.g., Google, Wikipedia)
4. Open the extension popup

### Verify
- [ ] "Not a Job Posting" badge shown
- [ ] Message: "You can still attach it to an existing session"
- [ ] No "Start Application" button

---

## Known Issues
- Tab associations are per-session (not per-tab). Opening the session on a second tab overwrites the tab reference.
- Browser restart discards runtime tab associations; user must reattach pages manually.
- The extension's "Start Application" uses manualContext (lightweight) rather than full DOM payload for the backend parse.

## Next Phase (Phase 5)
Answer Bank integration for session-specific application answers.