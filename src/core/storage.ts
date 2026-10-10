import fs from 'node:fs';
import path from 'node:path';
import { MasterProfile, MasterProfileSchema } from '../types/master-profile.js';
import { CareerProfile, CareerProfileSchema } from '../types/career-profile.js';
import { SavedAnswerItem, SavedAnswerItemSchema } from '../types/answer-bank.js';
import {
  ProfileVersionEntry,
  ProvenanceSource,
  ChangeActor,
  ProfileFieldDiff,
} from '../types/provenance.js';
import { Job, JobSchema } from '../types/job.js';
import { JobSnapshot, JobSnapshotSchema } from '../types/job-snapshot.js';
import { JobDedupCluster, JobDedupClusterSchema } from '../types/job-dedup.js';

import { JobbyDatabase } from '../db/database.js';

export interface StorageConfig {
  profileDir?: string;
  dbPath?: string;
}

export class ProfileStorage {
  private profileDir: string;
  private db: JobbyDatabase;

  constructor(config: StorageConfig = {}) {
    this.profileDir = config.profileDir || './data/profile';
    const dbPath = config.dbPath || (this.profileDir === ':memory:' ? ':memory:' : path.join(this.profileDir, 'master-profile.db'));
    
    if (this.profileDir !== ':memory:' && !fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }

    this.db = new JobbyDatabase(dbPath);
  }

  public getDatabase(): JobbyDatabase {
    return this.db;
  }

  public getMasterProfile(): MasterProfile | null {
    // Check database first
    const fromDb = this.db.getMasterProfile();
    if (fromDb) return fromDb;

    // Fallback to JSON file if present
    if (this.profileDir !== ':memory:') {
      const jsonPath = path.join(this.profileDir, 'master-profile.json');
      if (fs.existsSync(jsonPath)) {
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const parsed = MasterProfileSchema.parse(raw);
        // Sync to DB
        this.db.saveMasterProfile(parsed, 'Initial file sync');
        return parsed;
      }
    }

    return null;
  }

  public saveMasterProfile(
    profile: MasterProfile,
    changeReason: string = 'Update Master Profile',
    options?: {
      changeSource?: ProvenanceSource;
      actor?: ChangeActor;
      fieldsChanged?: ProfileFieldDiff[];
    }
  ): void {
    const validated = MasterProfileSchema.parse(profile);

    // Save to SQLite
    this.db.saveMasterProfile(validated, changeReason, options);

    // Also persist human-readable local JSON
    if (this.profileDir !== ':memory:') {
      const jsonPath = path.join(this.profileDir, 'master-profile.json');
      fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2), 'utf-8');

      // Append to changelog
      const historyPath = path.join(this.profileDir, 'master-profile.history.jsonl');
      const entry = {
        timestamp: new Date().toISOString(),
        changeReason,
        profileId: validated.id,
        changeSource: options?.changeSource || 'USER_ENTERED',
        actor: options?.actor || 'user',
        fieldsChanged: options?.fieldsChanged,
      };
      fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n', 'utf-8');
    }
  }

  public getProfileHistory(profileId?: string): ProfileVersionEntry[] {
    return this.db.getProfileHistory(profileId);
  }

  public getProfileHistoryEntry(id: number): ProfileVersionEntry | null {
    return this.db.getProfileHistoryEntry(id);
  }

  public rollbackMasterProfile(historyEntryId: number, reason?: string): MasterProfile {
    const restored = this.db.rollbackToVersion(historyEntryId, reason);
    if (this.profileDir !== ':memory:') {
      const jsonPath = path.join(this.profileDir, 'master-profile.json');
      fs.writeFileSync(jsonPath, JSON.stringify(restored, null, 2), 'utf-8');
    }
    return restored;
  }


  public saveCareerProfile(careerProfile: CareerProfile): void {
    const validated = CareerProfileSchema.parse(careerProfile);
    this.db.saveCareerProfile(validated);

    if (this.profileDir !== ':memory:') {
      const subDir = path.join(this.profileDir, 'career-profiles');
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
      const jsonPath = path.join(subDir, `${validated.id}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2), 'utf-8');
    }
  }

  public getCareerProfiles(): CareerProfile[] {
    return this.db.getCareerProfiles();
  }

  public getCareerProfile(id: string): CareerProfile | null {
    return this.db.getCareerProfile(id);
  }
  public saveAnswerBankItem(item: SavedAnswerItem): void {
    const validated = SavedAnswerItemSchema.parse(item);
    this.db.saveSavedAnswer(validated);

    if (this.profileDir !== ':memory:') {
      const answersDir = path.join(this.profileDir, 'answer-bank');
      if (!fs.existsSync(answersDir)) {
        fs.mkdirSync(answersDir, { recursive: true });
      }
      const jsonPath = path.join(answersDir, `${validated.id}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2), 'utf-8');
    }
  }

  public getAnswerBankItems(): SavedAnswerItem[] {
    const fromDb = this.db.getSavedAnswers();
    if (fromDb.length > 0) return fromDb;

    // Fallback to directory scan if DB empty
    if (this.profileDir !== ':memory:') {
      const answersDir = path.join(this.profileDir, 'answer-bank');
      if (fs.existsSync(answersDir)) {
        const files = fs.readdirSync(answersDir).filter((f) => f.endsWith('.json'));
        const loaded: SavedAnswerItem[] = [];
        for (const file of files) {
          const raw = JSON.parse(fs.readFileSync(path.join(answersDir, file), 'utf-8'));
          const validated = SavedAnswerItemSchema.parse(raw);
          this.db.saveSavedAnswer(validated);
          loaded.push(validated);
        }
        return loaded;
      }
    }

    return [];
  }

  // ==========================================
  // JOBS, SNAPSHOTS & DEDUPLICATION
  // ==========================================

  public saveJob(job: Job): void {
    const validated = JobSchema.parse(job);
    this.db.saveJob(validated);

    if (this.profileDir !== ':memory:') {
      const jobsDir = path.join(this.profileDir, 'jobs');
      if (!fs.existsSync(jobsDir)) {
        fs.mkdirSync(jobsDir, { recursive: true });
      }
      const jsonPath = path.join(jobsDir, `${validated.id}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2), 'utf-8');
    }
  }

  public getJobs(): Job[] {
    return this.db.getJobs();
  }

  public getJob(id: string): Job | null {
    return this.db.getJob(id);
  }

  public findJobByDedupHash(dedupHash: string): Job | null {
    return this.db.findJobByDedupHash(dedupHash);
  }

  public saveJobSnapshot(snapshot: JobSnapshot): void {
    const validated = JobSnapshotSchema.parse(snapshot);
    this.db.saveJobSnapshot(validated);

    if (this.profileDir !== ':memory:') {
      const snapshotsDir = path.join(this.profileDir, 'job-snapshots');
      if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
      }
      const jsonPath = path.join(snapshotsDir, `${validated.id}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(validated, null, 2), 'utf-8');
    }
  }

  public getJobSnapshots(jobId: string): JobSnapshot[] {
    return this.db.getJobSnapshots(jobId);
  }

  public saveDedupCluster(cluster: JobDedupCluster): void {
    this.db.saveDedupCluster(cluster);
  }

  public getDedupCluster(clusterId: string): JobDedupCluster | null {
    return this.db.getDedupCluster(clusterId);
  }


  public close(): void {
    this.db.close();
  }
}
