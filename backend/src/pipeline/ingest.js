import fs from 'fs';
// unpdf bundles a current build of Mozilla's pdf.js and works on modern Node.
// (The originally-specced `pdf-parse` ships a 2018 pdf.js that throws on Node 24.)
import { getDocumentProxy, extractText } from 'unpdf';

import { chunkText } from './chunker.js';
import { embedMany } from './embeddings.js';
import { getOrCreateCollection } from '../chroma/client.js';
import { getDb } from '../db/sqlite.js';

/**
 * Full ingestion pipeline for one uploaded PDF:
 *   parse per-page → chunk (500/50 sliding window) → embed → store in Chroma → mark ready
 *
 * Each page is chunked independently so every chunk carries the page number it
 * came from. That powers page-aware retrieval, page citations, and page-wise summaries.
 */
export async function ingestDocument(docId, filePath) {
  const db = getDb();
  try {
    const buffer = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text: pageTexts } = await extractText(pdf, { mergePages: false });

    // { text, page } — chunk each page separately to preserve page boundaries.
    const chunks = [];
    pageTexts.forEach((pageText, idx) => {
      for (const c of chunkText(pageText, 500, 50)) {
        chunks.push({ text: c, page: idx + 1 });
      }
    });

    if (chunks.length === 0) {
      throw new Error('No extractable text found in PDF (it may be scanned/image-only).');
    }

    const texts = chunks.map((c) => c.text);
    const embeddings = await embedMany(texts);

    const collection = await getOrCreateCollection(docId);
    const ids = chunks.map((_, i) => `${docId}_chunk_${i}`);
    const metadatas = chunks.map((c, i) => ({ chunk_index: i, page: c.page, doc_id: docId }));

    await collection.add({ ids, embeddings, documents: texts, metadatas });

    db.prepare('UPDATE documents SET chunk_count = ?, pages = ?, status = ? WHERE id = ?')
      .run(chunks.length, totalPages, 'ready', docId);

    console.log(`[ingest] ${docId} ready — ${chunks.length} chunks across ${totalPages} page(s)`);
    return { chunkCount: chunks.length, pages: totalPages };
  } catch (err) {
    db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('error', docId);
    console.error(`[ingest] ${docId} failed: ${err.message}`);
    throw err;
  }
}
