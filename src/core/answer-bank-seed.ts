import path from 'node:path';
import { ProfileStorage } from '../core/storage.js';
import { AnswerBankService } from '../core/answer-bank-service.js';

export function seedInitialAnswerBank(storage: ProfileStorage): void {
  const master = storage.getMasterProfile();
  if (!master) return;

  const service = new AnswerBankService();
  const existing = storage.getAnswerBankItems();
  if (existing.length > 0) return;

  const sampleQuestions = [
    {
      q: 'Are you legally authorized to work in Canada?',
      a: 'Yes',
      cat: 'work_authorization' as const,
      rt: 'yes_no' as const,
      aliases: ['Work authorization status Canada', 'Eligible to work in Canada'],
    },
    {
      q: 'Will you require sponsorship?',
      a: 'No',
      cat: 'sponsorship' as const,
      rt: 'yes_no' as const,
      aliases: ['Require visa sponsorship', 'Need sponsorship now or in the future'],
    },
    {
      q: 'How soon can you start?',
      a: master.screening.noticePeriod,
      cat: 'notice_period' as const,
      rt: 'free_text' as const,
      aliases: ['Notice period', 'Earliest start date', 'Availability to start'],
    },
    {
      q: 'Where are you located?',
      a: `${master.personal.city}, ${master.personal.provinceState}, ${master.personal.country}`,
      cat: 'location' as const,
      rt: 'free_text' as const,
      aliases: ['Current location', 'City of residence'],
    },
    {
      q: 'Highest level of education?',
      a: master.education[0]?.degree || "Master's Degree",
      cat: 'education' as const,
      rt: 'dropdown' as const,
      aliases: ['Highest degree attained', 'Level of education'],
    },
    {
      q: 'How many years of professional experience do you have?',
      a: master.screening.yearsExperience,
      cat: 'experience_years' as const,
      rt: 'numeric' as const,
      aliases: ['Years of software experience', 'Total professional experience'],
    },
    {
      q: 'What is your LinkedIn profile URL?',
      a: master.personal.linkedin,
      cat: 'links' as const,
      rt: 'free_text' as const,
      aliases: ['LinkedIn URL', 'LinkedIn Profile'],
    },
    {
      q: 'Please share your GitHub link',
      a: master.personal.github,
      cat: 'links' as const,
      rt: 'free_text' as const,
      aliases: ['GitHub URL', 'GitHub Profile'],
    },
    {
      q: 'Please share your portfolio link',
      a: master.personal.portfolio,
      cat: 'links' as const,
      rt: 'free_text' as const,
      aliases: ['Portfolio URL', 'Personal website'],
    },
  ];

  for (const sq of sampleQuestions) {
    const item = service.createSavedAnswerItem({
      question: sq.q,
      answer: sq.a,
      category: sq.cat,
      responseType: sq.rt,
      aliases: sq.aliases,
      safeToAutoSubmit: true,
    });
    storage.saveAnswerBankItem(item);
  }
}
