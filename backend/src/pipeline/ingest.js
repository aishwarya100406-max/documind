import fs from 'fs';
import path from 'path';
// unpdf bundles a current build of Mozilla's pdf.js and works on modern Node.
// (The originally-specced `pdf-parse` ships a 2018 pdf.js that throws on Node 24.)
import { getDocumentProxy, extractText } from 'unpdf';
import mammoth from 'mammoth';

import { chunkText } from './chunker.js';
import { embedMany } from './embeddings.js';
import { getOrCreateCollection } from '../chroma/client.js';
import { getDb } from '../db/sqlite.js';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];

/**
 * Extract text from a supported document as an array of "pages".
 * Only PDFs have real page boundaries; other formats are returned as a single
 * page (page 1), so page-wise features degrade gracefully for them.
 */
async function extractPages(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await getDocumentProxy(buffer);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { pageTexts: text, totalPages };
  }
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return { pageTexts: [value || ''], totalPages: 1 };
  }
  if (ext === '.txt' || ext === '.md') {
    return { pageTexts: [fs.readFileSync(filePath, 'utf8')], totalPages: 1 };
  }
  throw new Error(`Unsupported file type "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
}

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
    const { pageTexts, totalPages } = await extractPages(filePath);

    // { text, page } — chunk each page separately to preserve page boundaries.
    const chunks = [];
    pageTexts.forEach((pageText, idx) => {
      for (const c of chunkText(pageText, 500, 50)) {
        chunks.push({ text: c, page: idx + 1 });
      }
    });

    if (chunks.length === 0) {
      throw new Error(
        'No extractable text found — this looks like a scanned or image-only file. ' +
          'DocuMind reads the text layer of a document; OCR the file first, or upload a text-based version.'
      );
    }

    const texts = chunks.map((c) => c.text);
    const embeddings = await embedMany(texts);

    const collection = await getOrCreateCollection(docId);
    const ids = chunks.map((_, i) => `${docId}_chunk_${i}`);
    const metadatas = chunks.map((c, i) => ({ chunk_index: i, page: c.page, doc_id: docId }));

    await collection.add({ ids, embeddings, documents: texts, metadatas });

    // Persist per-page text so summaries don't have to re-fetch from the vector DB.
    db.prepare(
      'UPDATE documents SET chunk_count = ?, pages = ?, pages_json = ?, status = ? WHERE id = ?'
    ).run(chunks.length, totalPages, JSON.stringify(pageTexts), 'ready', docId);

    console.log(`[ingest] ${docId} ready — ${chunks.length} chunks across ${totalPages} page(s)`);
    return { chunkCount: chunks.length, pages: totalPages };
  } catch (err) {
    db.prepare('UPDATE documents SET status = ?, error_message = ? WHERE id = ?')
      .run('error', err.message, docId);
    console.error(`[ingest] ${docId} failed: ${err.message}`);
    throw err;
  }
}
