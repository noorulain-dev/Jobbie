import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  GeneratedDocument,
  GeneratedDocumentSchema,
  GeneratedDocumentListItem,
  DocumentType,
  DocumentStatus,
} from '../types/generated-document.js';
import { ProfileStorage } from './storage.js';

const UNSAFE_PATH_CHARS = /[<>:\"|?*\\\/\x00-\x1f]/g;
const MAX_NAME_LEN = 80;
const FALLBACK_NAME = 'Unknown';

export interface DocumentStoreOptions {
  generatedDir?: string;
}

export class DocumentStore {
  private generatedDir: string;
  private storage: ProfileStorage;

  constructor(storage: ProfileStorage, options: DocumentStoreOptions = {}) {
    this.storage = storage;
    this.generatedDir = options.generatedDir || process.env.JOBBY_GENERATED_DIR || './data/generated';
  }

  private sanitizeName(raw: string): string {
    if (!raw || !raw.trim()) return FALLBACK_NAME;
    let s = raw.replace(UNSAFE_PATH_CHARS, '_').replace(/\s+/g, ' ').trim();
    if (s.length > MAX_NAME_LEN) s = s.substring(0, MAX_NAME_LEN).trimEnd();
    if (!s) return FALLBACK_NAME;
    return s;
  }

  private appDirPath(sessionId: string, company: string, role: string): string {
    const c = this.sanitizeName(company);
    const r = this.sanitizeName(role);
    const ref = sessionId.substring(sessionId.length - 8);
    const appName = `${c} - ${r} - ${ref}`;
    return path.join(this.generatedDir, 'Applications', appName);
  }

  private typeDirPath(appDir: string, docType: DocumentType): string {
    const dir = docType === 'RESUME' ? 'resume' : 'cover-letter';
    return path.join(appDir, dir);
  }

  private validatePath(targetPath: string): string {
    const resolved = path.resolve(targetPath);
    const root = path.resolve(this.generatedDir);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error(`Path traversal: ${targetPath} resolves outside ${root}`);
    }
    return resolved;
  }

  ensureAppDir(sessionId: string, company: string, role: string): string {
    const appDir = this.validatePath(this.appDirPath(sessionId, company, role));
    if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
    const td = this.typeDirPath(appDir, 'RESUME');
    if (!fs.existsSync(td)) fs.mkdirSync(td, { recursive: true });
    const cl = this.typeDirPath(appDir, 'COVER_LETTER');
    if (!fs.existsSync(cl)) fs.mkdirSync(cl, { recursive: true });
    if (!fs.existsSync(this.generatedDir)) {
      fs.mkdirSync(this.generatedDir, { recursive: true });
      const gk = path.join(this.generatedDir, '.gitkeep');
      if (!fs.existsSync(gk)) fs.writeFileSync(gk, '', 'utf-8');
    }
    return appDir;
  }

  getNextVersion(appDir: string, docType: DocumentType): number {
    const td = this.typeDirPath(appDir, docType);
    let max = 0;
    if (fs.existsSync(td)) {
      for (const f of fs.readdirSync(td)) {
        const m = f.match(new RegExp(`^(resume|cover-letter)-v(\\d+)\\.tex$`));
        if (m && parseInt(m[2], 10) > max) max = parseInt(m[2], 10);
      }
    }
    return max + 1;
  }

  versionedNames(docType: DocumentType, version: number): { tex: string; pdf: string } {
    const base = docType === 'RESUME' ? 'resume' : 'cover-letter';
    return {
      tex: `${base}-v${String(version).padStart(3, '0')}.tex`,
      pdf: `${base}-v${String(version).padStart(3, '0')}.pdf`,
    };
  }

  writeTexFile(typeDir: string, filename: string, content: string): string {
    const target = this.validatePath(path.join(typeDir, filename));
    const tmp = target + '.tmp.' + crypto.randomUUID().substring(0, 8);
    try {
      fs.writeFileSync(tmp, content, 'utf-8');
      fs.renameSync(tmp, target);
      return target;
    } catch (err: any) {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
      throw new Error(`Failed to write .tex: ${err.message}`);
    }
  }

  publishPdf(typeDir: string, filename: string, builtPdfPath: string): string {
    const target = this.validatePath(path.join(typeDir, filename));
    if (!fs.existsSync(builtPdfPath)) throw new Error(`Built PDF not found: ${builtPdfPath}`);
    if (fs.existsSync(target)) {
      fs.renameSync(target, target + '.bak.' + Date.now());
    }
    fs.copyFileSync(builtPdfPath, target);
    return target;
  }

  createDocument(params: {
    sessionId: string;
    documentType: DocumentType;
    outputDir: string;
    careerProfileId?: string | null;
    careerProfileVersion?: string | null;
    instructionSummary?: string | null;
    previousArtifactId?: string | null;
    revisionReason?: string | null;
  }): GeneratedDocument {
    const now = new Date().toISOString();
    const actualVersion = this.getNextVersion(params.outputDir, params.documentType);
    const doc: GeneratedDocument = GeneratedDocumentSchema.parse({
      artifactId: crypto.randomUUID(),
      sessionId: params.sessionId,
      documentType: params.documentType,
      version: actualVersion,
      careerProfileId: params.careerProfileId || null,
      careerProfileVersion: params.careerProfileVersion || null,
      createdAt: now, updatedAt: now,
      status: 'CONTENT_GENERATED',
      texPath: null, pdfPath: null,
      outputDir: params.outputDir,
      instructionSummary: params.instructionSummary || null,
      previousArtifactId: params.previousArtifactId || null,
      errorMessage: null, errorDetails: null,
      revisionReason: params.revisionReason || null,
    });
    this.appendToLog(doc);
    return doc;
  }

  updateDocument(artifactId: string, updates: {
    status?: DocumentStatus; texPath?: string | null; pdfPath?: string | null;
    errorMessage?: string | null; errorDetails?: string | null;
  }): GeneratedDocument {
    const all = this.listAllDocuments();
    const existing = all.find(d => d.artifactId === artifactId);
    if (!existing) throw new Error(`Document '${artifactId}' not found.`);
    const updated: GeneratedDocument = {
      ...existing,
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.texPath !== undefined ? { texPath: updates.texPath } : {}),
      ...(updates.pdfPath !== undefined ? { pdfPath: updates.pdfPath } : {}),
      ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
      ...(updates.errorDetails !== undefined ? { errorDetails: updates.errorDetails } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.appendToLog(updated);
    return updated;
  }

  listSessionDocuments(sessionId: string): GeneratedDocumentListItem[] {
    return this.listAllDocuments()
      .filter(d => d.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(d => ({
        artifactId: d.artifactId, sessionId: d.sessionId, documentType: d.documentType,
        version: d.version, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt,
        careerProfileId: d.careerProfileId, instructionSummary: d.instructionSummary,
        revisionReason: d.revisionReason,
        pdfAvailable: !!(d.pdfPath && fs.existsSync(d.pdfPath)),
        errorMessage: d.errorMessage,
      }));
  }

  getDocument(artifactId: string): GeneratedDocument | null {
    return this.listAllDocuments().find(d => d.artifactId === artifactId) || null;
  }

  getLatestDocument(sessionId: string, docType: DocumentType): GeneratedDocument | null {
    return this.listAllDocuments()
      .filter(d => d.sessionId === sessionId && d.documentType === docType)
      .sort((a, b) => b.version - a.version)[0] || null;
  }

  getGeneratedDir(): string { return path.resolve(this.generatedDir); }

  resolvePdfPath(pdfPath: string | null): string | null {
    if (!pdfPath) return null;
    try { const r = this.validatePath(pdfPath); if (fs.existsSync(r)) return r; } catch {}
    return null;
  }

  // ── Persistence: append-only JSONL log ──

  private logPath(): string {
    if (!fs.existsSync(this.generatedDir)) fs.mkdirSync(this.generatedDir, { recursive: true });
    return path.join(this.generatedDir, 'generation-log.jsonl');
  }

  private appendToLog(doc: GeneratedDocument): void {
    fs.appendFileSync(this.logPath(), JSON.stringify(doc) + '\n', 'utf-8');
  }

  private listAllDocuments(): GeneratedDocument[] {
    const lp = this.logPath();
    if (!fs.existsSync(lp)) return [];
    const docs: GeneratedDocument[] = [];
    for (const line of fs.readFileSync(lp, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try { docs.push(GeneratedDocumentSchema.parse(JSON.parse(line))); }
      catch (e) { console.warn('[document-store] skipping corrupted log line:', (e as Error).message); }
    }
    return docs;
  }
}