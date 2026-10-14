import { ProfileStorage } from './storage.js';
import { DocumentStore } from './document-store.js';
import { TrackerEntry, TrackerStatus, isValidTrackerTransition } from '../types/application-tracker.js';
import { serializeCsv } from './csv-writer.js';
import { ApplicationSession } from '../types/application-session.js';

/**
 * Tracker state is persisted in JobContextOverrides — part of the session JSON blob.
 * Uses existing session persistence (SQLite + JSON). No new tables or log files.
 */
export class TrackerService {
  private storage: ProfileStorage;
  private documentStore: DocumentStore;

  constructor(storage: ProfileStorage, documentStore: DocumentStore) {
    this.storage = storage;
    this.documentStore = documentStore;
  }

  private getState(session: ApplicationSession): { status: TrackerStatus; dateApplied: string | null; notes: string | null } {
    const ov = session.jobContextOverrides || {};
    return { status: (ov.trackerStatus as TrackerStatus) || 'DRAFT', dateApplied: ov.dateApplied || null, notes: ov.trackerNotes || ov.notes || null };
  }

  private saveState(sid: string, updates: Record<string, any>): ApplicationSession {
    const session = this.storage.getSession(sid);
    if (!session) throw new Error(`Session '${sid}' not found.`);
    const existing = session.jobContextOverrides || {};
    const merged = { ...existing, ...updates };
    // Clean undefined values that shouldn't overwrite existing keys
    for (const key of Object.keys(merged)) {
      if (merged[key] === undefined) delete merged[key];
    }
    const updated: ApplicationSession = {
      ...session,
      jobContextOverrides: Object.keys(merged).length ? merged : null,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    this.storage.saveSession(updated);
    return updated;
  }

  getOrCreate(sessionId: string): { session: ApplicationSession; status: TrackerStatus; dateApplied: string | null; notes: string | null } {
    const session = this.storage.getSession(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    const state = this.getState(session);
    if (!session.jobContextOverrides?.trackerStatus) { this.saveState(sessionId, { trackerStatus: 'DRAFT' }); state.status = 'DRAFT'; }
    return { session, ...state };
  }

  updateStatus(sessionId: string, newStatus: TrackerStatus): TrackerEntry {
    const { session, status } = this.getOrCreate(sessionId);
    if (!isValidTrackerTransition(status, newStatus)) throw new Error(`Invalid transition: ${status} → ${newStatus}`);
    const s = this.saveState(sessionId, { trackerStatus: newStatus });
    return this.buildEntry(s, { status: newStatus, dateApplied: null, notes: null });
  }

  markApplied(sessionId: string, appliedDate?: string): TrackerEntry {
    const { session, dateApplied } = this.getOrCreate(sessionId);
    const now = new Date().toISOString().slice(0, 10);
    const newDate = appliedDate || (dateApplied || now);
    const s = this.saveState(sessionId, {
      trackerStatus: 'APPLIED',
      dateApplied: dateApplied ? undefined : newDate,
    });
    return this.buildEntry(s, { status: 'APPLIED', dateApplied: newDate, notes: null });
  }

  updateAppliedDate(sessionId: string, newDate: string): TrackerEntry {
    const { session, status } = this.getOrCreate(sessionId);
    if (status === 'DRAFT') throw new Error('Cannot set date on DRAFT. Mark APPLIED first.');
    const s = this.saveState(sessionId, { dateApplied: newDate });
    return this.buildEntry(s, { status, dateApplied: newDate, notes: null });
  }

  updateNotes(sessionId: string, notes: string): TrackerEntry {
    const { session, status, dateApplied } = this.getOrCreate(sessionId);
    const s = this.saveState(sessionId, { trackerNotes: notes });
    return this.buildEntry(s, { status, dateApplied, notes });
  }

  buildEntry(session: ApplicationSession, state?: { status?: TrackerStatus; dateApplied?: string | null; notes?: string | null }): TrackerEntry {
    const s = state || this.getState(session);
    const effective = session.jobContextSnapshot;
    const ov = session.jobContextOverrides;
    const company = ov?.companyName || effective.companyName;
    const role = ov?.roleTitle || effective.roleTitle;
    const rDoc = this.documentStore.getLatestDocument(session.id, 'RESUME');
    const cDoc = this.documentStore.getLatestDocument(session.id, 'COVER_LETTER');
    let cpName: string | null = null;
    if (session.selectedCareerProfileId) { const cp = this.storage.getCareerProfile(session.selectedCareerProfileId); cpName = cp?.name || null; }
    return {
      trackerId: session.id, sessionId: session.id, sessionStatus: session.status,
      company, role, sourceUrl: session.sourceJobUrl, applicationUrl: session.applicationUrl,
      trackerStatus: s.status || 'DRAFT', dateStarted: session.createdAt,
      dateApplied: s.dateApplied || null, notes: s.notes || null,
      careerProfileId: session.selectedCareerProfileId, careerProfileName: cpName,
      resumeArtifactId: rDoc?.artifactId || null, resumeVersion: rDoc?.version || null, resumePdfAvailable: !!(rDoc?.pdfPath),
      coverLetterArtifactId: cDoc?.artifactId || null, coverLetterVersion: cDoc?.version || null, coverLetterPdfAvailable: !!(cDoc?.pdfPath),
      createdAt: session.createdAt, updatedAt: session.updatedAt,
    };
  }

  listTrackerEntries(status?: TrackerStatus): TrackerEntry[] {
    const sessions = this.storage.listSessions();
    const entries = sessions.map(s => this.buildEntry(s));
    if (status) return entries.filter(e => e.trackerStatus === status);
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
/** Export all tracker entries as a UTF-8 CSV string with BOM for Excel. */
  exportCsv(): string {
    const entries = this.listTrackerEntries(); // unfiltered — all entries
    const headers = [
      'Application ID', 'Session ID', 'Company', 'Role', 'Tracker Status',
      'Date Started', 'Date Applied', 'Source Job URL', 'Application URL',
      'Career Profile', 'Resume PDF Path', 'Cover Letter PDF Path', 'Notes',
      'Created At', 'Updated At',
    ];

    const rows = entries.map(e => ({
      'Application ID': e.trackerId,
      'Session ID': e.sessionId,
      'Company': e.company,
      'Role': e.role,
      'Tracker Status': e.trackerStatus,
      'Date Started': e.dateStarted,
      'Date Applied': e.dateApplied ?? '',
      'Source Job URL': e.sourceUrl,
      'Application URL': e.applicationUrl ?? '',
      'Career Profile': e.careerProfileName ?? '',
      'Resume PDF Path': e.resumePdfAvailable && e.resumeArtifactId
        ? `resume-v${e.resumeVersion}.pdf` : '',
      'Cover Letter PDF Path': e.coverLetterPdfAvailable && e.coverLetterArtifactId
        ? `cover-letter-v${e.coverLetterVersion}.pdf` : '',
      'Notes': e.notes ?? '',
      'Created At': e.createdAt,
      'Updated At': e.updatedAt,
    }));

    return serializeCsv(headers, rows);
  }
}