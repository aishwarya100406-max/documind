import express from 'express';
import { getDb } from '../db/sqlite.js';
import { retrieve, confidenceFromChunks } from '../pipeline/query.js';
import { streamAnswer } from '../services/groq.js';

const router = express.Router();

// Below this top-similarity we treat the doc as having no signal and refuse.
// Kept low on purpose: MiniLM scores legitimately relevant (and especially
// broad / "summarize" / "page by page") questions well under 0.3. The system
// prompt is what actually prevents hallucination — this is just a zero-signal guard.
// Override with RELEVANCE_THRESHOLD in .env if you want it stricter/looser.
const RELEVANCE_THRESHOLD = Number(process.env.RELEVANCE_THRESHOLD ?? 0.1);

// Retrieve a few extra chunks so broad questions ("explain each formula") have
// enough context to work with.
const TOP_K = Number(process.env.CHAT_TOP_K ?? 8);

// POST /api/chat/:docId — query pipeline, streamed as newline-delimited JSON
router.post('/:docId', async (req, res) => {
  const { docId } = req.params;
  const { question } = req.body || {};
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.status !== 'ready') return res.status(400).json({ error: 'Document is still processing' });
  if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });

  // Streaming headers (NDJSON: one JSON object per line)
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  // Persist the user's question
  db.prepare(
    'INSERT INTO chat_history (doc_id, role, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(docId, 'user', question, new Date().toISOString());

  try {
    const chunks = await retrieve(docId, question, TOP_K);
    const topSim = chunks[0]?.similarity ?? 0;

    // No relevant context → refuse instead of hallucinating
    if (!chunks.length || topSim < RELEVANCE_THRESHOLD) {
      const msg = "I couldn't find relevant information in this document.";
      send({ type: 'sources', sources: [], confidence: { level: 'Low', score: Number(topSim.toFixed(3)) } });
      send({ type: 'token', content: msg });
      send({ type: 'done' });
      res.end();
      db.prepare(
        'INSERT INTO chat_history (doc_id, role, content, sources, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(docId, 'assistant', msg, JSON.stringify([]), 'Low', new Date().toISOString());
      return;
    }

    const confidence = confidenceFromChunks(chunks);
    const sources = chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      page: c.page,
      text: c.text,
      similarity: Number(c.similarity.toFixed(3)),
    }));

    send({ type: 'sources', sources, confidence });

    let full = '';
    for await (const token of streamAnswer(question, chunks)) {
      full += token;
      send({ type: 'token', content: token });
    }
    send({ type: 'done' });
    res.end();

    db.prepare(
      'INSERT INTO chat_history (doc_id, role, content, sources, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(docId, 'assistant', full, JSON.stringify(sources), confidence.level, new Date().toISOString());
  } catch (e) {
    console.error('[chat] error:', e.message);
    try {
      send({ type: 'error', error: e.message });
      res.end();
    } catch {
      /* response already closed */
    }
  }
});

// GET /api/chat/:docId/history
router.get('/:docId/history', (req, res) => {
  const rows = getDb()
    .prepare('SELECT * FROM chat_history WHERE doc_id = ? ORDER BY id ASC')
    .all(req.params.docId);
  res.json(rows.map((r) => ({ ...r, sources: r.sources ? JSON.parse(r.sources) : null })));
});

// DELETE /api/chat/:docId/history — "Clear chat"
router.delete('/:docId/history', (req, res) => {
  getDb().prepare('DELETE FROM chat_history WHERE doc_id = ?').run(req.params.docId);
  res.json({ ok: true });
});

export default router;
