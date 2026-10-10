import { createCareerBrainServer } from '../server/index.js';

const port = process.env.JOBBY_PORT ? parseInt(process.env.JOBBY_PORT, 10) : 3141;
const host = process.env.JOBBY_HOST || '127.0.0.1';

const app = createCareerBrainServer({ port, host });
await app.listen();
