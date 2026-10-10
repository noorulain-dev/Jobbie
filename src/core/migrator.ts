import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  MasterProfile,
  MasterProfileSchema,
  ExperienceItem,
  ProjectItem,
  SkillItem,
  EducationItem,
  CertificationItem,
  AwardItem,
  LeadershipVolunteeringItem,
  LanguageSpokenItem,
} from '../types/master-profile.js';
import { FactProvenance, SkillCategory, SkillStatus } from '../types/provenance.js';

export interface SeedData {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    provinceState: string;
    country: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  screening: {
    workAuthorization: string;
    sponsorshipRequired: string;
    targetSalary: string;
    noticePeriod: string;
    yearsExperience: string;
    remoteEligibility?: string;
  };
  education: {
    degree: string;
    major?: string;
    institution: string;
    location?: string;
    status?: string;
    gpa?: string;
    coursework?: string[];
  }[];
  technical: {
    languages?: string[];
    frameworksAndLibraries?: string[];
    cloudAndInfrastructure?: string[];
    dataAndStorage?: string[];
    queuesAndAsync?: string[];
    emailAndDeliverability?: string[];
    billingAndAuth?: string[];
    crmAndMarketing?: string[];
    toolsAndHardware?: string[];
  };
  experience: {
    company: string;
    role: string;
    dates: string;
    location: string;
    bulletPoints: string[];
  }[];
  projects: {
    name: string;
    url?: string;
    dates?: string;
    techStack?: string;
    description: string;
  }[];
  certifications?: {
    title: string;
    year: string;
  }[];
  awards?: string[];
  leadershipAndVolunteering?: string[];
  languagesSpoken?: {
    language: string;
    proficiency: string;
  }[];
}

export const KNOWN_ALIASES: Record<string, string[]> = {
  React: ['React.js', 'ReactJS'],
  'React Native': ['ReactNative', 'RN'],
  'Node.js': ['Node', 'NodeJS'],
  Golang: ['Go', 'Go Language'],
  PostgreSQL: ['Postgres', 'Postgres DB'],
  JavaScript: ['JS', 'ES6+', 'ECMAScript'],
  TypeScript: ['TS'],
  Python: ['Python 3', 'Python3'],
  Docker: ['Docker Engine', 'Containers'],
  Kubernetes: ['K8s'],
  'Tailwind CSS': ['Tailwind', 'TailwindCSS'],
  HTML: ['HTML5', 'HyperText Markup Language'],
  CSS: ['CSS3'],
  AWS: ['Amazon Web Services'],
  GCP: ['Google Cloud Platform', 'Google Cloud'],
  MongoDB: ['Mongo'],
  SQLite: ['SQLite3'],
};

