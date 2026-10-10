import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { SeedMigrator } from '../src/core/migrator.js';
import { MasterProfile } from '../src/types/master-profile.js';
import { AnswerBankService } from '../src/core/answer-bank-service.js';
import { SavedAnswerItem } from '../src/types/answer-bank.js';
import { ProfileStorage } from '../src/core/storage.js';

describe('Application Answer Bank Service', () => {
  let master: MasterProfile;
  let answerService: AnswerBankService;
  let storage: ProfileStorage;

  beforeEach(() => {
    const seedPath = path.resolve('./data/source/profile-seed.json');
    master = SeedMigrator.migrate(seedPath);
    answerService = new AnswerBankService();
    storage = new ProfileStorage({ profileDir: ':memory:' });
    storage.saveMasterProfile(master, 'Test init');
  });

  describe('1. Canonical Fact Resolution & Paraphrased Questions', () => {
    it('answers work authorization questions (paraphrased) with canonical fact', async () => {
      const q1 = await answerService.answerQuestion(master, {
        question: 'Are you legally authorized to work in Canada?',
      });
      expect(q1.status).toBe('RESOLVED');
      expect(q1.answer).toBe('Yes');
      expect(q1.category).toBe('work_authorization');
      expect(q1.confidence).toBe('high');
      expect(q1.safeToAutoSubmit).toBe(true);

      const q2 = await answerService.answerQuestion(master, {
        question: 'Do you have legal eligibility for employment in this country?',
      });
      expect(q2.status).toBe('RESOLVED');
      expect(q2.answer).toBe('Yes');
    });

    it('answers sponsorship questions (paraphrased) with canonical fact', async () => {
      const q1 = await answerService.answerQuestion(master, {
        question: 'Will you require sponsorship?',
      });
      expect(q1.status).toBe('RESOLVED');
      expect(q1.answer).toBe('No');
      expect(q1.category).toBe('sponsorship');

      const q2 = await answerService.answerQuestion(master, {
        question: 'Will you now or in the future require visa sponsorship to maintain employment authorization?',
      });
      expect(q2.status).toBe('RESOLVED');
      expect(q2.answer).toBe('No');
    });

    it('answers notice period / earliest start date questions', async () => {
      const q1 = await answerService.answerQuestion(master, {
        question: 'How soon can you start?',
      });
      expect(q1.status).toBe('RESOLVED');
      expect(q1.category).toBe('notice_period');
      expect(q1.answer).toBe(master.screening.noticePeriod);
    });

    it('answers location questions', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'Where are you located?',
      });
      expect(q.status).toBe('RESOLVED');
      expect(q.category).toBe('location');
      expect(q.answer).toContain('Toronto');
      expect(q.answer).toContain('Canada');
    });

    it('answers highest level of education questions', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'Highest level of education?',
      });
      expect(q.status).toBe('RESOLVED');
      expect(q.category).toBe('education');
      expect(q.answer).toContain('Master of Science');
    });

    it('answers professional experience years questions', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'How many years of professional experience do you have?',
      });
      expect(q.status).toBe('RESOLVED');
      expect(q.category).toBe('experience_years');
      expect(q.answer).toBe(master.screening.yearsExperience);
    });

    it('answers direct links for LinkedIn, GitHub, and Portfolio', async () => {
      const qLinkedIn = await answerService.answerQuestion(master, {
        question: 'What is your LinkedIn profile URL?',
      });
      expect(qLinkedIn.status).toBe('RESOLVED');
      expect(qLinkedIn.answer).toBe(master.personal.linkedin);

      const qGitHub = await answerService.answerQuestion(master, {
        question: 'Please share your GitHub link',
      });
      expect(qGitHub.status).toBe('RESOLVED');
      expect(qGitHub.answer).toBe(master.personal.github);
    });
  });

  describe('2. Dropdown & Yes/No Formatting Options', () => {
    it('maps free-text or canonical answers to provided dropdown options', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'What is your highest completed education level?',
        allowedDropdownOptions: [
          'High School Diploma',
          'Associate Degree',
          "Bachelor's Degree",
          "Master's Degree",
          'Doctorate / Ph.D.',
        ],
      });
      expect(q.status).toBe('RESOLVED');
      expect(q.answer).toBe("Master's Degree");
    });

    it('formats yes/no dropdowns correctly', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'Are you legally authorized to work in Canada?',
        allowedDropdownOptions: ['Yes', 'No'],
      });
      expect(q.status).toBe('RESOLVED');
      expect(q.answer).toBe('Yes');
    });
  });

  describe('3. Unknown Questions & Zero Fabrication Guardrail', () => {
    it('returns UNKNOWN_NEEDS_REVIEW when no canonical fact or saved answer exists', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'What is your favorite hobby on weekends?',
        useSemanticAI: false,
      });
      expect(q.status).toBe('UNKNOWN_NEEDS_REVIEW');
      expect(q.answer).toBeNull();
      expect(q.safeToAutoSubmit).toBe(false);
      expect(q.requiresHumanConfirmation).toBe(true);
    });

    it('rejects questions asking for unverified clearance or licenses', async () => {
      const q = await answerService.answerQuestion(master, {
        question: 'Do you hold a Top Secret Security Clearance with polygraph?',
        useSemanticAI: false,
      });
      expect(q.status).toBe('UNKNOWN_NEEDS_REVIEW');
      expect(q.answer).toBeNull();
    });
  });

  describe('4. Learning & Saving Encountered Answers for Reusability', () => {
    it('saves a newly confirmed answer and reuses it for subsequent identical or aliased questions', async () => {
      const savedItem = answerService.createSavedAnswerItem({
        question: 'What is your preferred pronouns?',
        answer: 'They/Them',
        category: 'general',
        responseType: 'free_text',
        aliases: ['Preferred pronouns', 'What are your pronouns?'],
      });

      storage.saveAnswerBankItem(savedItem);
      const bankItems = storage.getAnswerBankItems();

      const resolved = await answerService.answerQuestion(
        master,
        { question: 'What are your pronouns?' },
        bankItems
      );

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.answer).toBe('They/Them');
      expect(resolved.confidence).toBe('high');
      expect(resolved.source).toBe('user_confirmed');
    });
  });

  describe('5. Conditional Questions Branching', () => {
    it('resolves conditional follow-up only when parent condition is satisfied', async () => {
      const conditionalItem: SavedAnswerItem = answerService.createSavedAnswerItem({
        question: 'If you require sponsorship, what visa type?',
        answer: 'TN Visa',
        category: 'sponsorship',
        responseType: 'free_text',
        conditionTrigger: {
          dependsOnQuestion: 'sponsorship_required',
          expectedValue: 'Yes',
        },
      });

      // Scenario A: parent is "No"
      const resSkipped = await answerService.answerQuestion(
        master,
        {
          question: 'If you require sponsorship, what visa type?',
          contextAnswers: { sponsorship_required: 'No' },
          useSemanticAI: false,
        },
        [conditionalItem]
      );
      expect(resSkipped.status).toBe('UNKNOWN_NEEDS_REVIEW');

      // Scenario B: parent is "Yes"
      const resTriggered = await answerService.answerQuestion(
        master,
        {
          question: 'If you require sponsorship, what visa type?',
          contextAnswers: { sponsorship_required: 'Yes' },
          useSemanticAI: false,
        },
        [conditionalItem]
      );
      expect(resTriggered.status).toBe('RESOLVED');
      expect(resTriggered.answer).toBe('TN Visa');
    });
  });
});

