import crypto from 'node:crypto';
import { ProfileStorage } from './storage.js';
import { CareerProfileSelector } from './profile-selector.js';
import { JobParser, ManualJobContextInput } from './job-parser.js';
import { PageContext, parseHtmlToDocument } from '../extractor/sources/base-source.js';
import { JobPageDetector } from '../extractor/page-detector.js';
import { ContentExtractor } from '../extractor/content-extractor.js';
import {
  ApplicationSession,
  ApplicationSessionStatus,
  AssociatedPage,
  JobContextOverrides,
  JobContextSnapshot,
  JobContextSnapshotSchema,
  PageType,
} from '../types/application-session.js';
import { Job } from '../types/job.js';
import { TrackerService } from './tracker-service.js';
import { normalizeJobUrl } from './job-normalizer.js';

export interface StartApplicationParams {
  job?: Job;
  jobId?: string;
  pagePayload?: {
    url: string;
    html: string;
  };
  manualContext?: ManualJobContextInput;
  preferredCareerProfileId?: string;
}

export interface SessionServiceResult {
  session: ApplicationSession;
  isExisting: boolean;
  warnings: string[];
  /** Phase 7: Tracker status after creation/refresh */
  trackerStatus?: string;
}

export class ApplicationSessionService {
  private storage: ProfileStorage;
  private detector: JobPageDetector;
  private extractor: ContentExtractor;
  private profileSelector: CareerProfileSelector;
  private trackerService: TrackerService | null;

  constructor(storage: ProfileStorage, trackerService?: TrackerService) {
    this.storage = storage;
    this.detector = new JobPageDetector();
    this.extractor = new ContentExtractor();
    this.profileSelector = new CareerProfileSelector();
    this.trackerService = trackerService || null;
  }

