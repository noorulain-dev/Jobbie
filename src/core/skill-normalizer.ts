/**
 * Deterministic Skill Normalization Dictionary & Resolver
 * Maps all known variations, acronyms, and casing to canonical naming.
 */
export const CANONICAL_SKILL_MAP: Record<string, { canonical: string; aliases: string[] }> = {
  // Frontend
  react: { canonical: 'React', aliases: ['React.js', 'ReactJS', 'React js', 'React library'] },
  'react-native': { canonical: 'React Native', aliases: ['React Native', 'ReactNative', 'RN'] },
  'next.js': { canonical: 'Next.js', aliases: ['Nextjs', 'Next.JS', 'Next JS'] },
  'vue.js': { canonical: 'Vue.js', aliases: ['Vue', 'Vuejs', 'VueJS'] },
  html: { canonical: 'HTML', aliases: ['HTML5', 'HyperText Markup Language', 'HTML 5'] },
  css: { canonical: 'CSS', aliases: ['CSS3', 'Cascading Style Sheets', 'CSS 3'] },
  'tailwind css': { canonical: 'Tailwind CSS', aliases: ['Tailwind', 'TailwindCSS', 'Tailwind-CSS'] },

  // JavaScript / TypeScript / Node
  javascript: { canonical: 'JavaScript', aliases: ['JS', 'ES6', 'ES6+', 'ECMAScript', 'Vanilla JS'] },
  typescript: { canonical: 'TypeScript', aliases: ['TS', 'TypeScript 5', 'Type Script'] },
  'node.js': { canonical: 'Node.js', aliases: ['Node', 'NodeJS', 'Node js', 'Node.JS'] },
  fastify: { canonical: 'Fastify', aliases: ['Fastify.js', 'FastifyJS'] },
  'nest.js': { canonical: 'Nest.JS', aliases: ['NestJS', 'Nest.js', 'Nest js'] },

  // Backend / Languages
  python: { canonical: 'Python', aliases: ['Python 3', 'Python3', 'Py'] },
  golang: { canonical: 'Golang', aliases: ['Go', 'Go Language', 'Golang language'] },
  django: { canonical: 'Django', aliases: ['Django REST Framework', 'DRF'] },
  fastapi: { canonical: 'FastAPI', aliases: ['FastAPI framework'] },

  // Databases & Storage
  postgresql: { canonical: 'PostgreSQL', aliases: ['Postgres', 'Postgres DB', 'PostgreSQL DB', 'psql'] },
  sql: { canonical: 'SQL', aliases: ['Structured Query Language', 'Standard SQL', 'ANSI SQL'] },
  mongodb: { canonical: 'MongoDB', aliases: ['Mongo', 'MongoDB Atlas'] },
  sqlite: { canonical: 'SQLite', aliases: ['SQLite3', 'SQLite 3'] },
  redis: { canonical: 'Redis', aliases: ['Redis Cache', 'Redis DB'] },

  // Cloud & DevOps
  docker: { canonical: 'Docker', aliases: ['Docker Engine', 'Docker Compose', 'Containers', 'Containerization'] },
  kubernetes: { canonical: 'Kubernetes', aliases: ['K8s', 'K8S'] },
  aws: { canonical: 'AWS', aliases: ['Amazon Web Services', 'AWS Cloud'] },
  'aws ec2': { canonical: 'AWS EC2', aliases: ['EC2', 'Amazon EC2', 'AWS Elastic Compute Cloud'] },
  'aws s3': { canonical: 'AWS S3', aliases: ['S3', 'Amazon S3', 'AWS Simple Storage Service'] },
  gcp: { canonical: 'GCP', aliases: ['Google Cloud Platform', 'Google Cloud'] },

  // AI & ML
  pytorch: { canonical: 'PyTorch', aliases: ['Torch', 'PyTorch framework'] },
  tensorflow: { canonical: 'TensorFlow', aliases: ['TF', 'TensorFlow 2'] },
  'deep learning': { canonical: 'Deep Learning', aliases: ['DL', 'Deep Neural Networks', 'DNN'] },
  'machine learning': { canonical: 'Machine Learning', aliases: ['ML', 'Applied ML'] },

  // API & Networking
  rest: { canonical: 'REST', aliases: ['REST API', 'RESTful API', 'RestAPI', 'REST APIs', 'RESTful Services'] },
  graphql: { canonical: 'GraphQL', aliases: ['GQL'] },
};

/**
 * Normalizes any raw skill string to its canonical representation.
 */
export function normalizeSkillName(rawName: string): { canonical: string; aliases: string[] } {
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match on key
  if (CANONICAL_SKILL_MAP[lower]) {
    return CANONICAL_SKILL_MAP[lower];
  }

  // 2. Check if lower matches any alias in the dictionary
  for (const entry of Object.values(CANONICAL_SKILL_MAP)) {
    if (entry.canonical.toLowerCase() === lower) {
      return entry;
    }
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === lower) {
        return entry;
      }
    }
  }

  // 3. Normalized fallback: clean extra whitespace
  return {
    canonical: trimmed,
    aliases: [],
  };
}
