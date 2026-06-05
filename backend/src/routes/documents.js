import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { UPLOAD_DIR } from '../util/paths.js';
import { getDb } from '../db/sqlite.js';
import { ingestDocument, SUPPORTED_EXTENSIONS } from '../pipeline/ingest.js';
import { deleteCollection } from '../chroma/client.js';
import { summarizeDocument } from '../services/summarize.js';

const router = express.Router();

// Max upload size in MB. Configurable via env — keep it modest on small
// instances (e.g. Render free 512MB), since the whole file is parsed + embedded
// in memory during ingestion.
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 50);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = req._docId || (req._docId = uuidv4());
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) cb(null, true);
    else
      cb(
        new Error(
          `Unsupported file type "${ext || file.originalname}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
        )
      );
  },
});

// POST /api/documents/upload — ingest pipeline (async processing)
router.post('/upload', upload.single('file'), async (req, res) => {
  const db = getDb();
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const id = req._docId;
  const record = {
    id,
    filename: req.file.originalname,
    upload_date: new Date().toISOString(),
    chunk_count: 0,
    status: 'processing',
    summary: null,
  };

  db.prepare(
    'INSERT INTO documents (id, filename, upload_date, chunk_count, status) VALUES (?, ?, ?, ?, ?)'
  ).run(record.id, record.filename, record.upload_date, 0, 'processing');

  // Respond immediately; ingest + auto-summary run in the background.
  res.status(201).json(record);

  ingestDocument(id, req.file.path)
    .then(async () => {
      try {
        const summary = await summarizeDocument(id);
        db.prepare('UPDATE documents SET summary = ? WHERE id = ?').run(summary, id);
        console.log(`[summary] generated for ${id}`);
      } catch (e) {
        console.error(`[summary] failed for ${id}: ${e.message}`);
      }
    })
    .catch((e) => console.error(`[upload] ingest failed for ${id}: ${e.message}`));
});

// GET /api/documents — list all
router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM documents ORDER BY upload_date DESC').all();
  res.json(rows);
});

// DELETE /api/documents/:id — remove from Chroma + SQLite + filesystem
router.delete('/:id', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });

  await deleteCollection(req.params.id);
  db.prepare('DELETE FROM chat_history WHERE doc_id = ?').run(req.params.id);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);

  // Remove the stored file regardless of its extension (pdf/docx/txt/md).
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (f.startsWith(`${req.params.id}.`)) fs.unlinkSync(path.join(UPLOAD_DIR, f));
  }

  res.json({ ok: true });
});

// POST /api/documents/:id/summarize — (re)generate summary on demand
router.post('/:id/summarize', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  if (row.status !== 'ready') return res.status(400).json({ error: 'Document is not ready yet' });

  try {
    const summary = await summarizeDocument(req.params.id);
    db.prepare('UPDATE documents SET summary = ? WHERE id = ?').run(summary, req.params.id);
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