  /**
   * Helper to create a JobContextSnapshot from a Job entity.
   */
  public static createSnapshotFromJob(job: Job): JobContextSnapshot {
    return JobContextSnapshotSchema.parse({
      companyName: job.companyName,
      roleTitle: job.title,
      originalSourceUrl: job.sourceUrl,
      companyUrl: job.companyUrl,
      location: job.city && job.country ? `${job.city}, ${job.country}` : job.locations[0] || null,
      remoteStatus: job.remoteStatus,
      description: job.description,
      responsibilities: job.responsibilities,
      requiredQualifications: job.requiredQualifications,
      preferredQualifications: job.preferredQualifications,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      technologies: job.technologies,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      salaryText: job.salaryText,
      employmentType: job.employmentType,
      seniority: job.seniority,
      extractionTimestamp: job.discoveredAt,
      extractionConfidence: job.parserConfidence,
      extractionWarnings: job.extractionWarnings,
      source: job.source,
      parserVersion: job.parserVersion,
    });
  }
  public async startApplicationFromJob(params: StartApplicationParams): Promise<SessionServiceResult> {
    const warnings: string[] = [];
    let job: Job | null = null;
    let rawJobUrl = '';

    if (params.job) {
      job = params.job;
      rawJobUrl = job.sourceUrl;
    } else if (params.jobId) {
      job = this.storage.getJob(params.jobId);
      if (!job) {
        throw new Error(`Job with id '${params.jobId}' not found.`);
      }
      rawJobUrl = job.sourceUrl;
    } else if (params.pagePayload) {
      rawJobUrl = params.pagePayload.url;
      const context = parseHtmlToDocument(params.pagePayload.html, params.pagePayload.url);
      const detection = this.detector.detect(context);

      if (!detection.isJobPage && !params.manualContext) {
        throw new Error(
          `Page '${params.pagePayload.url}' does not appear to contain a valid job posting (${detection.reason}).`
        );
      }

      const rawContent = this.extractor.extract(context);
      const parsed = JobParser.fromRawContent(detection, rawContent, params.manualContext);
      job = parsed.job;
      warnings.push(...parsed.warnings);
    } else if (params.manualContext && params.manualContext.url) {
      rawJobUrl = params.manualContext.url;
    } else {
      throw new Error('Must provide a job, jobId, pagePayload, or manualContext with a URL to start a session.');
    }

    if (job) {
      this.storage.saveJob(job);
    }

    // Check for existing ACTIVE or PAUSED session for this job
    const existingSession = this.getExistingSessionForJob({
      jobId: job?.id,
      jobUrl: rawJobUrl,
    });

    if (existingSession && (existingSession.status === 'ACTIVE' || existingSession.status === 'PAUSED')) {
      const now = new Date().toISOString();
      const touchedSession = this.storage.getSession(existingSession.id);
      if (touchedSession) {
        touchedSession.lastActivityAt = now;
        this.storage.saveSession(touchedSession);

        // Phase 7: Refresh tracker entry (repair if missing, preserve user fields)
        let trackerStatus: string | undefined;
        if (this.trackerService) {
          try {
            const t = this.trackerService.getOrCreate(touchedSession.id);
            trackerStatus = t.status;
          } catch (err: any) {
            warnings.push(`Tracker refresh failed: ${err.message}`);
          }
        }

        return {
          session: touchedSession,
          isExisting: true,
          warnings: ['Resumed existing active application session.'],
          trackerStatus,
        };
      }
    }

    // Snapshot construction
    let snapshot: JobContextSnapshot;
    if (job) {
      snapshot = ApplicationSessionService.createSnapshotFromJob(job);
    } else {
      const manual = params.manualContext!;
      const now = new Date().toISOString();
      snapshot = JobContextSnapshotSchema.parse({
        companyName: manual.companyName || 'Unknown Company',
        roleTitle: manual.title || 'Untitled Position',
        originalSourceUrl: manual.url || rawJobUrl,
        companyUrl: null,
        location: manual.location || null,
        remoteStatus: 'unknown',
        description: manual.description || '',
        responsibilities: [],
        requiredQualifications: [],
        preferredQualifications: [],
        requiredSkills: [],
        preferredSkills: [],
        technologies: [],
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        salaryText: manual.salaryText || null,
        employmentType: manual.employmentType || 'unknown',
        seniority: manual.seniority || 'unknown',
        extractionTimestamp: now,
        extractionConfidence: null,
        extractionWarnings: ['Job context was manually supplied.'],
        source: 'manual',
        parserVersion: null,
      });
    }

    // Pin Master Profile Version
    const master = this.storage.getMasterProfile();
    let masterProfileVersion: number | null = null;
    if (master) {
      const history = this.storage.getProfileHistory(master.id);
      masterProfileVersion = history.length > 0 ? history[0].versionNumber : 1;
    }

    // Select or assign Career Profile
    let selectedCareerProfileId: string | null = params.preferredCareerProfileId || null;
    let selectedCareerProfileVersion: string | null = null;

    if (!selectedCareerProfileId && master) {
      try {
        const careerProfiles = this.storage.getCareerProfiles();
        if (careerProfiles.length > 0) {
          const profileResult = await this.profileSelector.selectProfile(
            master,
            careerProfiles,
            {
              jobTitle: snapshot.roleTitle,
              company: snapshot.companyName,
              jobDescription: snapshot.description,
              requiredSkills: snapshot.requiredSkills,
              preferredSkills: snapshot.preferredSkills,
              responsibilities: snapshot.responsibilities,
              seniority: snapshot.seniority,
              industry: '',
              locationRemoteRequirements: snapshot.location || '',
            },
            { useSemanticAI: false }
          );

          if (profileResult && profileResult.selectedProfileId) {
            selectedCareerProfileId = profileResult.selectedProfileId;
          }
        }
      } catch (err: any) {
        warnings.push(`Automatic profile selection skipped: ${err.message}`);
      }
    }

    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    const initialPage: AssociatedPage = {
      url: snapshot.originalSourceUrl,
      pageType: 'JOB_POSTING',
      attachedAt: now,
      title: snapshot.roleTitle,
    };

    const session: ApplicationSession = {
      id: sessionId,
      jobId: job?.id || null,
      status: 'ACTIVE',
      sourceJobUrl: snapshot.originalSourceUrl,
      applicationUrl: job?.applicationUrl || null,
      associatedPages: [initialPage],
      jobContextSnapshot: snapshot,
      jobContextOverrides: null,
      selectedCareerProfileId,
      selectedCareerProfileVersion,
      careerProfileSelectionSource: selectedCareerProfileId ? 'auto' : null,
      masterProfileVersion,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.storage.saveSession(session);

    // Phase 7: Create draft tracker record for new application
    let trackerStatus: string | undefined;
    if (this.trackerService) {
      try {
        const t = this.trackerService.getOrCreate(session.id);
        trackerStatus = t.status;
      } catch (err: any) {
        warnings.push(`Tracker creation failed: ${err.message}`);
      }
    }

    return {
      session,
      isExisting: false,
      warnings,
      trackerStatus,
    };
  }

  public getSessionById(id: string): ApplicationSession | null {
    return this.storage.getSession(id);
  }

  public listRecentSessions(filter?: { status?: ApplicationSessionStatus; jobId?: string }): ApplicationSession[] {
    return this.storage.listSessions(filter);
  }

  public updateSessionStatus(id: string, newStatus: ApplicationSessionStatus): ApplicationSession {
    return this.storage.updateSessionStatus(id, newStatus);
  }

  public cancelSession(id: string): ApplicationSession {
    return this.storage.updateSessionStatus(id, 'CANCELLED');
  }

  /**
   * Updates user corrections for job context without mutating original captured snapshot.
   */
  public updateSessionJobContext(id: string, overrides: JobContextOverrides): ApplicationSession {
    const session = this.storage.getSession(id);
    if (!session) {
      throw new Error(`Application session '${id}' not found.`);
    }

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new Error(`Cannot update job context on terminal session in '${session.status}' status.`);
    }

    const now = new Date().toISOString();
    const updated: ApplicationSession = {
      ...session,
      jobContextOverrides: {
        ...(session.jobContextOverrides || {}),
        ...overrides,
      },
      updatedAt: now,
      lastActivityAt: now,
    };

    this.storage.saveSession(updated);
    return updated;
  }

