import { createCareerBrainServer } from '../server/index.js';

const port = process.env.JOBBY_PORT ? parseInt(process.env.JOBBY_PORT, 10) : 3141;
const host = process.env.JOBBY_HOST || '127.0.0.1';

try {
  const app = createCareerBrainServer({ port, host });
  await app.listen();
} catch (err: any) {
  if (err.code === 'EADDRINUSE') {
    console.error(`[startup] Port ${port} is already in use. Stop the other process or set JOBBY_PORT in .env.`);
  } else {
    console.error('[startup] Failed to start server:', err.message);
  }
  process.exit(1);
}
