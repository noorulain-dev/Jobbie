import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { MasterProfile, MasterProfileSchema } from '../types/master-profile.js';
import { CareerProfile, CareerProfileSchema } from '../types/career-profile.js';
import { SavedAnswerItem, SavedAnswerItemSchema } from '../types/answer-bank.js';
import {
  FactConflict,
  ProfileVersionEntry,
  ProfileVersionEntrySchema,
  ProvenanceSource,
  ChangeActor,
  ProfileFieldDiff,
} from '../types/provenance.js';
import { computeProfileDiff } from '../core/profile-differ.js';
import { Job, JobSchema } from '../types/job.js';
import { JobSnapshot, JobSnapshotSchema } from '../types/job-snapshot.js';
import { JobDedupCluster, JobDedupClusterSchema } from '../types/job-dedup.js';
import {
  ApplicationSession,
  ApplicationSessionSchema,
  ApplicationSessionStatus,
  isValidSessionTransition,
  AssociatedPage,
} from '../types/application-session.js';



dotenv.config();

const DEFAULT_DB_PATH = process.env.JOBBY_DB_PATH || './data/profile/master-profile.db';

export class JobbyDatabase {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    if (dbPath !== ':memory:') {
      const resolvedPath = path.resolve(dbPath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(resolvedPath);
    } else {
      this.db = new Database(':memory:');
    }

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS master_profile (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        data_json TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL,
        version_number INTEGER DEFAULT 1,
        change_source TEXT DEFAULT 'USER_ENTERED',
        actor TEXT DEFAULT 'user',
        change_reason TEXT NOT NULL,
        fields_changed_json TEXT DEFAULT '[]',
        snapshot_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_profiles (
        id TEXT PRIMARY KEY,
        track TEXT NOT NULL,
        name TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        fact_path TEXT NOT NULL,
        data_json TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS answer_bank (
        id TEXT PRIMARY KEY,
        question_pattern TEXT NOT NULL,
        category TEXT NOT NULL,
        response_type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_index (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        aliases_json TEXT NOT NULL,
        evidence_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_job_id TEXT,
        source_url TEXT NOT NULL,
        canonical_url TEXT,
        application_url TEXT,
        company_name TEXT NOT NULL,
        normalized_company TEXT NOT NULL,
        company_url TEXT,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        department TEXT,
        seniority TEXT NOT NULL,
        remote_status TEXT NOT NULL,
        city TEXT,
        region TEXT,
        country TEXT,
        salary_min REAL,
        salary_max REAL,
        salary_currency TEXT NOT NULL DEFAULT 'USD',
        salary_period TEXT NOT NULL DEFAULT 'yearly',
        salary_text TEXT,
        employment_type TEXT NOT NULL,
        description TEXT NOT NULL,
        application_method TEXT NOT NULL,
        posted_at TEXT,
        closing_at TEXT,
        discovered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        parser_version TEXT NOT NULL DEFAULT '1.0.0',
        parser_confidence REAL NOT NULL DEFAULT 1.0,
        dedup_hash TEXT NOT NULL,
        dedup_cluster_id TEXT,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_snapshots (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        snapshot_timestamp TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        clean_text_content TEXT NOT NULL,
        parsed_state_json TEXT NOT NULL,
        change_delta_json TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS job_dedup_clusters (
        cluster_id TEXT PRIMARY KEY,
        primary_job_id TEXT NOT NULL,
        dedup_hash TEXT NOT NULL,
        company_normalized TEXT NOT NULL,
        title_normalized TEXT NOT NULL,
        location_normalized TEXT NOT NULL,
        member_job_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_company_name ON jobs(company_name);
      CREATE INDEX IF NOT EXISTS idx_jobs_normalized_title ON jobs(normalized_title);
      CREATE INDEX IF NOT EXISTS idx_jobs_dedup_hash ON jobs(dedup_hash);
      CREATE INDEX IF NOT EXISTS idx_jobs_dedup_cluster ON jobs(dedup_cluster_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_job_id ON job_snapshots(job_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON job_snapshots(content_hash);

      CREATE TABLE IF NOT EXISTS application_sessions (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        source_job_url TEXT NOT NULL,
        application_url TEXT,
        associated_pages_json TEXT NOT NULL DEFAULT '[]',
        selected_career_profile_id TEXT,
        selected_career_profile_version TEXT,
        master_profile_version INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        data_json TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_job_id ON application_sessions(job_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON application_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON application_sessions(last_activity_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON application_sessions(updated_at);

    `);

    // Upgrade existing profile_history schema if columns missing
    const historyColumns = this.db.prepare('PRAGMA table_info(profile_history)').all() as Array<{ name: string }>;
    const existingColNames = new Set(historyColumns.map((c) => c.name));

    if (!existingColNames.has('version_number')) {
      try {
        this.db.exec('ALTER TABLE profile_history ADD COLUMN version_number INTEGER DEFAULT 1');
      } catch {}
    }
    if (!existingColNames.has('change_source')) {
      try {
        this.db.exec("ALTER TABLE profile_history ADD COLUMN change_source TEXT DEFAULT 'USER_ENTERED'");
      } catch {}
    }
    if (!existingColNames.has('actor')) {
      try {
        this.db.exec("ALTER TABLE profile_history ADD COLUMN actor TEXT DEFAULT 'user'");
      } catch {}
    }
    if (!existingColNames.has('fields_changed_json')) {
      try {
        this.db.exec("ALTER TABLE profile_history ADD COLUMN fields_changed_json TEXT DEFAULT '[]'");
      } catch {}
    }
  }


  public getMasterProfile(): MasterProfile | null {
    const row = this.db.prepare('SELECT data_json FROM master_profile LIMIT 1').get() as { data_json: string } | undefined;
    if (!row) return null;
    return MasterProfileSchema.parse(JSON.parse(row.data_json));
  }

  public saveMasterProfile(
    profile: MasterProfile,
    changeReason: string = 'Update master profile',
    options?: {
      changeSource?: ProvenanceSource;
      actor?: ChangeActor;
      fieldsChanged?: ProfileFieldDiff[];
    }
  ): void {
    const validated = MasterProfileSchema.parse(profile);

    const previousMaster = this.getMasterProfile();
    const computedDiffs = options?.fieldsChanged || computeProfileDiff(previousMaster, validated);
    const source: ProvenanceSource = options?.changeSource || 'USER_ENTERED';
    const actor: ChangeActor = options?.actor || 'user';

    const lastVersionRow = this.db.prepare('SELECT MAX(version_number) as max_v FROM profile_history WHERE profile_id = ?').get(validated.id) as { max_v: number | null } | undefined;
    const nextVersionNumber = (lastVersionRow?.max_v || 0) + 1;

    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO master_profile (id, version, data_json, last_updated)
        VALUES (@id, @version, @data_json, @last_updated)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          data_json = excluded.data_json,
          last_updated = excluded.last_updated
      `).run({
        id: validated.id,
        version: validated.schemaVersion,
        data_json: JSON.stringify(validated, null, 2),
        last_updated: validated.lastUpdated,
      });

      this.db.prepare(`
        INSERT INTO profile_history (
          profile_id,
          version_number,
          change_source,
          actor,
          change_reason,
          fields_changed_json,
          snapshot_json,
          timestamp
        )
        VALUES (
          @profile_id,
          @version_number,
          @change_source,
          @actor,
          @change_reason,
          @fields_changed_json,
          @snapshot_json,
          @timestamp
        )
      `).run({
        profile_id: validated.id,
        version_number: nextVersionNumber,
        change_source: source,
        actor,
        change_reason: changeReason,
        fields_changed_json: JSON.stringify(computedDiffs),
        snapshot_json: JSON.stringify(validated),
        timestamp: new Date().toISOString(),
      });

      this.db.prepare('DELETE FROM skill_index').run();
      const insertSkill = this.db.prepare(`
        INSERT INTO skill_index (id, name, category, status, aliases_json, evidence_json)
        VALUES (@id, @name, @category, @status, @aliases_json, @evidence_json)
      `);

      for (const skill of validated.skills) {
        insertSkill.run({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          status: skill.status,
          aliases_json: JSON.stringify(skill.aliases),
          evidence_json: JSON.stringify(skill.evidence),
        });
      }

      this.db.prepare('DELETE FROM conflicts').run();
      const insertConflict = this.db.prepare(`
        INSERT INTO conflicts (id, fact_path, data_json, detected_at, resolved)
        VALUES (@id, @fact_path, @data_json, @detected_at, @resolved)
      `);

      for (const conflict of validated.conflicts) {
        insertConflict.run({
          id: conflict.id,
          fact_path: conflict.factPath,
          data_json: JSON.stringify(conflict),
          detected_at: conflict.detectedAt,
          resolved: conflict.resolved ? 1 : 0,
        });
      }
    });

    transaction();
  }

  public getCareerProfiles(): CareerProfile[] {
    const rows = this.db.prepare('SELECT data_json FROM career_profiles').all() as { data_json: string }[];
    return rows.map((r) => CareerProfileSchema.parse(JSON.parse(r.data_json)));
  }

  public getCareerProfile(id: string): CareerProfile | null {
    const row = this.db.prepare('SELECT data_json FROM career_profiles WHERE id = ?').get(id) as { data_json: string } | undefined;
    if (!row) return null;
    return CareerProfileSchema.parse(JSON.parse(row.data_json));
  }

  public saveCareerProfile(careerProfile: CareerProfile): void {
    const validated = CareerProfileSchema.parse(careerProfile);
    this.db.prepare(`
      INSERT INTO career_profiles (id, track, name, data_json, updated_at)
      VALUES (@id, @track, @name, @data_json, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        track = excluded.track,
        name = excluded.name,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `).run({
      id: validated.id,
      track: validated.track,
      name: validated.name,
      data_json: JSON.stringify(validated, null, 2),
      updated_at: validated.updatedAt,
    });
  }

  public getConflicts(unresolvedOnly: boolean = true): FactConflict[] {
    const query = unresolvedOnly
      ? 'SELECT data_json FROM conflicts WHERE resolved = 0'
      : 'SELECT data_json FROM conflicts';
    const rows = this.db.prepare(query).all() as { data_json: string }[];
    return rows.map((r) => JSON.parse(r.data_json));
  }
  public getSavedAnswers(): SavedAnswerItem[] {
    const rows = this.db.prepare('SELECT data_json FROM answer_bank').all() as { data_json: string }[];
    return rows.map((r) => SavedAnswerItemSchema.parse(JSON.parse(r.data_json)));
  }

  public getSavedAnswer(id: string): SavedAnswerItem | null {
    const row = this.db.prepare('SELECT data_json FROM answer_bank WHERE id = ?').get(id) as { data_json: string } | undefined;
    if (!row) return null;
    return SavedAnswerItemSchema.parse(JSON.parse(row.data_json));
  }

  public saveSavedAnswer(item: SavedAnswerItem): void {
    const validated = SavedAnswerItemSchema.parse(item);
    this.db.prepare(`
      INSERT INTO answer_bank (id, question_pattern, category, response_type, data_json, updated_at)
      VALUES (@id, @question_pattern, @category, @response_type, @data_json, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        question_pattern = excluded.question_pattern,
        category = excluded.category,
        response_type = excluded.response_type,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `).run({
      id: validated.id,
      question_pattern: validated.questionPattern,
      category: validated.category,
      response_type: validated.responseType,
      data_json: JSON.stringify(validated, null, 2),
      updated_at: validated.updatedAt,
    });
  }

  public deleteSavedAnswer(id: string): void {
    this.db.prepare('DELETE FROM answer_bank WHERE id = ?').run(id);
  }

  public getProfileHistory(profileId?: string): ProfileVersionEntry[] {
    const query = profileId
      ? 'SELECT * FROM profile_history WHERE profile_id = ? ORDER BY id DESC'
      : 'SELECT * FROM profile_history ORDER BY id DESC';
    const rows = (profileId
      ? this.db.prepare(query).all(profileId)
      : this.db.prepare(query).all()) as Array<{
      id: number;
      profile_id: string;
      version_number: number;
      change_source: string;
      actor: string;
      change_reason: string;
      fields_changed_json: string;
      snapshot_json: string;
      timestamp: string;
    }>;

    return rows.map((r) => {
      let fieldsChanged: ProfileFieldDiff[] = [];
      try {
        fieldsChanged = JSON.parse(r.fields_changed_json || '[]');
      } catch {}

      return ProfileVersionEntrySchema.parse({
        id: r.id,
        profileId: r.profile_id,
        versionNumber: r.version_number || r.id,
        timestamp: r.timestamp,
        changeSource: (r.change_source as ProvenanceSource) || 'USER_ENTERED',
        actor: (r.actor as ChangeActor) || 'user',
        changeReason: r.change_reason || 'Update master profile',
        fieldsChanged,
        snapshotJson: r.snapshot_json,
      });
    });
  }

  public getProfileHistoryEntry(id: number): ProfileVersionEntry | null {
    const row = this.db.prepare('SELECT * FROM profile_history WHERE id = ?').get(id) as {
      id: number;
      profile_id: string;
      version_number: number;
      change_source: string;
      actor: string;
      change_reason: string;
      fields_changed_json: string;
      snapshot_json: string;
      timestamp: string;
    } | undefined;

    if (!row) return null;

    let fieldsChanged: ProfileFieldDiff[] = [];
    try {
      fieldsChanged = JSON.parse(row.fields_changed_json || '[]');
    } catch {}

    return ProfileVersionEntrySchema.parse({
      id: row.id,
      profileId: row.profile_id,
      versionNumber: row.version_number || row.id,
      timestamp: row.timestamp,
      changeSource: (row.change_source as ProvenanceSource) || 'USER_ENTERED',
      actor: (row.actor as ChangeActor) || 'user',
      changeReason: row.change_reason || 'Update master profile',
      fieldsChanged,
      snapshotJson: row.snapshot_json,
    });
  }

  public rollbackToVersion(historyEntryId: number, rollbackReason?: string): MasterProfile {
    const entry = this.getProfileHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`Profile history entry with id '${historyEntryId}' not found.`);
    }

    const restoredProfile = MasterProfileSchema.parse(JSON.parse(entry.snapshotJson));
    restoredProfile.lastUpdated = new Date().toISOString();

    const reason = rollbackReason || `Rolled back to version #${entry.versionNumber} (${entry.changeReason})`;
    this.saveMasterProfile(restoredProfile, reason, {
      changeSource: 'USER_ENTERED',
      actor: 'user',
    });

    return restoredProfile;
  }
  // ==========================================
  // JOBS, SNAPSHOTS & DEDUPLICATION
  // ==========================================

  public getJobs(): Job[] {
    const rows = this.db.prepare('SELECT data_json FROM jobs ORDER BY discovered_at DESC').all() as { data_json: string }[];
    return rows.map((r) => JobSchema.parse(JSON.parse(r.data_json)));
  }

  public getJob(id: string): Job | null {
    const row = this.db.prepare('SELECT data_json FROM jobs WHERE id = ?').get(id) as { data_json: string } | undefined;
    if (!row) return null;
    return JobSchema.parse(JSON.parse(row.data_json));
  }

  public findJobByDedupHash(dedupHash: string): Job | null {
    const row = this.db.prepare('SELECT data_json FROM jobs WHERE dedup_hash = ? LIMIT 1').get(dedupHash) as { data_json: string } | undefined;
    if (!row) return null;
    return JobSchema.parse(JSON.parse(row.data_json));
  }

  public saveJob(job: Job): void {
    const validated = JobSchema.parse(job);

    this.db.prepare(`
      INSERT INTO jobs (
        id,
        source,
        source_job_id,
        source_url,
        canonical_url,
        application_url,
        company_name,
        normalized_company,
        company_url,
        title,
        normalized_title,
        department,
        seniority,
        remote_status,
        city,
        region,
        country,
        salary_min,
        salary_max,
        salary_currency,
        salary_period,
        salary_text,
        employment_type,
        description,
        application_method,
        posted_at,
        closing_at,
        discovered_at,
        updated_at,
        parser_version,
        parser_confidence,
        dedup_hash,
        dedup_cluster_id,
        data_json
      )
      VALUES (
        @id,
        @source,
        @source_job_id,
        @source_url,
        @canonical_url,
        @application_url,
        @company_name,
        @normalized_company,
        @company_url,
        @title,
        @normalized_title,
        @department,
        @seniority,
        @remote_status,
        @city,
        @region,
        @country,
        @salary_min,
        @salary_max,
        @salary_currency,
        @salary_period,
        @salary_text,
        @employment_type,
        @description,
        @application_method,
        @posted_at,
        @closing_at,
        @discovered_at,
        @updated_at,
        @parser_version,
        @parser_confidence,
        @dedup_hash,
        @dedup_cluster_id,
        @data_json
      )
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        source_job_id = excluded.source_job_id,
        source_url = excluded.source_url,
        canonical_url = excluded.canonical_url,
        application_url = excluded.application_url,
        company_name = excluded.company_name,
        normalized_company = excluded.normalized_company,
        company_url = excluded.company_url,
        title = excluded.title,
        normalized_title = excluded.normalized_title,
        department = excluded.department,
        seniority = excluded.seniority,
        remote_status = excluded.remote_status,
        city = excluded.city,
        region = excluded.region,
        country = excluded.country,
        salary_min = excluded.salary_min,
        salary_max = excluded.salary_max,
        salary_currency = excluded.salary_currency,
        salary_period = excluded.salary_period,
        salary_text = excluded.salary_text,
        employment_type = excluded.employment_type,
        description = excluded.description,
        application_method = excluded.application_method,
        posted_at = excluded.posted_at,
        closing_at = excluded.closing_at,
        updated_at = excluded.updated_at,
        parser_version = excluded.parser_version,
        parser_confidence = excluded.parser_confidence,
        dedup_hash = excluded.dedup_hash,
        dedup_cluster_id = excluded.dedup_cluster_id,
        data_json = excluded.data_json
    `).run({
      id: validated.id,
      source: validated.source,
      source_job_id: validated.sourceJobId,
      source_url: validated.sourceUrl,
      canonical_url: validated.canonicalUrl,
      application_url: validated.applicationUrl,
      company_name: validated.companyName,
      normalized_company: validated.normalizedCompany,
      company_url: validated.companyUrl,
      title: validated.title,
      normalized_title: validated.normalizedTitle,
      department: validated.department,
      seniority: validated.seniority,
      remote_status: validated.remoteStatus,
      city: validated.city,
      region: validated.region,
      country: validated.country,
      salary_min: validated.salaryMin,
      salary_max: validated.salaryMax,
      salary_currency: validated.salaryCurrency,
      salary_period: validated.salaryPeriod,
      salary_text: validated.salaryText,
      employment_type: validated.employmentType,
      description: validated.description,
      application_method: validated.applicationMethod,
      posted_at: validated.postedAt,
      closing_at: validated.closingAt,
      discovered_at: validated.discoveredAt,
      updated_at: validated.updatedAt,
      parser_version: validated.parserVersion,
      parser_confidence: validated.parserConfidence,
      dedup_hash: validated.dedupHash,
      dedup_cluster_id: validated.dedupClusterId,
      data_json: JSON.stringify(validated, null, 2),
    });
  }
  public saveJobSnapshot(snapshot: JobSnapshot): void {
    const validated = JobSnapshotSchema.parse(snapshot);
    this.db.prepare(`
      INSERT INTO job_snapshots (
        id,
        job_id,
        snapshot_timestamp,
        content_hash,
        clean_text_content,
        parsed_state_json,
        change_delta_json
      )
      VALUES (
        @id,
        @job_id,
        @snapshot_timestamp,
        @content_hash,
        @clean_text_content,
        @parsed_state_json,
        @change_delta_json
      )
    `).run({
      id: validated.id,
      job_id: validated.jobId,
      snapshot_timestamp: validated.snapshotTimestamp,
      content_hash: validated.contentHash,
      clean_text_content: validated.cleanTextContent,
      parsed_state_json: validated.parsedStateJson,
      change_delta_json: JSON.stringify(validated.changeDelta),
    });
  }

  public getJobSnapshots(jobId: string): JobSnapshot[] {
    const rows = this.db.prepare('SELECT * FROM job_snapshots WHERE job_id = ? ORDER BY snapshot_timestamp DESC').all(jobId) as Array<{
      id: string;
      job_id: string;
      snapshot_timestamp: string;
      content_hash: string;
      clean_text_content: string;
      parsed_state_json: string;
      change_delta_json: string;
    }>;

    return rows.map((r) => {
      let changeDelta: string[] = [];
      try {
        changeDelta = JSON.parse(r.change_delta_json || '[]');
      } catch {}

      return JobSnapshotSchema.parse({
        id: r.id,
        jobId: r.job_id,
        snapshotTimestamp: r.snapshot_timestamp,
        contentHash: r.content_hash,
        cleanTextContent: r.clean_text_content,
        parsedStateJson: r.parsed_state_json,
        changeDelta,
      });
    });
  }

  public saveDedupCluster(cluster: JobDedupCluster): void {
    const validated = JobDedupClusterSchema.parse(cluster);
    this.db.prepare(`
      INSERT INTO job_dedup_clusters (
        cluster_id,
        primary_job_id,
        dedup_hash,
        company_normalized,
        title_normalized,
        location_normalized,
        member_job_ids_json,
        created_at,
        updated_at
      )
      VALUES (
        @cluster_id,
        @primary_job_id,
        @dedup_hash,
        @company_normalized,
        @title_normalized,
        @location_normalized,
        @member_job_ids_json,
        @created_at,
        @updated_at
      )
      ON CONFLICT(cluster_id) DO UPDATE SET
        primary_job_id = excluded.primary_job_id,
        dedup_hash = excluded.dedup_hash,
        company_normalized = excluded.company_normalized,
        title_normalized = excluded.title_normalized,
        location_normalized = excluded.location_normalized,
        member_job_ids_json = excluded.member_job_ids_json,
        updated_at = excluded.updated_at
    `).run({
      cluster_id: validated.clusterId,
      primary_job_id: validated.primaryJobId,
      dedup_hash: validated.dedupHash,
      company_normalized: validated.companyNormalized,
      title_normalized: validated.titleNormalized,
      location_normalized: validated.locationNormalized,
      member_job_ids_json: JSON.stringify(validated.memberJobIds),
      created_at: validated.createdAt,
      updated_at: validated.updatedAt,
    });
  }

  public getDedupCluster(clusterId: string): JobDedupCluster | null {
    const row = this.db.prepare('SELECT * FROM job_dedup_clusters WHERE cluster_id = ?').get(clusterId) as {
      cluster_id: string;
      primary_job_id: string;
      dedup_hash: string;
      company_normalized: string;
      title_normalized: string;
      location_normalized: string;
      member_job_ids_json: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    let memberJobIds: string[] = [];
    try {
      memberJobIds = JSON.parse(row.member_job_ids_json || '[]');
    } catch {}

    return JobDedupClusterSchema.parse({
      clusterId: row.cluster_id,
      primaryJobId: row.primary_job_id,
      dedupHash: row.dedup_hash,
      companyNormalized: row.company_normalized,
      titleNormalized: row.title_normalized,
      locationNormalized: row.location_normalized,
      memberJobIds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  // ==========================================
  // APPLICATION SESSIONS
  // ==========================================

  public getSession(id: string): ApplicationSession | null {
    const row = this.db.prepare('SELECT data_json FROM application_sessions WHERE id = ?').get(id) as { data_json: string } | undefined;
    if (!row) return null;
    return ApplicationSessionSchema.parse(JSON.parse(row.data_json));
  }

  public getActiveSession(): ApplicationSession | null {
    const row = this.db.prepare("SELECT data_json FROM application_sessions WHERE status = 'ACTIVE' ORDER BY last_activity_at DESC LIMIT 1").get() as { data_json: string } | undefined;
    if (!row) return null;
    return ApplicationSessionSchema.parse(JSON.parse(row.data_json));
  }

  public listSessions(filter?: { status?: ApplicationSessionStatus; jobId?: string }): ApplicationSession[] {
    let query = 'SELECT data_json FROM application_sessions';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.jobId) {
      conditions.push('job_id = ?');
      params.push(filter.jobId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY last_activity_at DESC';

    const rows = this.db.prepare(query).all(...params) as { data_json: string }[];
    return rows.map((r) => ApplicationSessionSchema.parse(JSON.parse(r.data_json)));
  }

  public saveSession(session: ApplicationSession): void {
    const validated = ApplicationSessionSchema.parse(session);

    // If session already exists in database, validate status transition
    const existing = this.getSession(validated.id);
    if (existing && existing.status !== validated.status) {
      if (!isValidSessionTransition(existing.status, validated.status)) {
        throw new Error(
          `Invalid session transition from '${existing.status}' to '${validated.status}'. ` +
          `Terminal sessions cannot resume; valid transitions are ACTIVE <-> PAUSED, or transition to COMPLETED/CANCELLED.`
        );
      }
    }

    this.db.prepare(`
      INSERT INTO application_sessions (
        id,
        job_id,
        status,
        source_job_url,
        application_url,
        associated_pages_json,
        selected_career_profile_id,
        selected_career_profile_version,
        master_profile_version,
        created_at,
        updated_at,
        last_activity_at,
        data_json
      )
      VALUES (
        @id,
        @job_id,
        @status,
        @source_job_url,
        @application_url,
        @associated_pages_json,
        @selected_career_profile_id,
        @selected_career_profile_version,
        @master_profile_version,
        @created_at,
        @updated_at,
        @last_activity_at,
        @data_json
      )
      ON CONFLICT(id) DO UPDATE SET
        job_id = excluded.job_id,
        status = excluded.status,
        source_job_url = excluded.source_job_url,
        application_url = excluded.application_url,
        associated_pages_json = excluded.associated_pages_json,
        selected_career_profile_id = excluded.selected_career_profile_id,
        selected_career_profile_version = excluded.selected_career_profile_version,
        master_profile_version = excluded.master_profile_version,
        updated_at = excluded.updated_at,
        last_activity_at = excluded.last_activity_at,
        data_json = excluded.data_json
    `).run({
      id: validated.id,
      job_id: validated.jobId,
      status: validated.status,
      source_job_url: validated.sourceJobUrl,
      application_url: validated.applicationUrl,
      associated_pages_json: JSON.stringify(validated.associatedPages),
      selected_career_profile_id: validated.selectedCareerProfileId,
      selected_career_profile_version: validated.selectedCareerProfileVersion,
      master_profile_version: validated.masterProfileVersion,
      created_at: validated.createdAt,
      updated_at: validated.updatedAt,
      last_activity_at: validated.lastActivityAt,
      data_json: JSON.stringify(validated, null, 2),
    });
  }
  public updateSessionStatus(id: string, newStatus: ApplicationSessionStatus): ApplicationSession {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`Application session '${id}' not found.`);
    }

    if (!isValidSessionTransition(session.status, newStatus)) {
      throw new Error(
        `Invalid session transition from '${session.status}' to '${newStatus}'. ` +
        `Terminal sessions cannot resume; valid transitions are ACTIVE <-> PAUSED, or transition to COMPLETED/CANCELLED.`
      );
    }

    const now = new Date().toISOString();
    const updated: ApplicationSession = {
      ...session,
      status: newStatus,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.saveSession(updated);
    return updated;
  }

  public attachPageToSession(id: string, page: AssociatedPage): ApplicationSession {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`Application session '${id}' not found.`);
    }

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new Error(`Cannot attach page to session in terminal status '${session.status}'.`);
    }

    const existingPages = session.associatedPages.filter((p) => p.url !== page.url);
    const updatedPages = [...existingPages, page];
    const now = new Date().toISOString();

    const updated: ApplicationSession = {
      ...session,
      associatedPages: updatedPages,
      applicationUrl: page.pageType === 'APPLICATION_PAGE' ? page.url : session.applicationUrl,
      updatedAt: now,
      lastActivityAt: now,
    };

    this.saveSession(updated);
    return updated;
  }






  public close(): void {
    this.db.close();
  }
}

