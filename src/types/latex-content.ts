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

  /** Experience entries — ordered by priority */
  experience?: ResumeExperienceEntry[];

  /** Education entries */
  education?: ResumeEducationEntry[];

  /** Skills — grouped by category or flat list */
  skills?: string[];

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
}

export interface CoverLetterContent {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;

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