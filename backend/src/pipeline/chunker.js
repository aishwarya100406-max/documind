/**
 * Sliding-window chunking.
 *
 * The RAG spec calls for "500 tokens with 50-token overlap". A full BPE
 * tokenizer is overkill here, so we approximate one token ≈ one whitespace
 * token (word/punctuation cluster). This keeps chunk sizes well within the
 * embedding model's 256-token window after sub-word expansion in practice,
 * and is deterministic and dependency-free.
 *
 * @param {string} text
 * @param {number} chunkSize  tokens per chunk (default 500)
 * @param {number} overlap    overlapping tokens between consecutive chunks (default 50)
 * @returns {string[]}
 */
export function chunkText(text, chunkSize = 500, overlap = 50) {
  const tokens = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (tokens.length === 0) return [];
  if (overlap >= chunkSize) overlap = Math.floor(chunkSize / 10);

  const step = chunkSize - overlap;
  const chunks = [];

  for (let start = 0; start < tokens.length; start += step) {
    const slice = tokens.slice(start, start + chunkSize);
    if (slice.length === 0) break;
    chunks.push(slice.join(' '));
    if (start + chunkSize >= tokens.length) break; // last window reached
  }

  return chunks;
}