// Canonical Aliases Registry
export class SeedMigrator {
  public static migrate(seedPath: string): MasterProfile {
    const rawContent = fs.readFileSync(path.resolve(seedPath), 'utf-8');
    const seed: SeedData = JSON.parse(rawContent);
    const sourceRef = seedPath;
    const now = new Date().toISOString();
    const masterId = crypto.randomUUID();

    const personal = {
      firstName: seed.personal.firstName,
      lastName: seed.personal.lastName,
      email: seed.personal.email,
      phone: seed.personal.phone,
      city: seed.personal.city,
      provinceState: seed.personal.provinceState,
      country: seed.personal.country,
      linkedin: seed.personal.linkedin,
      github: seed.personal.github,
      portfolio: seed.personal.portfolio,
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    };

    const screening = {
      workAuthorization: seed.screening.workAuthorization,
      sponsorshipRequired: seed.screening.sponsorshipRequired,
      targetSalary: seed.screening.targetSalary,
      noticePeriod: seed.screening.noticePeriod,
      yearsExperience: seed.screening.yearsExperience,
      remoteEligibility: seed.screening.remoteEligibility || 'Remote or Hybrid',
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    };

    const education: EducationItem[] = seed.education.map((edu) => ({
      id: crypto.randomUUID(),
      degree: edu.degree,
      major: edu.major || '',
      institution: edu.institution,
      location: edu.location || '',
      status: (edu.status === 'In Progress' ? 'In Progress' : 'Completed') as 'Completed' | 'In Progress',
      gpa: edu.gpa,
      coursework: edu.coursework || [],
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const experience: ExperienceItem[] = seed.experience.map((exp) => {
      const expId = crypto.randomUUID();
      const [startDate, endDate] = exp.dates.includes('-')
        ? exp.dates.split('-').map((d) => d.trim())
        : [exp.dates, 'Present'];

      const bulletPoints = exp.bulletPoints.map((text) => ({
        id: crypto.randomUUID(),
        text,
        technologies: [],
        domains: [],
        measurableAchievements: [],
        provenance: {
          provenance: 'user-entered' as FactProvenance,
          sourceRef,
          approvedByUser: true,
        },
      }));

      return {
        id: expId,
        company: exp.company,
        title: exp.role,
        normalizedRole: exp.role,
        startDate: startDate || exp.dates,
        endDate: endDate || 'Present',
        location: exp.location,
        employmentType: exp.role.toLowerCase().includes('teacher')
          ? ('Teaching' as const)
          : exp.role.toLowerCase().includes('intern')
          ? ('Internship' as const)
          : ('Full-time' as const),
        bulletPoints,
        technologies: [],
        domains: [],
        measurableAchievements: [],
        provenance: {
          provenance: 'user-entered' as FactProvenance,
          sourceRef,
          approvedByUser: true,
        },
      };
    });

    const projects: ProjectItem[] = seed.projects.map((proj) => ({
      id: crypto.randomUUID(),
      name: proj.name,
      url: proj.url || '',
      dates: proj.dates || '',
      description: proj.description,
      technologies: proj.techStack ? proj.techStack.split(',').map((t) => t.trim()) : [],
      domain: '',
      measurableOutcomes: [],
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const skills: SkillItem[] = [];
    const categoryMap: Record<string, SkillCategory> = {
      languages: 'programming_languages',
      frameworksAndLibraries: 'frameworks_libraries',
      cloudAndInfrastructure: 'cloud_infrastructure',
      dataAndStorage: 'databases',
      queuesAndAsync: 'queues_async',
      emailAndDeliverability: 'email_infrastructure',
      billingAndAuth: 'billing_auth',
      crmAndMarketing: 'crm_marketing',
      toolsAndHardware: 'developer_tools',
    };

    for (const [key, category] of Object.entries(categoryMap)) {
      const skillList = seed.technical[key as keyof typeof seed.technical] || [];
      for (const rawName of skillList) {
        const name = rawName.trim();
        const skillId = crypto.randomUUID();
        const aliases = KNOWN_ALIASES[name] || [];
        const evidence: SkillItem['evidence'] = [];

        for (const exp of experience) {
          for (const b of exp.bulletPoints) {
            if (b.text.toLowerCase().includes(name.toLowerCase())) {
              evidence.push({
                id: crypto.randomUUID(),
                type: 'experience',
                referenceId: exp.id,
                description: `${exp.company}: ${b.text.slice(0, 100)}...`,
              });
              break;
            }
          }
        }

        for (const proj of projects) {
          if (
            proj.name.toLowerCase().includes(name.toLowerCase()) ||
            proj.description.toLowerCase().includes(name.toLowerCase()) ||
            proj.technologies.some((t) => t.toLowerCase() === name.toLowerCase())
          ) {
            evidence.push({
              id: crypto.randomUUID(),
              type: 'project',
              referenceId: proj.id,
              description: `Project: ${proj.name}`,
            });
          }
        }

        skills.push({
          id: skillId,
          name,
          category,
          status: 'EXPLICIT_KNOWN' as SkillStatus,
          aliases,
          evidence,
          provenance: {
            provenance: 'user-entered' as FactProvenance,
            sourceRef,
            approvedByUser: true,
          },
        });
      }
    }

    const certifications: CertificationItem[] = (seed.certifications || []).map((c) => ({
      id: crypto.randomUUID(),
      title: c.title,
      year: c.year,
      issuer: c.title.includes('Cisco') ? 'Cisco' : '',
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const awards: AwardItem[] = (seed.awards || []).map((a) => ({
      id: crypto.randomUUID(),
      title: a,
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const leadership: LeadershipVolunteeringItem[] = (seed.leadershipAndVolunteering || []).map((lv) => ({
      id: crypto.randomUUID(),
      role: lv,
      organization: '',
      dates: '',
      description: '',
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const languages: LanguageSpokenItem[] = (seed.languagesSpoken || []).map((l) => ({
      id: crypto.randomUUID(),
      language: l.language,
      proficiency: (['Native', 'Fluent', 'Proficient', 'Intermediate', 'Basic'].includes(l.proficiency)
        ? l.proficiency
        : 'Proficient') as LanguageSpokenItem['proficiency'],
      provenance: {
        provenance: 'user-entered' as FactProvenance,
        sourceRef,
        approvedByUser: true,
      },
    }));

    const masterProfile: MasterProfile = {
      schemaVersion: '1.0.0',
      id: masterId,
      lastUpdated: now,
      personal,
      screening,
      education,
      experience,
      projects,
      skills,
      certifications,
      awards,
      leadership,
      volunteering: [],
      languages,
      conflicts: [],
    };

    return MasterProfileSchema.parse(masterProfile);
  }
}