  /**
   * Returns effective (merged) job context overlaying manual corrections on top of the snapshot.
   */
  public getEffectiveContext(id: string): { snapshot: JobContextSnapshot; overrides: JobContextOverrides | null; effective: Record<string, any>; fields: Record<string, { source: 'extracted' | 'corrected' | 'supplied'; value: any }> } {
    const session = this.storage.getSession(id);
    if (!session) throw new Error(`Application session '${id}' not found.`);
    const snap = session.jobContextSnapshot;
    const over = session.jobContextOverrides || {};
    const snapObj = snap as unknown as Record<string, any>;
    const fields: Record<string, { source: 'extracted' | 'corrected' | 'supplied'; value: any }> = {};
    const effective: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(snapObj), ...Object.keys(over as Record<string, any>)]);
    for (const key of allKeys) {
      if (key === 'extractionTimestamp' || key === 'extractionConfidence' || key === 'extractionWarnings' || key === 'source' || key === 'parserVersion') continue;
      const origVal = snapObj[key];
      const overrideVal = (over as Record<string, any>)[key];
      if (overrideVal !== undefined && overrideVal !== null) {
        effective[key] = overrideVal;
        fields[key] = { source: origVal !== undefined && origVal !== null && JSON.stringify(origVal) !== JSON.stringify(overrideVal) ? 'corrected' : 'supplied', value: overrideVal };
      } else if (origVal !== undefined && origVal !== null) {
        effective[key] = origVal;
        fields[key] = { source: 'extracted', value: origVal };
      }
    }
    return { snapshot: snap, overrides: session.jobContextOverrides, effective, fields };
  }

  /**
   * Explicitly sets or updates the Career Profile associated with this session.
   */
  public setCareerProfile(id: string, careerProfileId: string, profileVersion?: string, selectionSource: 'auto' | 'manual' = 'manual'): ApplicationSession {
    const session = this.storage.getSession(id);
    if (!session) {
      throw new Error(`Application session '${id}' not found.`);
    }

    const now = new Date().toISOString();
    const effectiveSource: 'auto' | 'manual' = (session.careerProfileSelectionSource === 'manual' && selectionSource === 'auto')
      ? 'manual'
      : selectionSource;
    const updated: ApplicationSession = {
      ...session,
      selectedCareerProfileId: careerProfileId,
      selectedCareerProfileVersion: profileVersion || session.selectedCareerProfileVersion,
      careerProfileSelectionSource: effectiveSource,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.storage.saveSession(updated);
    return updated;
  }

  /**
   * Associates an additional page (e.g. APPLICATION_PAGE or OTHER) to the session.
   * Avoids adding duplicate identical URLs. Sets applicationUrl only when explicitly APPLICATION_PAGE.
   * Preserves sourceJobUrl permanently.
   */
  public attachPageToSession(
    id: string,
    page: { url: string; pageType: PageType; title?: string }
  ): ApplicationSession {
    const session = this.storage.getSession(id);
    if (!session) {
      throw new Error(`Application session '${id}' not found.`);
    }

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new Error(`Cannot attach page to session in terminal status '${session.status}'.`);
    }

    const canonicalUrl = normalizeJobUrl(page.url);
    const existingIndex = session.associatedPages.findIndex(
      (p) => normalizeJobUrl(p.url) === canonicalUrl
    );

    const now = new Date().toISOString();
    const newPageItem: AssociatedPage = {
      url: page.url,
      pageType: page.pageType,
      attachedAt: now,
      title: page.title,
    };

    let updatedPages = [...session.associatedPages];
    if (existingIndex >= 0) {
      updatedPages[existingIndex] = newPageItem;
    } else {
      updatedPages.push(newPageItem);
    }

    let newAppUrl = session.applicationUrl;
    if (page.pageType === 'APPLICATION_PAGE') {
      newAppUrl = page.url;
    }

    const updated: ApplicationSession = {
      ...session,
      associatedPages: updatedPages,
      applicationUrl: newAppUrl,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.storage.saveSession(updated);
    return updated;
  }

  /**
   * Finds an existing active or paused session for a specific job using reliable identity:
   * 1. Exact Job ID
   * 2. Canonical normalized URL
   */
  public getExistingSessionForJob(params: { jobId?: string; jobUrl?: string }): ApplicationSession | null {
    const allSessions = this.storage.listSessions();

    if (params.jobId) {
      const match = allSessions.find(
        (s) => s.jobId === params.jobId && (s.status === 'ACTIVE' || s.status === 'PAUSED')
      );
      if (match) return match;
    }

    if (params.jobUrl) {
      const targetNorm = normalizeJobUrl(params.jobUrl);
      const match = allSessions.find(
        (s) =>
          (normalizeJobUrl(s.sourceJobUrl) === targetNorm ||
            (s.applicationUrl && normalizeJobUrl(s.applicationUrl) === targetNorm) ||
            s.associatedPages.some((p) => normalizeJobUrl(p.url) === targetNorm)) &&
          (s.status === 'ACTIVE' || s.status === 'PAUSED')
      );
      if (match) return match;
    }

    return null;
  }
}

