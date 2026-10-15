import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProfileStorage } from '../core/storage.js';
import { MasterProfileSchema, MasterProfile } from '../types/master-profile.js';
import { CareerProfileSchema } from '../types/career-profile.js';
import { SavedAnswerItemSchema } from '../types/answer-bank.js';
import { SkillIntelligenceService } from '../core/skill-intelligence.js';
import { sanitizeProfileForExport } from '../core/profile-sanitizer.js';
import { seedInitialAnswerBank } from '../core/answer-bank-seed.js';
import { ApplicationSessionService } from '../core/session-service.js';
import { JobPageDetector } from '../extractor/page-detector.js';
import { ContentExtractor } from '../extractor/content-extractor.js';
import { parseHtmlToDocument } from '../extractor/sources/base-source.js';
import { ResumeGenerator } from '../core/resume-generator.js';
import { TrackerService } from '../core/tracker-service.js';
import { CoverLetterGenerator } from '../core/cover-letter-generator.js';
import { detectCompiler } from '../core/pdf-compiler.js';
import { DocumentStore } from '../core/document-store.js';
import { JobParser } from '../core/job-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  storage?: ProfileStorage;
}

export function createCareerBrainServer(options: ServerOptions = {}) {
  const port = options.port || 3141;
  const host = options.host || '127.0.0.1';
  const storage = options.storage || new ProfileStorage();
  const skillIntelligence = new SkillIntelligenceService();
  const documentStore = new DocumentStore(storage);
  const trackerService = new TrackerService(storage, documentStore);
  const sessionService = new ApplicationSessionService(storage, trackerService);
  const resumeGenerator = new ResumeGenerator(storage, documentStore);
  const coverLetterGenerator = new CoverLetterGenerator(storage, documentStore);

  // Phase 8: Startup validation (warn, don't block)
  const compiler = detectCompiler();
  if (!compiler.available) console.warn('[startup] pdflatex not found — PDF generation will fail. Install TeX Live or MiKTeX.');
  try { fs.accessSync(documentStore.getGeneratedDir(), fs.constants.W_OK); } catch { console.warn(`[startup] Generated directory not writable: ${documentStore.getGeneratedDir()}`); }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey || openRouterKey === 'your_openrouter_api_key_here') console.warn('[startup] OPENROUTER_API_KEY not set — AI features unavailable.');

  // Ensure answer bank has baseline facts if empty
  seedInitialAnswerBank(storage);

  const server = http.createServer(async (req, res) => {
    // CORS headers for local access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      // 1. Serve UI Single Page App
      const findUiFile = (filename: string): string | null => {
        const candidate1 = path.resolve(__dirname, '../ui', filename);
        if (fs.existsSync(candidate1)) return candidate1;
        const candidate2 = path.resolve(process.cwd(), 'src/ui', filename);
        if (fs.existsSync(candidate2)) return candidate2;
        return null;
      };

      if (pathname === '/' || pathname === '/index.html') {
        const uiHtmlPath = findUiFile('index.html');
        if (uiHtmlPath) {
          const html = fs.readFileSync(uiHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('UI html not found');
          return;
        }
      }

      if (pathname === '/styles.css') {
        const cssPath = findUiFile('styles.css');
        if (cssPath) {
          const css = fs.readFileSync(cssPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
          res.end(css);
          return;
        }
      }

      if (pathname === '/app.js') {
        const jsPath = findUiFile('app.js');
        if (jsPath) {
          const js = fs.readFileSync(jsPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(js);
          return;
        }
      }

      const readBodyJson = async (): Promise<any> => {
        const MAX_BODY = 5 * 1024 * 1024; // 5MB limit
        const hdr = req.headers['content-length'];
        if (hdr && parseInt(hdr, 10) > MAX_BODY) {
          reject(new Error('Request body too large'));
          return;
        }
        return new Promise((resolve, reject) => {
          let body = '';
          let size = 0;
          req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY) {
              req.destroy();
              reject(new Error('Request body too large'));
              return;
            }
            body += chunk.toString('utf-8');
          });
          req.on('end', () => {
            if (!body) resolve({});
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        });
      };

      const sendJson = (statusCode: number, data: any) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data, null, 2));
      };

      // 2. REST API ROUTES: Master Profile
      if (pathname === '/api/master-profile' && req.method === 'GET') {
        const master = storage.getMasterProfile();
        if (!master) {
          sendJson(404, { error: 'Master profile not found' });
          return;
        }
        sendJson(200, sanitizeProfileForExport(master));
        return;
      }

      if (pathname === '/api/master-profile' && req.method === 'PUT') {
        const body = await readBodyJson();
        const validated = MasterProfileSchema.parse(body);
        storage.saveMasterProfile(validated, 'Edited via Career Brain UI');
        sendJson(200, { success: true, profile: sanitizeProfileForExport(validated) });
        return;
      }

      // Career Profiles
      if (pathname === '/api/career-profiles' && req.method === 'GET') {
        const profiles = storage.getCareerProfiles();
        sendJson(200, profiles);
        return;
      }

      if (pathname.startsWith('/api/career-profiles/') && req.method === 'PUT') {
        const id = pathname.replace('/api/career-profiles/', '');
        const body = await readBodyJson();
        body.id = id;
        const validated = CareerProfileSchema.parse(body);
        storage.saveCareerProfile(validated);
        sendJson(200, { success: true, profile: validated });
        return;
      }

      // Skill Intelligence
      if (pathname === '/api/skill-intelligence' && req.method === 'GET') {
        const master = storage.getMasterProfile();
        if (!master) {
          sendJson(404, { error: 'Master profile not found' });
          return;
        }
        const registry = skillIntelligence.buildRegistry(master);
        const inferredPending = await skillIntelligence.discoverInferredSkills(master, {
          useSemanticAI: false,
        });

        sendJson(200, { registry, inferredPending });
        return;
      }

      if (pathname === '/api/skill-intelligence/approve' && req.method === 'POST') {
        const master = storage.getMasterProfile();
        if (!master) {
          sendJson(404, { error: 'Master profile not found' });
          return;
        }
        const body = await readBodyJson();
        const { suggestion, userNotes } = body;
        const { updatedMaster, newSkill } = skillIntelligence.approveInferredSkill(
          master,
          suggestion,
          userNotes
        );
        storage.saveMasterProfile(updatedMaster, `Approved inferred skill: ${newSkill.name}`);
        sendJson(200, { success: true, skill: newSkill });
        return;
      }

      if (pathname === '/api/skill-intelligence/update-status' && req.method === 'POST') {
        const master = storage.getMasterProfile();
        if (!master) {
          sendJson(404, { error: 'Master profile not found' });
          return;
        }
        const { skillId, newStatus, reason } = await readBodyJson();
        const skillIndex = master.skills.findIndex((s) => s.id === skillId);
        if (skillIndex === -1) {
          sendJson(404, { error: 'Skill not found' });
          return;
        }

        master.skills[skillIndex].status = newStatus;
        if (reason) {
          master.skills[skillIndex].provenance.notes = reason;
        }
        master.lastUpdated = new Date().toISOString();
        storage.saveMasterProfile(master, `Updated skill status for ${master.skills[skillIndex].name}`);
        sendJson(200, { success: true, skill: master.skills[skillIndex] });
        return;
      }

      // Answer Bank
      if (pathname === '/api/answer-bank' && req.method === 'GET') {
        const items = storage.getAnswerBankItems();
        sendJson(200, items);
        return;
      }

      if (pathname === '/api/answer-bank' && req.method === 'POST') {
        const body = await readBodyJson();
        const validated = SavedAnswerItemSchema.parse(body);
        storage.saveAnswerBankItem(validated);
        sendJson(200, { success: true, item: validated });
        return;
      }

      if (pathname.startsWith('/api/answer-bank/') && req.method === 'PUT') {
        const id = pathname.replace('/api/answer-bank/', '');
        const body = await readBodyJson();
        body.id = id;
        body.updatedAt = new Date().toISOString();
        const validated = SavedAnswerItemSchema.parse(body);
        storage.saveAnswerBankItem(validated);
        sendJson(200, { success: true, item: validated });
        return;
      }

      // Export & Import
      if (pathname === '/api/export' && req.method === 'GET') {
        const master = storage.getMasterProfile();
        if (!master) {
          sendJson(404, { error: 'Master profile not found' });
          return;
        }
        const sanitized = sanitizeProfileForExport(master);
        const exportData = {
          exportTimestamp: new Date().toISOString(),
          version: sanitized.schemaVersion,
          masterProfile: sanitized,
          careerProfiles: storage.getCareerProfiles(),
          answerBank: storage.getAnswerBankItems(),
        };

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="jobby-career-brain-${new Date().toISOString().slice(0, 10)}.json"`,
        });
        res.end(JSON.stringify(exportData, null, 2));
        return;
      }

      if (pathname === '/api/import' && req.method === 'POST') {
        const body = await readBodyJson();
        if (!body.masterProfile && !body.personal) {
          sendJson(400, { error: 'Invalid import format. Expected profile data.' });
          return;
        }

        const rawMaster = body.masterProfile || body;
        const validatedMaster = MasterProfileSchema.parse(rawMaster);
        const sanitized = sanitizeProfileForExport(validatedMaster);
        storage.saveMasterProfile(sanitized, 'Imported profile data');

        if (Array.isArray(body.careerProfiles)) {
          for (const cp of body.careerProfiles) {
            try {
              const validatedCp = CareerProfileSchema.parse(cp);
              storage.saveCareerProfile(validatedCp);
            } catch {
              // ignore invalid profile
            }
          }
        }

        if (Array.isArray(body.answerBank)) {
          for (const item of body.answerBank) {
            try {
              const validatedItem = SavedAnswerItemSchema.parse(item);
              storage.saveAnswerBankItem(validatedItem);
            } catch {
              // ignore invalid item
            }
          }
        }

        sendJson(200, { success: true, message: 'Profile imported successfully' });
        return;
      }
      // Profile History & Versioning
      if (pathname === '/api/history' && req.method === 'GET') {
        const profileId = url.searchParams.get('profileId') || undefined;
        const history = storage.getProfileHistory(profileId);
        sendJson(200, history);
        return;
      }

      // Rollback to specific version
      if (pathname.startsWith('/api/history/rollback/') && req.method === 'POST') {
        const idStr = pathname.replace('/api/history/rollback/', '');
        const historyId = parseInt(idStr, 10);
        if (isNaN(historyId)) {
          sendJson(400, { error: 'Invalid history entry id' });
          return;
        }

        const body = await readBodyJson();
        const reason = body?.reason || `User triggered rollback via UI to history #${historyId}`;
        const restored = storage.rollbackMasterProfile(historyId, reason);
        sendJson(200, { success: true, profile: sanitizeProfileForExport(restored) });
        return;
      }


      // Application Sessions — detect page
      if (pathname === '/api/sessions/detect' && req.method === 'POST') {
        const body = await readBodyJson();
        const { html, url: pageUrl } = body;
        if (!html || !pageUrl) {
          sendJson(400, { error: 'html and url are required' });
          return;
        }
        const context = parseHtmlToDocument(html, pageUrl);
        const detection = new JobPageDetector().detect(context);
        const rawContent = new ContentExtractor().extract(context);
        // Extract best preview fields from detection + rawContent
        let company = detection.detectedCompany || '';
        let roleTitle = detection.detectedJobTitle || '';
        if (!company) {
          company = rawContent.structuredMetadata?.['og:site_name'] || '';
        }
        // Fallback: parse page title for "Role | Company | LinkedIn" pattern
        if ((!company || !roleTitle) && rawContent.title) {
          const parts = rawContent.title.split('|').map((s: string) => s.trim());
          const last = parts[parts.length - 1] || '';
          if (last === 'LinkedIn' || last === 'LinkedIn' || last.includes('LinkedIn')) {
            if (!roleTitle && parts[0]) roleTitle = parts[0];
            if (!company && parts.length >= 3 && parts[1]) company = parts[1];
          }
        }
        if (!roleTitle) {
          for (const item of rawContent.jsonLd) {
            if (item.title && typeof item.title === 'string') { roleTitle = item.title.trim(); break; }
          }
        }
        if (!roleTitle) roleTitle = rawContent.title || '';
        const warnings: string[] = [];
        if (!company) warnings.push('Company could not be detected');
        if (!roleTitle || roleTitle === rawContent.title) warnings.push('Role title may not be accurate');
        sendJson(200, {
          detection: { isJobPage: detection.isJobPage, confidence: detection.confidence, source: detection.source, reason: detection.reason },
          preview: { company, roleTitle, location: detection.reason || '', remoteStatus: 'unknown', sourceUrl: pageUrl },
          warnings
        });
        return;
      }

      // Application Sessions — start
      if (pathname === '/api/sessions/start' && req.method === 'POST') {
        const body = await readBodyJson();
        const result = await sessionService.startApplicationFromJob({
          pagePayload: body.pagePayload || undefined,
          jobId: body.jobId || undefined,
          manualContext: body.manualContext || undefined,
          preferredCareerProfileId: body.preferredCareerProfileId || undefined,
        });
        sendJson(200, result);
        return;
      }

      // Application Sessions — list
      if (pathname === '/api/sessions' && req.method === 'GET') {
        const statusFilter = url.searchParams.get('status') as any || undefined;
        const jobIdFilter = url.searchParams.get('jobId') || undefined;
        const sessions = sessionService.listRecentSessions(jobIdFilter || statusFilter ? { status: statusFilter, jobId: jobIdFilter } : undefined);
        sendJson(200, sessions);
        return;
      }

      // Application Sessions — get by id
      if (pathname.startsWith('/api/sessions/') && req.method === 'GET') {
        const id = pathname.replace('/api/sessions/', '');
        if (!id || id.includes('/')) { sendJson(404, { error: 'Not found' }); return; }
        const session = sessionService.getSessionById(id);
        if (!session) { sendJson(404, { error: 'Session not found' }); return; }
        sendJson(200, session);
        return;
      }

      // Application Sessions — associate page
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/associate') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/associate', '');
        const body = await readBodyJson();
        const { url: pageUrl, pageType, title } = body;
        if (!pageUrl || !pageType) {
          sendJson(400, { error: 'url and pageType are required' });
          return;
        }
        const updated = sessionService.attachPageToSession(id, { url: pageUrl, pageType, title });
        sendJson(200, { success: true, session: updated });
        return;
      }

      // Application Sessions — update status
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/status') && req.method === 'PUT') {
        const id = pathname.replace('/api/sessions/', '').replace('/status', '');
        const body = await readBodyJson();
        if (!body.status) { sendJson(400, { error: 'status is required' }); return; }
        const updated = sessionService.updateSessionStatus(id, body.status);
        sendJson(200, { success: true, session: updated });
        return;
      }

      // Application Sessions — update context (overrides)
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/context') && req.method === 'PUT') {
        const id = pathname.replace('/api/sessions/', '').replace('/context', '');
        const body = await readBodyJson();
        const updated = sessionService.updateSessionJobContext(id, body);
        sendJson(200, { success: true, session: updated });
        return;
      }


      // Application Sessions — get effective context (merged snapshot + overrides)
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/effective-context') && req.method === 'GET') {
        const id = pathname.replace('/api/sessions/', '').replace('/effective-context', '');
        const ctx = sessionService.getEffectiveContext(id);
        sendJson(200, ctx);
        return;
      }

      // Application Sessions — set career profile
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/career-profile') && req.method === 'PUT') {
        const id = pathname.replace('/api/sessions/', '').replace('/career-profile', '');
        const body = await readBodyJson();
        const updated = sessionService.setCareerProfile(id, body.careerProfileId, body.profileVersion, body.selectionSource || 'manual');
        sendJson(200, { success: true, session: updated });
        return;
      }


      // Application Sessions — classify fields (Phase 5)
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/classify-fields') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/classify-fields', '');
        const session = sessionService.getSessionById(id);
        if (!session) { sendJson(404, { error: 'Session not found' }); return; }
        const body = await readBodyJson();
        if (!body.fields || !Array.isArray(body.fields)) { sendJson(400, { error: 'fields array required' }); return; }
        const master = storage.getMasterProfile();
        if (!master) { sendJson(400, { error: 'Master profile not found' }); return; }
        let careerProfile = null;
        if (session.selectedCareerProfileId) careerProfile = storage.getCareerProfile(session.selectedCareerProfileId);
        const savedAnswers = storage.getAnswerBankItems();
        const skillIntel = new SkillIntelligenceService();
        const skillRegistry = skillIntel.buildRegistry(master);
        const { classifyFields } = await import('../core/field-resolver.js');
        const result = classifyFields({ fields: body.fields, master, careerProfile, savedAnswers, skillRegistry });
        sendJson(200, result);
        return;
      }

      // Application Sessions — generate narrative answers (Phase 5)
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/generate-narratives') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/generate-narratives', '');
        const session = sessionService.getSessionById(id);
        if (!session) { sendJson(404, { error: 'Session not found' }); return; }
        const body = await readBodyJson();
        if (!body.fields || !Array.isArray(body.fields)) { sendJson(400, { error: 'fields array required' }); return; }
        const master = storage.getMasterProfile();
        if (!master) { sendJson(400, { error: 'Master profile not found' }); return; }
        let careerProfile = null;
        if (session.selectedCareerProfileId) careerProfile = storage.getCareerProfile(session.selectedCareerProfileId);
        const savedAnswers = storage.getAnswerBankItems();
        const skillIntel = new SkillIntelligenceService();
        const skillRegistry = skillIntel.buildRegistry(master);
        const { generateNarrativeAnswers } = await import('../core/narrative-generator.js');
        const result = await generateNarrativeAnswers({
          fields: body.fields,
          context: {
            master,
            careerProfile,
            jobContext: session.jobContextSnapshot,
            answerBank: savedAnswers,
            skillRegistry,
          },
        });
        sendJson(200, result);
        return;
      }


      // Serve .tex source by artifact ID
      if (pathname.startsWith('/api/documents/') && pathname.endsWith('/tex') && req.method === 'GET') {
        const artifactId = pathname.replace('/api/documents/', '').replace('/tex', '');
        const doc = documentStore.getDocument(artifactId);
        if (!doc || !doc.texPath) { sendJson(404, { error: 'Source not available' }); return; }
        const resolved = path.resolve(doc.texPath);
        if (!resolved.startsWith(path.resolve(documentStore.getGeneratedDir()))) { sendJson(403, { error: 'Access denied' }); return; }
        if (!fs.existsSync(resolved)) { sendJson(404, { error: 'Source file not found' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(fs.readFileSync(resolved));
        return;
      }


      // Serve PDF by artifact ID
      if (pathname.startsWith('/api/documents/') && pathname.endsWith('/pdf') && req.method === 'GET') {
        const artifactId = pathname.replace('/api/documents/', '').replace('/pdf', '');
        const doc = documentStore.getDocument(artifactId);
        if (!doc || !doc.pdfPath) { sendJson(404, { error: 'PDF not available' }); return; }
        const resolved = path.resolve(doc.pdfPath);
        if (!resolved.startsWith(path.resolve(documentStore.getGeneratedDir()))) { sendJson(403, { error: 'Access denied' }); return; }
        if (!fs.existsSync(resolved)) { sendJson(404, { error: 'PDF file not found' }); return; }
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${path.basename(resolved)}"` });
        res.end(fs.readFileSync(resolved));
        return;
      }


      // ── Phase 6: Document Generation ──────────────────────
      function findFileRecursive(dir, filename) {
  try {
    const entries = require('fs').readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = findFileRecursive(require('path').join(dir, e.name), filename);
        if (found) return found;
      } else if (e.name === filename) {
        return require('path').join(dir, e.name);
      }
    }
  } catch {}
  return null;
}

      // Serve generated PDF files
      if (pathname.startsWith('/api/generated/') && req.method === 'GET') {
        const relativePath = decodeURIComponent(pathname.replace('/api/generated/', ''));
        const filePath = path.resolve(documentStore.getGeneratedDir(), relativePath);
        if (!filePath.startsWith(path.resolve(documentStore.getGeneratedDir()))) { sendJson(403, { error: 'Access denied' }); return; }
        let actualPath = filePath;
        if (!fs.existsSync(filePath) && !relativePath.includes('/') && !relativePath.includes('\\')) {
          const found = findFileRecursive(documentStore.getGeneratedDir(), relativePath);
          if (found) actualPath = found;
        }
        if (!fs.existsSync(actualPath)) { sendJson(404, { error: 'File not found' }); return; }
        const ext = path.extname(actualPath).toLowerCase();
        const mime = ext === '.pdf' ? 'application/pdf' : ext === '.tex' ? 'text/plain; charset=utf-8' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Content-Disposition': `inline; filename="${path.basename(actualPath)}"` });
        res.end(fs.readFileSync(actualPath));
        return;
      }

      // List documents for a session
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/documents') && req.method === 'GET') {
        const id = pathname.replace('/api/sessions/', '').replace('/documents', '');
        const docs = documentStore.listSessionDocuments(id);
        sendJson(200, docs);
        return;
      }

      // Get single document full metadata (backend-only paths)
      if (pathname.startsWith('/api/documents/') && !pathname.includes('/sessions/') && req.method === 'GET') {
        const artifactId = pathname.replace('/api/documents/', '');
        const doc = documentStore.getDocument(artifactId);
        if (!doc) { sendJson(404, { error: 'Document not found' }); return; }
        sendJson(200, doc);
        return;
      }

      // Reserve / initialize document artifact for a session
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/documents/init') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/documents/init', '');
        const session = sessionService.getSessionById(id);
        if (!session) { sendJson(404, { error: 'Session not found' }); return; }
        const body = await readBodyJson();
        const docType = body.documentType === 'COVER_LETTER' ? 'COVER_LETTER' : 'RESUME';
        const company = session.jobContextSnapshot?.companyName || '';
        const role = session.jobContextSnapshot?.roleTitle || '';
        const appDir = documentStore.ensureAppDir(id, company, role);
        const careerProfileId = session.selectedCareerProfileId;
        const careerProfile = careerProfileId ? storage.getCareerProfile(careerProfileId) : null;
        const doc = documentStore.createDocument({
          sessionId: id, documentType: docType, outputDir: appDir,
          careerProfileId, careerProfileVersion: session.selectedCareerProfileVersion,
          instructionSummary: careerProfile
            ? (docType === 'RESUME' ? careerProfile.customResumeInstructions : careerProfile.customCoverLetterInstructions)
            : null,
          previousArtifactId: body.previousArtifactId || null,
          revisionReason: body.revisionReason || null,
        });
        sendJson(201, doc);
        return;
      }

      // Update document status after .tex write or PDF compile
      if (pathname.startsWith('/api/documents/') && pathname.endsWith('/status') && req.method === 'PUT') {
        const artifactId = pathname.replace('/api/documents/', '').replace('/status', '');
        const body = await readBodyJson();
        const updated = documentStore.updateDocument(artifactId, {
          status: body.status, texPath: body.texPath, pdfPath: body.pdfPath,
          errorMessage: body.errorMessage, errorDetails: body.errorDetails,
        });
        sendJson(200, updated);
        return;
      }

      // Reveal generated folder path (for local backend)
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/documents/open-dir') && req.method === 'GET') {
        const id = pathname.replace('/api/sessions/', '').replace('/documents/open-dir', '');
        const session = sessionService.getSessionById(id);
        if (!session) { sendJson(404, { error: 'Session not found' }); return; }
        const company = session.jobContextSnapshot?.companyName || '';
        const role = session.jobContextSnapshot?.roleTitle || '';
        const appDir = documentStore.ensureAppDir(id, company, role);
        sendJson(200, { path: path.resolve(appDir) });
        return;
      }


      // ── Phase 6: Compiler Detection ──────────────────────
      if (pathname === '/api/compiler/status' && req.method === 'GET') {
        const info = detectCompiler();
        sendJson(200, info);
        return;
      }


      // ── Phase 6: Cover Letter Generation ────────────────
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/generate-cover-letter') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/generate-cover-letter', '');
        const result = await coverLetterGenerator.generateCoverLetter(id);
        if (result.pdfPath) {
          (result as any).relativePdfPath = path.relative(documentStore.getGeneratedDir(), result.pdfPath);
        }
        sendJson(result.success ? 200 : 422, result);
        return;
      }
