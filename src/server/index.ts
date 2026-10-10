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
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
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


      sendJson(404, { error: 'Route not found' });
    } catch (err: any) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  });

  return {
    server,
    listen: () => {
      return new Promise<void>((resolve) => {
        server.listen(port, host, () => {
          console.log(`\n🧠 Jobby Career Brain UI running at: http://${host}:${port}/\n`);
          resolve();
        });
      });
    },
    close: () => {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

