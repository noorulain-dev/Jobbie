# Phase 8: Security & Privacy Review

## Trust Boundaries

```
┌─ Browser ──────────────────────────────────────┐
│  Jobby UI (localhost)     Extension Popup        │
│  └─ fetch → localhost:3141  └─ fetch → localhost │
└────────────────────┬────────────────────────────┘
                     │ HTTP (loopback only)
┌─ Backend (127.0.0.1:3141) ──────────────────────┐
│  └─ process.env.* (dotenv)                       │
│  └─ fs.read/write (data/)                        │
│  └─ spawn('pdflatex')                            │
│  └─ fetch → openrouter.ai (HTTPS)                │
└──────────────────────────────────────────────────┘
```

## Protections Implemented

| Layer | Protection | Implementation |
|-------|-----------|---------------|
| **Network** | Loopback binding only | `host: '127.0.0.1'` default, no 0.0.0.0 |
| **Network** | 5MB body size limit | `Content-Length` header check + streaming limit in `readBodyJson` |
| **Network** | Error messages sanitized | Generic `'Internal server error'` to client; details logged to console only |
| **Credentials** | OpenRouter key server-side only | `process.env.OPENROUTER_API_KEY` via dotenv, never in frontend/extension/UI |
| **Credentials** | Key excluded from exports | Tests verify `OPENROUTER_API_KEY` not in export JSON |
| **Credentials** | Startup validation | Warns if key unset or placeholder |
| **Filesystem** | Path traversal prevention | All file serving routes validate `startsWith(resolved root)` |
| **Filesystem** | No arbitrary paths from client | Documents served by artifact ID, not user-supplied paths |
| **Filesystem** | Atomic writes | `writeTexFile()` uses temp+rename |
| **Filesystem** | Temp isolation | UUID-based temp dirs per `compileLatex()` |
| **Process** | No shell injection | `spawn('pdflatex', [...args])` with explicit args array |
| **Process** | 30s timeout | pdflatex process timeout via `{timeout: 30000}` |
| **Extension** | Minimal permissions | `activeTab`, `scripting`, `storage` only |
| **Extension** | Host permission scoped | `http://127.0.0.1:3141/*` only |
| **Extension** | No persistent content script | Injected on-demand via `executeScript` |
| **Extension** | Assisted-only sites protected | LinkedIn/Indeed: no DOM mutation |
| **AI** | Prompt injection mitigated | Profile facts as evidence, not instructions; `validateFacts()` blocks fabrication |
| **AI** | Data minimization | Only relevant profile/job context sent to OpenRouter |
| **AI** | No key in prompts | Key sent as `Authorization` header only |
| **Data** | Startup consistency checks | Compiler, generated dir, OpenRouter key validated at startup |
| **Data** | Graceful shutdown | WAL checkpoint via `storage.getDatabase().close()` |
| **Data** | Corruption logging | JSONL parse failures logged to console |

## Residual Risks

| Risk | Mitigation | Acceptable? |
|------|-----------|-------------|
| Any local process can call API (localhost) | Loopback binding; no authentication | Acceptable for single-user desktop tool |
| Page HTML sent to backend | Transmitted over loopback only; used only for job extraction | Acceptable; documented limitation |
| CORS allows any origin | Low risk with loopback-only binding; UI and extension are only consumers | Acceptable for v1 |
| SQLite not encrypted at rest | Local filesystem; no encryption layer | Acceptable; personal tool |
| No HTTPS for localhost | Loopback interface not exposed to network | Acceptable |
| Console may show profile data in errors | S1 fix removed err.message from responses; console still logs full errors | Acceptable for debugging; user runs locally |

## Configuration Implications

- `JOBBY_HOST` defaults to `127.0.0.1` — safe default
- `JOBBY_PORT` defaults to `3141` — non-standard port, less likely to conflict
- `OPENROUTER_API_KEY` required in `.env` — file excluded by `.gitignore`
- `JOBBY_GENERATED_DIR` defaults to `./data/generated` — within project directory
- No default credentials or hardcoded secrets