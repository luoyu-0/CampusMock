import './env';

import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import routes from './routes';

const app = express();
const port = Number(process.env.PORT) || 3000;
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`CampusMock 已启动：http://localhost:${port}`);
  console.log(`健康检查：http://localhost:${port}/health`);
});
