import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { ensureDirs } from './src/util/paths.js';
import { initDb } from './src/db/sqlite.js';
import documentsRouter from './src/routes/documents.js';
import chatRouter from './src/routes/chat.js';

ensureDirs();
initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'documind' }));
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

// Centralized error handler (catches multer file-size / file-type errors etc.)
app.use((err, req, res, next) => {
  if (!err) return next();
  console.error('[error]', err.message);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  res.status(status).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🧠 DocuMind backend running on http://localhost:${PORT}`);
  console.log(`   ChromaDB expected at ${process.env.CHROMA_URL || 'http://localhost:8001'}`);
  if (!process.env.GROQ_API_KEY) console.warn('   ⚠️  GROQ_API_KEY is not set — chat & summaries will fail.');
});
