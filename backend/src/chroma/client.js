import { ChromaClient } from 'chromadb';
import { embedMany } from '../pipeline/embeddings.js';

/**
 * Chroma requires every collection to carry an embedding function. We supply
 * one backed by our local MiniLM embedder so the collection is self-consistent,
 * even though the ingest pipeline passes precomputed embeddings directly.
 */
class LocalEmbeddingFunction {
  async generate(texts) {
    return embedMany(texts);
  }
}
const embeddingFunction = new LocalEmbeddingFunction();

let client = null;

export function getChroma() {
  if (!client) {
    client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8001' });
  }
  return client;
}

/** Collection name per document — must be 3-63 chars, alphanumeric bounded. */
export function collectionName(docId) {
  return `doc_${String(docId).replace(/-/g, '')}`;
}

export async function getOrCreateCollection(docId) {
  return getChroma().getOrCreateCollection({
    name: collectionName(docId),
    embeddingFunction,
    metadata: { 'hnsw:space': 'cosine' },
  });
}

export async function deleteCollection(docId) {
  try {
    await getChroma().deleteCollection({ name: collectionName(docId) });
  } catch (e) {
    // Collection may not exist (e.g. ingest failed) — safe to ignore.
    console.warn(`[chroma] deleteCollection(${docId}): ${e.message}`);
  }
}

export async function pingChroma() {
  try {
    await getChroma().heartbeat();
    return true;
  } catch {
    return false;
  }
}
