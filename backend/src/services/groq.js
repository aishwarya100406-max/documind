import Groq from 'groq-sdk';

// Groq decommissioned `llama3-8b-8192`; `llama-3.1-8b-instant` is its successor.
const MODEL = 'llama-3.1-8b-instant';
let groq = null;

export function getGroq() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

/** Build the RAG prompt from retrieved chunks. */
export function buildPrompt(question, chunks) {
  const context = chunks
    .map((c) => `[Page ${c.page ?? '?'} · Chunk ${c.chunkIndex}]\n${c.text}`)
    .join('\n\n---\n\n');

  const system =
    'You are DocuMind, a precise document-intelligence assistant. ' +
    'Answer the question using the provided context chunks, which are labelled with ' +
    'their page numbers. Use whatever relevant information the context contains, even if ' +
    'it only partially covers the question — answer with what is available rather than ' +
    'refusing. Cite page numbers in parentheses, e.g. "(p. 3)". Preserve any formulas or ' +
    'equations verbatim. Only if the context contains NOTHING relevant at all, reply exactly: ' +
    '"I couldn\'t find relevant information in this document." Never invent facts that are not in the context.';

  const user = `Context:\n${context}\n\nQuestion: ${question}`;
  return { system, user };
}

/** Async generator yielding answer tokens streamed from Groq. */
export async function* streamAnswer(question, chunks) {
  const { system, user } = buildPrompt(question, chunks);
  const stream = await getGroq().chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    stream: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content || '';
    if (token) yield token;
  }
}

/** Non-streaming completion (used for summaries). */
export async function completeAnswer(messages, temperature = 0.3) {
  const res = await getGroq().chat.completions.create({
    model: MODEL,
    temperature,
    messages,
  });
  return res.choices?.[0]?.message?.content?.trim() || '';
}
