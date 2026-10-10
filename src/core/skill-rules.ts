import { SkillInferenceRule } from '../types/skills.js';

/**
 * Built-in directional skill inference rules:
 * Source Skill -> Recommended Inferred Skill(s)
 * (These represent recommendations, NOT automatic factual claims)
 */
export const DETERMINISTIC_INFERENCE_RULES: SkillInferenceRule[] = [
  // React expansions
  {
    id: 'rule-react-html',
    sourceSkillCanonical: 'React',
    inferredSkillCanonical: 'HTML',
    category: 'frameworks_libraries',
    rationale: 'Extensive React frontend experience inherently demonstrates proficiency with HTML and semantic DOM structure.',
    confidence: 0.95,
    suggestedAliases: ['HTML5', 'HyperText Markup Language'],
  },
  {
    id: 'rule-react-css',
    sourceSkillCanonical: 'React',
    inferredSkillCanonical: 'CSS',
    category: 'frameworks_libraries',
    rationale: 'Building component-based user interfaces with React demonstrates CSS styling and layout mechanics.',
    confidence: 0.95,
    suggestedAliases: ['CSS3', 'Cascading Style Sheets'],
  },
  {
    id: 'rule-react-js',
    sourceSkillCanonical: 'React',
    inferredSkillCanonical: 'JavaScript',
    category: 'programming_languages',
    rationale: 'React development is directly built on core JavaScript language principles.',
    confidence: 0.99,
    suggestedAliases: ['JS', 'ES6+'],
  },
  {
    id: 'rule-react-component-ui',
    sourceSkillCanonical: 'React',
    inferredSkillCanonical: 'Component-Based UI Architecture',
    category: 'methodologies',
    rationale: 'React architecture is fundamentally built on reusable component design patterns.',
    confidence: 0.9,
    suggestedAliases: ['Component Architecture', 'Modular UI'],
  },

  // Database expansions
  {
    id: 'rule-postgres-sql',
    sourceSkillCanonical: 'PostgreSQL',
    inferredSkillCanonical: 'SQL',
    category: 'databases',
    rationale: 'Designing relational schemas and managing PostgreSQL instances implies strong mastery of standard SQL querying.',
    confidence: 0.98,
    suggestedAliases: ['Structured Query Language'],
  },

  // Backend framework expansions
  {
    id: 'rule-django-python',
    sourceSkillCanonical: 'Django',
    inferredSkillCanonical: 'Python',
    category: 'programming_languages',
    rationale: 'Django backend development is written entirely in Python.',
    confidence: 0.99,
    suggestedAliases: ['Python 3'],
  },
  {
    id: 'rule-fastify-node',
    sourceSkillCanonical: 'Fastify',
    inferredSkillCanonical: 'Node.js',
    category: 'frameworks_libraries',
    rationale: 'Fastify is a high-performance web framework for the Node.js runtime.',
    confidence: 0.98,
    suggestedAliases: ['NodeJS', 'Node'],
  },

  // AI & ML expansions
  {
    id: 'rule-pytorch-python',
    sourceSkillCanonical: 'PyTorch',
    inferredSkillCanonical: 'Python',
    category: 'programming_languages',
    rationale: 'PyTorch deep learning model engineering requires advanced Python programming.',
    confidence: 0.98,
    suggestedAliases: ['Python 3'],
  },
  {
    id: 'rule-pytorch-deep-learning',
    sourceSkillCanonical: 'PyTorch',
    inferredSkillCanonical: 'Deep Learning',
    category: 'ai_ml',
    rationale: 'Building models in PyTorch is foundational deep learning and neural network engineering.',
    confidence: 0.95,
    suggestedAliases: ['Neural Networks', 'DL'],
  },

  // DevOps expansions
  {
    id: 'rule-docker-containerization',
    sourceSkillCanonical: 'Docker',
    inferredSkillCanonical: 'Containerization',
    category: 'cloud_infrastructure',
    rationale: 'Creating and managing Docker containers is the industry standard containerization practice.',
    confidence: 0.95,
    suggestedAliases: ['Containers', 'Linux Containers'],
  },
  {
    id: 'rule-aws-ec2-cloud',
    sourceSkillCanonical: 'AWS (EC2, SageMaker, Lambda, S3)',
    inferredSkillCanonical: 'Cloud Infrastructure',
    category: 'cloud_infrastructure',
    rationale: 'Configuring EC2, Lambda, S3, and SageMaker constitutes end-to-end cloud infrastructure management.',
    confidence: 0.95,
    suggestedAliases: ['Cloud Computing', 'Cloud Architecture'],
  },

  // REST expansions
  {
    id: 'rule-rest-api',
    sourceSkillCanonical: 'RestAPI',
    inferredSkillCanonical: 'REST',
    category: 'developer_tools',
    rationale: 'Engineering REST APIs represents knowledge of REST architectural constraints.',
    confidence: 0.99,
    suggestedAliases: ['REST API', 'RESTful API'],
  },
];
