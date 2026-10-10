import { MasterProfile } from '../types/master-profile.js';
import { CareerProfile } from '../types/career-profile.js';
import { QuestionCategory, QuestionResponseType } from '../types/answer-bank.js';

export interface QuestionPatternRule {
  category: QuestionCategory;
  defaultResponseType: QuestionResponseType;
  patterns: RegExp[];
  canonicalFactResolver: (master: MasterProfile, careerProfile?: CareerProfile | null) => {
    answer: string | null;
    notes?: string;
  };
}

export const CANONICAL_QUESTION_RULES: QuestionPatternRule[] = [
  // 1. Sponsorship Required (Evaluated before generic work authorization to prevent sponsorship questions containing 'authorization' from matching as work authorization)
  {
    category: 'sponsorship',
    defaultResponseType: 'yes_no',
    patterns: [
      /^(?!.*\b(what|which|type|status)\b).*\b(require|need|require\w*)\b.*\b(sponsorship|visa sponsorship)\b/i,
      /^(?!.*\b(what|which|type|status)\b).*\b(sponsorship|visa sponsorship)\b.*\b(require|need)\b/i,
      /\bwill you now or in the future require (sponsorship|visa)\b/i,
    ],
    canonicalFactResolver: (master) => {
      const sponsor = master.screening.sponsorshipRequired.toLowerCase();
      const requiresSponsorship =
        sponsor.includes('yes') || (sponsor.includes('require') && !sponsor.includes('no'));
      return {
        answer: requiresSponsorship ? 'Yes' : 'No',
        notes: `Sponsorship status: ${master.screening.sponsorshipRequired}`,
      };
    },
  },

  // 2. Work Authorization (Canada / US / generic)
  {
    category: 'work_authorization',
    defaultResponseType: 'yes_no',
    patterns: [
      /\b(legally|authorized|eligib\w*|permit\w*)\b.*\b(work|employed|employment)\b/i,
      /\b(work|employment)\b.*\b(authorization|eligible|eligibility|permit\w*)\b/i,
      /\b(authorized|permit|permitted)\b.*\bto work\b/i,
      /\bare you legally authorized to work\b/i,
      /\bright to work\b/i,
      /\bpermitted to work\b/i,
      /\blegal authorization\b/i,
    ],
    canonicalFactResolver: (master) => {
      const auth = master.screening.workAuthorization.toLowerCase();
      const isAuthorized =
        !auth.includes('no') &&
        (auth.includes('citizen') ||
          auth.includes('pr') ||
          auth.includes('permanent') ||
          auth.includes('authorized') ||
          auth.includes('permit') ||
          auth.includes('yes'));
      return {
        answer: isAuthorized ? 'Yes' : 'No',
        notes: `Work authorization status: ${master.screening.workAuthorization}`,
      };
    },
  },


  // 3. Notice Period / Availability / Start Date
  {
    category: 'notice_period',
    defaultResponseType: 'free_text',
    patterns: [
      /\b(how soon|when|how quickly|earliest)\b.*\b(start|begin|join|available)\b/i,
      /\bnotice period\b/i,
      /\bearliest start date\b/i,
      /\bavailability to start\b/i,
      /\bavailable to start\b/i,
    ],
    canonicalFactResolver: (master) => {
      return {
        answer: master.screening.noticePeriod,
        notes: `Master profile notice period: ${master.screening.noticePeriod}`,
      };
    },
  },

  // 4. Salary / Compensation Questions
  {
    category: 'salary',
    defaultResponseType: 'numeric',
    patterns: [
      /\b(target|expected|desired|compensation|salary|hourly rate|annual compensation)\b.*\b(salary|expectations|range|rate|pay)\b/i,
      /\bwhat are your salary expectations\b/i,
      /\bcompensation expectations\b/i,
    ],
    canonicalFactResolver: (master, careerProfile) => {
      if (careerProfile?.salaryPreferences?.target) {
        return {
          answer: careerProfile.salaryPreferences.target,
          notes: `Career profile target salary for ${careerProfile.name}`,
        };
      }
      return {
        answer: master.screening.targetSalary,
        notes: `Master profile target salary: ${master.screening.targetSalary}`,
      };
    },
  },
];

export const ADDITIONAL_QUESTION_RULES: QuestionPatternRule[] = [
  // 5. Education Level / Degree
  {
    category: 'education',
    defaultResponseType: 'dropdown',
    patterns: [
      /\b(highest|level of)\b.*\beducation\b/i,
      /\bhighest degree\b/i,
      /\beducational attainment\b/i,
      /\bwhat is your highest level of education\b/i,
      /\bwhat was your degree\b/i,
      /\bdegree at university\b/i,
      /\buniversity degree\b/i,
    ],
    canonicalFactResolver: (master) => {
      const degrees = master.education.map((e) => e.degree);
      const masterDegree = degrees.find((d) => /master|m\.sc|msc|ms\b/i.test(d));
      const bachelorDegree = degrees.find((d) => /bachelor|b\.sc|bsc|bs\b/i.test(d));
      const topDegree = masterDegree || bachelorDegree || degrees[0] || "Bachelor's Degree";
      return {
        answer: topDegree,
        notes: `Derived from education records: ${degrees.join(', ')}`,
      };
    },
  },

  // 6. Experience Years
  {
    category: 'experience_years',
    defaultResponseType: 'numeric',
    patterns: [
      /\b(how many|number of)\b.*\byears\b.*\bexperience\b/i,
      /\byears of (professional|relevant|software|engineering|work) experience\b/i,
      /\btotal years of experience\b/i,
    ],
    canonicalFactResolver: (master, careerProfile) => {
      if (careerProfile?.seniorityPreferences?.yearsExperienceClaim) {
        return {
          answer: careerProfile.seniorityPreferences.yearsExperienceClaim,
          notes: `Career profile experience claim for ${careerProfile.name}`,
        };
      }
      return {
        answer: master.screening.yearsExperience,
        notes: `Master profile years of experience: ${master.screening.yearsExperience}`,
      };
    },
  },

  // 7. Location Questions
  {
    category: 'location',
    defaultResponseType: 'free_text',
    patterns: [
      /\bwhere are you (located|based|currently living)\b/i,
      /\bwhere do you (live|reside)\b/i,
      /\bcurrent (location|residence|city|address)\b/i,
      /\bcity and (state|country|province)\b/i,
      /\bwhat is your current location\b/i,
    ],
    canonicalFactResolver: (master) => {
      const loc = `${master.personal.city}, ${master.personal.provinceState}, ${master.personal.country}`;
      return {
        answer: loc,
        notes: `Personal residence: ${loc}`,
      };
    },
  },

  // 8. Work Preference / Remote / Relocation
  {
    category: 'work_preference',
    defaultResponseType: 'dropdown',
    patterns: [
      /\b(willing to|open to)\b.*\brelocate\b/i,
      /\brelocation\b/i,
      /\b(work|remote) (preference|eligibility|arrangement|mode)\b/i,
      /\bare you comfortable working remotely\b/i,
    ],
    canonicalFactResolver: (master, careerProfile) => {
      const relocate =
        careerProfile?.locationPreferences?.willingToRelocate ??
        master.screening.willingToRelocate ??
        false;
      return {
        answer: relocate ? 'Yes' : 'No',
        notes: `Relocation preference: ${relocate ? 'Willing' : 'Not willing'}. Remote eligibility: ${master.screening.remoteEligibility}`,
      };
    },
  },
];

export const ALL_CANONICAL_QUESTION_RULES = [...CANONICAL_QUESTION_RULES, ...ADDITIONAL_QUESTION_RULES];

