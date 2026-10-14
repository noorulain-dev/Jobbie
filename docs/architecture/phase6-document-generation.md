# Phase 6: Resume & Cover Letter Generation — Final Architecture

## Files Created
`src/types/generated-document.ts`, `src/types/latex-content.ts`, `src/core/document-store.ts`, `src/core/document-content-service.ts`, `src/core/latex-escape.ts`, `src/core/resume-template.ts`, `src/core/cover-letter-template.ts`, `src/core/pdf-compiler.ts`, `src/core/resume-generator.ts`, `src/core/cover-letter-generator.ts`

## Files Modified
`src/server/index.ts` (8 endpoints), `src/ui/app.js` (document UI section + 10 functions), `src/index.ts`, `src/types/index.ts`, `.env.example`

## Generation Flow
User clicks Generate → POST /generate-resume → resolveContext (session, master, career profile, effective job context) → prepareResumeContent (deterministic facts + evidence) → refineWithLLM (optional, falls back) → validateFacts (titles/employers/dates preserved) → buildResumeLatex → compileLatex (two-pass pdflatex) → artifact saved as PDF_COMPILED.

## Revision Flow
POST /documents/:id/revise {instructions} → Load artifact, resolveContext, prepareContent → reviseWithLLM (current content + instructions, NEVER change facts) → validateFacts → new version → compile → save. Previous version preserved.

## Output: data/generated/Applications/{Company - Role - SessionRef}/{resume|cover-letter}/vNNN.{tex|pdf}

## Security: Paths validated against generatedDir root. PDF/.tex serving by artifact ID only. LaTeX escaping. spawn() with explicit args. Unique temp dir per compilation.

## Required: OPENROUTER_API_KEY, pdflatex installed, JOBBY_GENERATED_DIR=./data/generated

## Limitations: pdflatex only, single Charter font, no template customization UI, cover letter requires OpenRouter, JSONL log only.