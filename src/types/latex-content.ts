/**
 * Structured content types for LaTeX document generation.
 * Every field is optional — templates handle missing sections gracefully.
 * Never contains executable LaTeX commands from user/profile data.
 */

export interface ResumeContent {
  /** Contact section */
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  provinceState?: string;
  country?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;

  /** Professional summary (pre-escaped for LaTeX) */
  summary?: string;

  /** One-line professional headline (e.g., "Applied AI Engineer | AI OS & Workflow Automation") */
  headline?: string;

  /** Experience entries — ordered by priority */
  experience?: ResumeExperienceEntry[];

  /** Education entries */
  education?: ResumeEducationEntry[];

  /** Skills — grouped by category or flat list */
  skills?: string[];

  /** Skills grouped into labeled categories for structured rendering */
  skillGroups?: { category: string; skills: string[] }[];

  /** Selected projects */
  projects?: ResumeProjectEntry[];

  /** Optional sections */
  certifications?: string[];
  languages?: string[];
  awards?: string[];
}

export interface ResumeExperienceEntry {
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  location?: string;
  bullets: string[];
  technologies?: string[];
  /** Quantified achievements (e.g., "Drove 220% MRR increase") */
  measurableAchievements?: string[];
}

export interface ResumeEducationEntry {
  degree: string;
  major?: string;
  institution: string;
  gpa?: string;
  startDate?: string;
  endDate?: string;
}

export interface ResumeProjectEntry {
  name: string;
  description: string;
  url?: string;
  technologies?: string[];
  /** Quantified outcomes (e.g., "Saved $40K USD in ARR") */
  measurableOutcomes?: string[];
}

export interface CoverLetterContent {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  provinceState?: string;
  linkedin?: string;
  github?: string;

  /** Date line */
  date?: string;

  /** Recipient info — optional, omit if unknown */
  companyName?: string;
  roleTitle?: string;

  /** Letter body paragraphs (pre-escaped for LaTeX) */
  paragraphs?: string[];

  /** Closing */
  closing?: string;
}