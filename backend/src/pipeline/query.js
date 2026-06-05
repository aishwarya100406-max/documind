import { embedOne } from './embeddings.js';
import { getOrCreateCollection } from '../chroma/client.js';

/**
 * Retrieve the top-K most similar chunks for a question.
 * Chroma uses cosine distance; we convert to a cosine similarity in [0,1].
 */
export async function retrieve(docId, question, topK = 5) {
  const collection = await getOrCreateCollection(docId);
  const queryEmbedding = await embedOne(question);

  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  const docs = result.documents?.[0] || [];
  const distances = result.distances?.[0] || [];
  const ids = result.ids?.[0] || [];
  const metadatas = result.metadatas?.[0] || [];

  return docs.map((text, i) => ({
    id: ids[i],
    text,
    similarity: clamp01(1 - (distances[i] ?? 1)), // cosine distance → similarity
    chunkIndex: metadatas[i]?.chunk_index ?? i,
    page: metadatas[i]?.page ?? null,
  }));
}

/** Map the best similarity score to a High/Medium/Low relevance label. */
export function confidenceFromChunks(chunks) {
  if (!chunks.length) return { level: 'Low', score: 0 };
  const top = chunks[0].similarity;
  let level = 'Low';
  if (top >= 0.5) level = 'High';
  else if (top >= 0.3) level = 'Medium';
  return { level, score: Number(top.toFixed(3)) };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
