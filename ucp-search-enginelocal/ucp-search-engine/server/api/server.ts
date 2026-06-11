/**
 * UCP Search API Server
 * Express entry point with search routes and health checks
 */

import express from 'express';
import cors from 'cors';
import { searchHandler, streamSearchHandler } from './search-controller';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Search endpoints
app.post('/api/search/elastic', searchHandler);
app.post('/api/search/elastic/stream', streamSearchHandler);

// Seed endpoint for demo data
app.post('/api/search/seed', async (req, res) => {
  try {
    const { seedElastic } = await import('./seed-elastic');
    const count = await seedElastic();
    res.json({ seeded: count, message: 'Demo data indexed successfully' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`UCP Search API running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Search:  POST http://localhost:${PORT}/api/search/elastic`);
});
