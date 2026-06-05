import { getDb } from '../db/sqlite.js';
import { completeAnswer } from './groq.js';

/**
 * Page-wise auto-summary. Reads the per-page text captured at ingestion time
 * (stored in SQLite as `pages_json`) and asks Groq for a per-page summary that
 * covers all the important points, including any formulas/equations.
 *
 * This deliberately does NOT re-fetch from the vector DB — Chroma Cloud rejects
 * the older client's bulk `get()` call, and the source text is the better basis
 * for a summary anyway.
 */
export async function summarizeDocument(docId) {
  const row = getDb().prepare('SELECT pages_json FROM documents WHERE id = ?').get(docId);

  let pages;
  try {
    pages = row?.pages_json ? JSON.parse(row.pages_json) : null;
  } catch {
    pages = null;
  }

  if (!pages || pages.length === 0) {
    throw new Error('No document text available to summarize (re-upload the document)');
  }

  let context = '';
  pages.forEach((text, i) => {
    context += `\n=== Page ${i + 1} ===\n${text}\n`;
  });
  // llama-3.1-8b-instant has a large (128k) context window, so we can include a lot.
  context = context.slice(0, 60000);

  return completeAnswer(
    [
      {
        role: 'system',
        content:
          'You write a clear, page-by-page summary of a document. For EACH page that appears ' +
          'in the context, output a heading line "Page N:" followed by 2-5 concise bullet ' +
          'points (each starting with "- ") that cover all the important points, definitions, ' +
          'formulas, and key details on that page. Reproduce any formulas or equations verbatim. ' +
          'Do not invent pages or content that is not present. Output only the headings and bullets.',
      },
      {
        role: 'user',
        content: `Summarize this document page by page, covering all important points:\n${context}`,
      },
    ],
    0.3
  );
}
