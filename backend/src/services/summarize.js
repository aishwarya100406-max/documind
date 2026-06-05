import { getOrCreateCollection } from '../chroma/client.js';
import { completeAnswer } from './groq.js';

/**
 * Page-wise auto-summary: pull every chunk from Chroma, group the text back
 * together by page, and ask Groq for a per-page summary that covers all the
 * important points (including any formulas/equations) on each page.
 */
export async function summarizeDocument(docId) {
  const collection = await getOrCreateCollection(docId);
  const data = await collection.get({ limit: 5000 });
  const docs = data.documents || [];
  const metas = data.metadatas || [];

  if (docs.length === 0) {
    throw new Error('No chunks available to summarize');
  }

  // Group chunk text by page, preserving in-page chunk order.
  const byPage = new Map();
  docs.forEach((text, i) => {
    const page = metas[i]?.page ?? 1;
    const chunkIndex = metas[i]?.chunk_index ?? i;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push([chunkIndex, text]);
  });

  const pages = [...byPage.keys()].sort((a, b) => a - b);
  let context = '';
  for (const page of pages) {
    const pageText = byPage
      .get(page)
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1])
      .join(' ');
    context += `\n=== Page ${page} ===\n${pageText}\n`;
  }
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
