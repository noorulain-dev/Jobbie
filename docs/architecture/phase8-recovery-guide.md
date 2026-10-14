# Phase 8: Error Recovery Guide

## Operation Outcome Classification

| Outcome | Meaning | UI feedback |
|---------|---------|------------|
| ✅ **Succeeded** | Full operation complete, persisted | Green toast, data refreshed |
| ⚠️ **Partial success** | Main operation succeeded, secondary failed | Warning with recovery action |
| ❌ **Failed (no state change)** | Nothing persisted, safe to retry | Red toast with actionable message |
| 🔒 **Blocked** | Missing config or context | Specific message telling user what to fix |

## Recovery by Scenario

### Resume/Cover Letter Generation Fails

| Error | What was saved | Recovery |
|-------|---------------|----------|
| pdflatex not found | `.tex` file written, artifact created as `TEX_WRITTEN` | Install TeX Live/MiKTeX, then regenerate. `.tex` source is still available. |
| OpenRouter unavailable | Session and profile unchanged | Check `.env` API key and internet. Retry generation. |
| Compilation failed | `.tex` file saved, `COMPILATION_FAILED` status | `.tex` source available for manual compilation. Fix LaTeX errors, retry. |
| Backend unreachable | Nothing changed | Ensure `pnpm ui` is running at port 3141. Retry. |
| LLM returned empty | Nothing persisted | Retry generation — may be temporary API issue. |

### Revision Fails

| Error | What was saved | Recovery |
|-------|---------------|----------|
| Compilation failed | New `.tex` written, previous PDF preserved | Open previous version. Fix issues, revise again. |
| LLM error | Nothing changed | Retry with same or different instructions. |

### Session/Tracker Operations

| Error | What was saved | Recovery |
|-------|---------------|----------|
| Session created, tracker failed | Session saved, tracker DRAFT missing | Open session → tracker auto-repairs on first access. |
| Status update fails (terminal session) | Nothing changed (fixed in Phase 8) | Retry. Now works for COMPLETED/CANCELLED sessions. |
| Notes save fails | Previous notes preserved | Retry save. UI shows error but doesn't clear input. |

### Document Operations

| Error | What was saved | Recovery |
|-------|---------------|----------|
| PDF open fails | — | Artifact may have been deleted. Regenerate or check filesystem. |
| .tex open fails | — | Source may have been deleted. Regenerate resume/cover letter. |

### CSV Export

| Error | What was saved | Recovery |
|-------|---------------|----------|
| Export fails | Nothing changed | Retry export. Check disk space and write permissions. |
| Tracker service unavailable | Nothing changed | Restart backend, retry. |

## Guarded Operations (No Duplicate Runs)

| Operation | Guard |
|-----------|-------|
| Generate Resume | `isDocGenerating` flag |
| Generate Cover Letter | `isDocGenerating` flag |
| Submit Revision | `isDocGenerating` flag |
| Fill Page (Phase 5) | `isFilling` flag in popup.js |

## Recovery Without Data Loss

- Previous PDF never overwritten on failed revision
- Tracker notes preserved on status/numberic-only updates
- Session snapshots never deleted (even on context corrections)
- Profile data never modified by document generation