// ── Phase 6: Resume Generation ──────────────────────
      if (pathname.startsWith('/api/sessions/') && pathname.endsWith('/generate-resume') && req.method === 'POST') {
        const id = pathname.replace('/api/sessions/', '').replace('/generate-resume', '');
        const result = await resumeGenerator.generateResume(id);
        if (result.pdfPath) {
          (result as any).relativePdfPath = path.relative(documentStore.getGeneratedDir(), result.pdfPath);
        }
        sendJson(result.success ? 200 : 422, result);
        return;
      }


      // ── Phase 6: Document Revision ──────────────────────
      if (pathname.startsWith('/api/documents/') && pathname.endsWith('/revise') && req.method === 'POST') {
        const artifactId = pathname.replace('/api/documents/', '').replace('/revise', '');
        const body = await readBodyJson();
        const instructions = body.instructions;
        if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
          sendJson(400, { error: 'instructions string required' }); return;
        }
        const doc = documentStore.getDocument(artifactId);
        if (!doc) { sendJson(404, { error: 'Document not found' }); return; }
        let result: any;
        if (doc.documentType === 'RESUME') {
          result = await resumeGenerator.reviseResume(artifactId, instructions.trim());
        } else if (doc.documentType === 'COVER_LETTER') {
          result = await coverLetterGenerator.reviseCoverLetter(artifactId, instructions.trim());
        } else {
          sendJson(400, { error: 'Unsupported document type' }); return;
        }
        sendJson(result.success ? 200 : 422, result);
        return;
      }


      // Export tracker as CSV
      if (pathname === '/api/tracker/export' && req.method === 'GET') {
        const csv = trackerService.exportCsv();
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="application-tracker.csv"',
        });
        res.end(Buffer.from(csv, 'utf-8'));
        return;
      }


      // ── Phase 7: Application Tracker ────────────────────
      // List all tracker entries
      if (pathname === '/api/tracker' && req.method === 'GET') {
        const statusFilter = url.searchParams.get('status') || undefined;
        const entries = trackerService.listTrackerEntries(statusFilter as any);
        sendJson(200, entries);
        return;
      }

      // Update tracker status
      if (pathname.startsWith('/api/tracker/') && pathname.endsWith('/status') && req.method === 'PUT') {
        const sessionId = pathname.replace('/api/tracker/', '').replace('/status', '');
        const body = await readBodyJson();
        if (!body.status) { sendJson(400, { error: 'status required' }); return; }
        try {
          const entry = trackerService.updateStatus(sessionId, body.status);
          sendJson(200, entry);
        } catch (err: any) { sendJson(422, { error: err.message }); }
        return;
      }

      // Mark as applied
      if (pathname.startsWith('/api/tracker/') && pathname.endsWith('/mark-applied') && req.method === 'PUT') {
        const sessionId = pathname.replace('/api/tracker/', '').replace('/mark-applied', '');
        const body = await readBodyJson();
        try {
          const entry = trackerService.markApplied(sessionId, body.dateApplied || undefined);
          sendJson(200, entry);
        } catch (err: any) { sendJson(422, { error: err.message }); }
        return;
      }

      // Update applied date
      if (pathname.startsWith('/api/tracker/') && pathname.endsWith('/applied-date') && req.method === 'PUT') {
        const sessionId = pathname.replace('/api/tracker/', '').replace('/applied-date', '');
        const body = await readBodyJson();
        if (!body.dateApplied) { sendJson(400, { error: 'dateApplied required' }); return; }
        try {
          const entry = trackerService.updateAppliedDate(sessionId, body.dateApplied);
          sendJson(200, entry);
        } catch (err: any) { sendJson(422, { error: err.message }); }
        return;
      }

      // Update notes
      if (pathname.startsWith('/api/tracker/') && pathname.endsWith('/notes') && req.method === 'PUT') {
        const sessionId = pathname.replace('/api/tracker/', '').replace('/notes', '');
        const body = await readBodyJson();
        try {
          const entry = trackerService.updateNotes(sessionId, body.notes || '');
          sendJson(200, entry);
        } catch (err: any) { sendJson(422, { error: err.message }); }
        return;
      }


      sendJson(404, { error: 'Route not found' });
    } catch (err: any) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  return {
    server,
    listen: () => {
      return new Promise<void>((resolve, reject) => {
        server.on('error', (err: any) => reject(err));
        server.listen(port, host, () => {
          console.log('\\n🧠 Jobby Career Brain UI running at: http://' + host + ':' + port + '/\\n');
          resolve();
        });
      });
    },
    close: () => {
      return new Promise<void>((resolve) => {
        try { storage.getDatabase().close(); } catch {}
        server.close(() => resolve());
      });
    },
  };
}

