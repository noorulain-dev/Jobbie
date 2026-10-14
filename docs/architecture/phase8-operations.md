# Phase 8: Operations — Setup, Startup, & Recovery

## How to Start Jobby

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env: set OPENROUTER_API_KEY (get from https://openrouter.ai/keys)

# 3. Seed profile data (first time only)
pnpm seed

# 4. Start the backend + UI + API
pnpm ui
# Opens at: http://127.0.0.1:3141

# 5. Load the browser extension (Chrome/Edge)
# - Open chrome://extensions
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the `extension/` directory
```

## Configuration (.env)

| Variable | Required? | Default | Purpose |
|----------|-----------|---------|---------|
| `OPENROUTER_API_KEY` | For AI features | — | OpenRouter API key |
| `OPENROUTER_DEFAULT_MODEL` | No | `anthropic/claude-3.5-sonnet` | Model for generation |
| `JOBBY_DATA_DIR` | No | `./data` | Root data directory |
| `JOBBY_DB_PATH` | No | `./data/profile/master-profile.db` | SQLite database |
| `JOBBY_GENERATED_DIR` | No | `./data/generated` | PDF/tex output |
| `JOBBY_PORT` | No | `3141` | Server port |
| `JOBBY_HOST` | No | `127.0.0.1` | Listen address |

## Your Data (Everything Is Local)

| Data | Location |
|------|----------|
| Master Profile | `data/profile/master-profile.json` + SQLite |
| Career Profiles | `data/profile/career-profiles/*.json` |
| Answer Bank | `data/profile/answer-bank/*.json` |
| Jobs | `data/profile/jobs/*.json` + SQLite |
| Application Sessions | `data/profile/sessions/*.json` + SQLite |
| Generated PDFs | `data/generated/Applications/{Company - Role - SessionRef}/` |
| Generation Log | `data/generated/generation-log.jsonl` |
| Database | `data/profile/master-profile.db` (SQLite WAL) |

## Common Problems & Recovery

### "Port 3141 is already in use"
```
→ Stop the other Jobby process, or set JOBBY_PORT=3142 in .env and restart.
```

### "Backend Unavailable" (red dot in extension popup)
```
→ Ensure pnpm ui is running at http://127.0.0.1:3141
→ Check no firewall blocking localhost
→ Restart backend: pnpm ui
```

### "OpenRouter not configured"
```
→ Set OPENROUTER_API_KEY in .env (get key from https://openrouter.ai/keys)
→ Resume generation works without LLM (uses profile content as-is)
→ Cover letter generation requires OpenRouter
```

### "pdflatex not found"
```
→ Windows: install MiKTeX from https://miktex.org/download
→ macOS: brew install --cask mactex
→ Ubuntu: sudo apt install texlive-latex-base texlive-latex-extra
→ After install, restart Jobby
```

### "Session not found" in extension popup
```
→ Attach or start a session first. Click "Start Application" from a job posting page.
→ Or use the UI's Sessions tab to attach an existing session.
```

### "No job context" for cover letter
```
→ Open a job posting page in the browser, then click "Start Application" in the popup.
→ Or use the UI's Session Detail to manually enter company and role.
```

## Preserving Data During Updates

```bash
# The data/ directory contains all your profiles, sessions, and generated documents.
# It is excluded from git by .gitignore.
# When updating code:
# 1. git pull
# 2. pnpm install (if dependencies changed)
# 3. Do NOT delete data/ 
# 4. pnpm ui
```

## Installing LaTeX (for PDF generation)

| OS | Command |
|----|---------|
| **Windows** | Download from https://miktex.org/download |
| **macOS** | `brew install --cask mactex` |
| **Ubuntu/Debian** | `sudo apt install texlive-latex-base texlive-latex-extra` |

Verify: `pdflatex --version` should show a version number. Jobby checks this at startup — look for `[startup] pdflatex not found` warning if missing.