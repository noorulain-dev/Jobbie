import path from 'node:path';
import fs from 'node:fs';
import { SeedMigrator } from '../core/migrator.js';
import { ProfileStorage } from '../core/storage.js';
import { ProfileProjector } from '../core/projector.js';

async function runSeed() {
  console.log('--- Jobby Phase 2: Master Profile & Career Brain Seeding ---');

  const seedPath = path.resolve('./data/source/profile-seed.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`Error: Seed file not found at ${seedPath}`);
    process.exit(1);
  }

  console.log(`Ingesting seed data from: ${seedPath} (Classified strictly as user-entered)`);
  const masterProfile = SeedMigrator.migrate(seedPath);

  const storage = new ProfileStorage();
  storage.saveMasterProfile(masterProfile, 'Initial seed from profile-seed.json');

  console.log('✓ Master Profile successfully created and validated against canonical Zod schema!');
  console.log(`  - Profile ID: ${masterProfile.id}`);
  console.log(`  - Personal: ${masterProfile.personal.firstName} ${masterProfile.personal.lastName}`);
  console.log(`  - Skills indexed: ${masterProfile.skills.length}`);
  console.log(`  - Experience entries: ${masterProfile.experience.length}`);
  console.log(`  - Projects: ${masterProfile.projects.length}`);
  console.log(`  - Provenance on personal info: ${masterProfile.personal.provenance.provenance}`);

  // Create standard career profiles
  console.log('\nGenerating standard Career Profile projections...');

  // 1. Software Engineering
  const sweProfile = ProfileProjector.createCareerProfile(masterProfile, {
    id: 'software-engineering',
    track: 'software-engineering',
    name: 'Software Engineering',
    description: 'Full stack & distributed backend software engineering roles focusing on scalable APIs, async workers, database architecture, and performant web interfaces.',
    headline: 'Senior Full Stack & Systems Engineer | Golang, Python, TypeScript, Distributed Architectures',
    narrativeSummary: 'Full-stack and systems engineer specialized in scalable backend systems, high-throughput email engines, and performant React frontends.',
    targetJobTitles: ['Software Engineer', 'Full Stack Engineer', 'Backend Engineer', 'Systems Engineer'],
    excludedJobTitles: ['Product Manager', 'UX Designer', 'Data Analyst'],
    preferredIndustries: ['Developer Tools', 'B2B SaaS', 'Cloud Infrastructure', 'Fintech'],
    primarySkillNames: ['Golang', 'Python', 'TypeScript', 'PostgreSQL', 'Docker', 'Celery', 'React'],
    secondarySkillNames: ['Redis', 'RabbitMQ', 'Caddy', 'AWS (EC2, SageMaker, Lambda, S3)', 'Fastify', 'Nest.JS'],
    deemphasizedSkillNames: ['Roblox', 'Leadpages'],
    priorityCompanyNames: ['Mission Inbox', 'Shell Eco-Marathon'],
    highlightedProjectNames: ['MI Shield', 'Mission Redirect', 'WeekIt.ai'],
    preferredAccomplishments: [
      'Engineered MI Shield with <50ms outgoing email latency',
      'Purged Mail-in-a-Box for custom Postfix/Dovecot with Postgres',
      'Migrated frontend from React.js to TypeScript + Redux',
    ],
    preferredKeywords: ['high-availability', 'distributed systems', 'low latency', 'concurrency', 'type safety'],
    salaryPreferences: { minimum: '$80,000', target: '$110,000', currency: 'USD', period: 'yearly' },
    locationPreferences: { allowedCountries: ['Canada', 'United States'], preferredCities: ['Toronto', 'Remote'], willingToRelocate: false },
    remotePreferences: { remoteOnly: false, hybridAllowed: true, onSiteAllowed: false, allowedTimezones: ['EST', 'PST', 'CST', 'MST'] },
    seniorityPreferences: { targetLevels: ['Mid-Level', 'Senior'], yearsExperienceClaim: '2+' },
    customResumeInstructions: 'Emphasize architectural decisions, throughput metrics, concurrency in Go, and backend stability.',
    customCoverLetterInstructions: 'Highlight ability to own full lifecycle system development from scratch to production scaling.',
    applicationStrategyRules: ['Prioritize backend and full-stack positions with modern TS/Go/Python stacks.'],
  });
  storage.saveCareerProfile(sweProfile);
  console.log(`✓ Career Profile created: Software Engineering (${sweProfile.id})`);

  // 2. Applied AI / AI Engineering
  const aiProfile = ProfileProjector.createCareerProfile(masterProfile, {
    id: 'applied-ai',
    track: 'applied-ai',
    name: 'Applied AI & AI Engineering',
    description: 'Applied machine learning and AI systems roles focusing on model fine-tuning, computer vision, RAG pipelines, inference optimization, and agentic workflows.',
    headline: 'AI Engineer | Computer Vision, NLP, RAG Pipelines & LLM Deployment',
    narrativeSummary: 'AI engineer experienced in training deep learning models, building RAG pipelines, deploying vision transformers, and integrating real-time inference in production.',
    targetJobTitles: ['AI Engineer', 'Machine Learning Engineer', 'Applied AI Specialist', 'Computer Vision Engineer'],
    excludedJobTitles: ['Sales Engineer', 'Technical Recruiter'],
    preferredIndustries: ['Artificial Intelligence', 'Robotics', 'Enterprise AI', 'HealthTech'],
    primarySkillNames: ['Python', 'PyTorch', 'TensorFlow', 'Transformers', 'Hugging Face', 'RAG pipelines', 'Ollama'],
    secondarySkillNames: ['Golang', 'Scikit-learn', 'Docker', 'Streamlit', 'OpenAI API'],
    deemphasizedSkillNames: ['HubSpot', 'Pipedrive', 'Leadpages'],
    priorityCompanyNames: ['World Wide Fund (WWF)', 'SHRDC', 'Shell Eco-Marathon', 'Mission Inbox'],
    highlightedProjectNames: ['MI Shield', 'Real Estate Image Generation Model', 'Face Verification System', 'WeekIt.ai'],
    preferredAccomplishments: [
      'Implemented Vision Transformers and triple-shot learning for animal re-identification at WWF',
      'Engineered AI-powered OCR automating invoice processing at SHRDC',
      'Developed biometric security system with Siamese networks and CNNs',
      'Created real-time fuel prediction algorithms for Shell Eco-Marathon',
    ],
    preferredKeywords: ['fine-tuning', 'RAG', 'vision transformers', 'neural networks', 'inference latency', 'embeddings'],
    salaryPreferences: { minimum: '$85,000', target: '$120,000', currency: 'USD', period: 'yearly' },
    locationPreferences: { allowedCountries: ['Canada', 'United States'], preferredCities: ['Toronto', 'Remote'], willingToRelocate: false },
    remotePreferences: { remoteOnly: false, hybridAllowed: true, onSiteAllowed: false, allowedTimezones: ['EST', 'PST', 'CST', 'MST'] },
    seniorityPreferences: { targetLevels: ['Mid-Level', 'Senior'], yearsExperienceClaim: '2+' },
    customResumeInstructions: 'Lead with MSc in Computer Science (AI major) and emphasize model architectures, evaluation datasets, and production inference.',
    customCoverLetterInstructions: 'Discuss hands-on research and applied experience deploying deep learning models to solve tangible business problems.',
    applicationStrategyRules: ['Target AI/ML engineering teams with dedicated modeling or RAG pipeline needs.'],
  });
  storage.saveCareerProfile(aiProfile);
  console.log(`✓ Career Profile created: Applied AI (${aiProfile.id})`);

  // 3. Revenue Tech / AI Automation
  const revProfile = ProfileProjector.createCareerProfile(masterProfile, {
    id: 'revenue-tech',
    track: 'revenue-tech',
    name: 'Revenue Tech & AI Automation',
    description: 'Revenue operations, marketing technology, and business automation roles focusing on billing engines, CRM integrations, email deliverability, and automated workflows.',
    headline: 'Revenue-Tech Engineer | Subscription Infrastructure, Deliverability & Automation Pipelines',
    narrativeSummary: 'Specialized in subscription billing architecture, email deliverability infrastructure, CRM pipeline automation, and conversion tracking.',
    targetJobTitles: ['Revenue Engineer', 'RevOps Developer', 'Marketing Automation Engineer', 'Integration Engineer'],
    excludedJobTitles: ['UI/UX Designer', 'Game Developer'],
    preferredIndustries: ['Fintech', 'SaaS', 'E-Commerce Infrastructure', 'Marketing Technology'],
    primarySkillNames: ['Stripe', 'Chargebee', 'Postfix', 'Dovecot', 'Postal', 'HubSpot', 'Attio'],
    secondarySkillNames: ['Pipedrive', 'Vitally (Customer Success)', 'Webflow', 'Celery', 'PostgreSQL', 'RestAPI'],
    deemphasizedSkillNames: ['PyTorch', 'TensorFlow', 'Arduino', 'Raspberry Pi'],
    priorityCompanyNames: ['Mission Inbox'],
    highlightedProjectNames: ['MI Shield', 'Mission Redirect'],
    preferredAccomplishments: [
      'Solely developed all revenue-generating modules with Stripe and Chargebee, increasing MRR by 220%',
      'Created external email infrastructure using Postal with rotating IP pools and deliverability warming',
      'Engineered marketing/CRM pipelines across HubSpot, Attio, Pipedrive, and Vitally',
    ],
    preferredKeywords: ['MRR growth', 'subscription billing', 'email deliverability', 'CRM syncing', 'webhook orchestration'],
    salaryPreferences: { minimum: '$75,000', target: '$100,000', currency: 'USD', period: 'yearly' },
    locationPreferences: { allowedCountries: ['Canada', 'United States'], preferredCities: ['Toronto', 'Remote'], willingToRelocate: false },
    remotePreferences: { remoteOnly: false, hybridAllowed: true, onSiteAllowed: false, allowedTimezones: ['EST', 'PST', 'CST', 'MST'] },
    seniorityPreferences: { targetLevels: ['Mid-Level', 'Senior'], yearsExperienceClaim: '2+' },
    customResumeInstructions: 'Focus heavily on commercial impact, MRR increases, billing lifecycle, deliverability KPIs, and CRM integration reliability.',
    customCoverLetterInstructions: 'Detail experience bridging commercial revenue objectives with robust backend engineering execution.',
    applicationStrategyRules: ['Target growth-stage SaaS companies expanding monetization and sales/marketing tooling.'],
  });
  storage.saveCareerProfile(revProfile);
  console.log(`✓ Career Profile created: Revenue Tech (${revProfile.id})`);

  // 4. Customer Success / Technical Support
  const csProfile = ProfileProjector.createCareerProfile(masterProfile, {
    id: 'customer-success',
    track: 'customer-success',
    name: 'Customer Success & Technical Support',
    description: 'Technical customer success, solution engineering, and client-facing support roles requiring deep technical troubleshooting, customer empathy, and enablement.',
    headline: 'Technical Customer Success Engineer | Solution Architecture, Client Onboarding & Support',
    narrativeSummary: 'Customer-facing technical engineer with extensive background in customer onboarding, troubleshooting complex email/billing infrastructure, and developer advocacy.',
    targetJobTitles: ['Customer Success Engineer', 'Technical Support Engineer', 'Solutions Engineer', 'Implementation Specialist'],
    excludedJobTitles: ['Cold Caller', 'Telemarketer'],
    preferredIndustries: ['Enterprise Software', 'Developer Platforms', 'B2B SaaS'],
    primarySkillNames: ['Vitally (Customer Success)', 'HubSpot', 'Slack', 'VS Code', 'Git', 'RestAPI'],
    secondarySkillNames: ['PostgreSQL', 'Stripe', 'Docker', 'Python', 'JavaScript'],
    deemphasizedSkillNames: ['C++', 'C', 'Kali Linux', 'TensorFlow Extended (TFX)'],
    priorityCompanyNames: ['Mission Inbox', 'Supercoders Academy'],
    highlightedProjectNames: ['MI Shield', 'WeekIt.ai'],
    preferredAccomplishments: [
      'Created and trained an AI bot automating operational workflows and directly supporting customer success',
      'Configured Vitally Customer Success hub and connected client communication pipelines',
      'Taught programming to students, transitioning 78% from part-time to full-time within the first month',
    ],
    preferredKeywords: ['customer satisfaction', 'onboarding velocity', 'technical troubleshooting', 'client advocacy', 'API integrations'],
    salaryPreferences: { minimum: '$65,000', target: '$85,000', currency: 'USD', period: 'yearly' },
    locationPreferences: { allowedCountries: ['Canada', 'United States'], preferredCities: ['Toronto', 'Remote'], willingToRelocate: false },
    remotePreferences: { remoteOnly: false, hybridAllowed: true, onSiteAllowed: false, allowedTimezones: ['EST', 'PST', 'CST', 'MST'] },
    seniorityPreferences: { targetLevels: ['Mid-Level', 'Senior'], yearsExperienceClaim: '2+' },
    customResumeInstructions: 'Highlight technical clarity, patience, root-cause troubleshooting, documentation, and customer success platform experience.',
    customCoverLetterInstructions: 'Demonstrate enthusiasm for demystifying technical complexities for clients and building lasting customer partnerships.',
    applicationStrategyRules: ['Target high-touch technical products and developer platforms.'],
  });
  storage.saveCareerProfile(csProfile);
  console.log(`✓ Career Profile created: Customer Success (${csProfile.id})`);

  storage.close();
  console.log('\n--- Seeding completed successfully! ---');
}

runSeed().catch((err) => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
