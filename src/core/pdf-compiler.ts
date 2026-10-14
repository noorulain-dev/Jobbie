import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export interface CompilerInfo {
  available: boolean;
  executable: string | null;
  version: string | null;
  installHint: string;
}

export interface CompileResult {
  success: boolean;
  pdfPath: string | null;
  texPath: string | null;
  logPath: string | null;
  artifactId?: string;
  version?: number;
  errorMessage?: string;
  compilerOutput?: string;
}

const COMPILE_TIMEOUT_MS = 30_000;
const MAX_LOG_BYTES = 50_000;

export function detectCompiler(): CompilerInfo {
  try {
    const out = execSync('pdflatex --version', { timeout: 5000, windowsHide: true, encoding: 'utf-8' });
    const firstLine = out.split('\n')[0] || '';
    return { available: true, executable: 'pdflatex', version: firstLine.trim(), installHint: '' };
  } catch {
    return {
      available: false, executable: null, version: null,
      installHint:
        'pdflatex not found. Install TeX Live (https://tug.org/texlive/) or MiKTeX (https://miktex.org/). ' +
        'macOS: "brew install --cask mactex". Ubuntu: "sudo apt install texlive-latex-base". ' +
        'Windows: https://miktex.org/download.',
    };
  }
}

function isValidPdf(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('ascii').startsWith('%PDF');
  } catch { return false; }
}

async function runPdflatex(texPath: string, workDir: string): Promise<{ pdfPath: string | null; log: string }> {
  return new Promise((resolve) => {
    const texBase = path.basename(texPath, '.tex');
    const child = spawn('pdflatex', [
      '-interaction=nonstopmode', '-halt-on-error',
      '-output-directory', workDir, texPath,
    ], { cwd: workDir, timeout: COMPILE_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '', stderr = '';
    child.stdout?.on('data', (c: Buffer) => { if (stdout.length < MAX_LOG_BYTES) stdout += c.toString('utf-8'); });
    child.stderr?.on('data', (c: Buffer) => { if (stderr.length < MAX_LOG_BYTES) stderr += c.toString('utf-8'); });

    child.on('close', (code) => {
      const log = (stdout + '\n' + stderr).trim().substring(0, MAX_LOG_BYTES);
      const expectedPdf = path.join(workDir, `${texBase}.pdf`);
      if (code !== 0) { resolve({ pdfPath: null, log: `pdflatex exit ${code}\n${log}` }); return; }
      if (!fs.existsSync(expectedPdf)) { resolve({ pdfPath: null, log: 'No PDF produced\n' + log }); return; }
      if (!isValidPdf(expectedPdf)) { resolve({ pdfPath: null, log: 'Invalid PDF\n' + log }); return; }
      resolve({ pdfPath: expectedPdf, log });
    });

    child.on('error', (err) => { resolve({ pdfPath: null, log: `spawn error: ${err.message}` }); });
  });
}

export async function compileLatex(texPath: string, outputDir: string, pdfFilename: string): Promise<CompileResult> {
  const compiler = detectCompiler();
  if (!compiler.available) return { success: false, pdfPath: null, texPath, logPath: null, errorMessage: compiler.installHint };
  if (!fs.existsSync(texPath)) return { success: false, pdfPath: null, texPath, logPath: null, errorMessage: `Source not found: ${texPath}` };

  const tempDir = path.join(os.tmpdir(), `jobby-pdflatex-${crypto.randomUUID().substring(0, 8)}`);
  try { fs.mkdirSync(tempDir, { recursive: true }); }
  catch { return { success: false, pdfPath: null, texPath, logPath: null, errorMessage: 'Cannot create temp dir' }; }

  try {
    // First pass
    const p1 = await runPdflatex(texPath, tempDir);
    if (!p1.pdfPath) {
      const logPath = texPath.replace(/\.tex$/, '.compile.log');
      fs.writeFileSync(logPath, p1.log || '', 'utf-8');
      return { success: false, pdfPath: null, texPath, logPath, errorMessage: 'Compilation failed', compilerOutput: p1.log?.substring(0, 2000) };
    }

    // Second pass (cross-references)
    const p2 = await runPdflatex(texPath, tempDir);
    const finalPdf = p2.pdfPath || p1.pdfPath;
    if (!finalPdf || !isValidPdf(finalPdf)) {
      return { success: false, pdfPath: null, texPath, logPath: null, errorMessage: 'PDF validation failed' };
    }

    // Publish
    const target = path.join(outputDir, pdfFilename);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(finalPdf, target);

    return { success: true, pdfPath: target, texPath, logPath: null, compilerOutput: p1.log?.substring(0, 1000) };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}