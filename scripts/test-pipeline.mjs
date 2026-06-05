// End-to-end test of ingestion + retrieval (no Groq needed).
import { randomUUID } from 'crypto';
import { ensureDirs } from '../backend/src/util/paths.js';
import { initDb, getDb } from '../backend/src/db/sqlite.js';
import { ingestDocument } from '../backend/src/pipeline/ingest.js';
import { retrieve, confidenceFromChunks } from '../backend/src/pipeline/query.js';
import { deleteCollection } from '../backend/src/chroma/client.js';

process.env.CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8001';

ensureDirs();
initDb();
const db = getDb();

const id = randomUUID();
db.prepare('INSERT INTO documents (id, filename, upload_date, chunk_count, status) VALUES (?,?,?,?,?)')
  .run(id, 'sample.pdf', new Date().toISOString(), 0, 'processing');

console.log('→ ingesting…');
const { chunkCount } = await ingestDocument(id, new URL('../sample.pdf', import.meta.url).pathname.replace(/^\//, ''));
const row = db.prepare('SELECT status, chunk_count FROM documents WHERE id=?').get(id);
console.log('→ document row:', row, '(chunkCount', chunkCount + ')');

for (const q of ['What is the capital of France?', 'How many legs does a spider have?']) {
  const chunks = await retrieve(id, q, 5);
  const conf = confidenceFromChunks(chunks);
  console.log(`\nQ: ${q}`);
  console.log('  confidence:', conf.level, '(top sim', conf.score + ')');
  console.log('  top chunk:', JSON.stringify(chunks[0]?.text.slice(0, 90)));
}

await deleteCollection(id);
db.prepare('DELETE FROM documents WHERE id=?').run(id);
console.log('\n✅ pipeline test complete; cleaned up.');
