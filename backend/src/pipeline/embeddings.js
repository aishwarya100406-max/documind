import { pipeline, env } from '@xenova/transformers';

// Cache models on disk so the ~25MB MiniLM weights download only once.
env.allowLocalModels = true;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    console.log(`[embeddings] loading model ${MODEL} (first run downloads weights)…`);
    extractorPromise = pipeline('feature-extraction', MODEL);
  }
  return extractorPromise;
}

/** Generate a single normalized embedding vector (length 384). */
export async function embedOne(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/** Generate embeddings for an array of texts (sequential to bound memory). */
export async function embedMany(texts) {
  const vectors = [];
  for (const text of texts) {
    vectors.push(await embedOne(text));
  }
  return vectors;
}
