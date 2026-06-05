# 🧠 DocuMind — RAG Document Intelligence

Upload documents (PDF, Word, text/markdown), then chat with them. DocuMind runs a full Retrieval-Augmented
Generation pipeline: PDFs are parsed, chunked, embedded **locally** (no embedding
API cost), and stored in **ChromaDB**. Questions retrieve the most relevant chunks
and stream an answer from **Groq (llama-3.1-8b-instant)** — with cited source chunks and a
relevance/confidence indicator.

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Frontend     | React (Vite) + Tailwind CSS                       |
| Backend      | Node.js + Express (ESM)                            |
| Vector DB    | ChromaDB (local Python HTTP server, port 8001)    |
| Embeddings   | `@xenova/transformers` — `Xenova/all-MiniLM-L6-v2` (runs locally) |
| LLM          | Groq API — `llama-3.1-8b-instant` (streaming; `llama3-8b-8192` was decommissioned) |
| Metadata DB  | SQLite via `better-sqlite3`                        |
| File parsing | `unpdf` (PDF), `mammoth` (DOCX), plain read (TXT/MD) |
| File storage | local `backend/uploads/`                          |

## How the RAG pipeline works

**Ingestion (on upload)**
1. Parse PDF text with `unpdf` (bundles a current pdf.js build).
2. Sliding-window chunking — **500 tokens** per chunk, **50-token overlap**.
3. Embed each chunk locally (MiniLM, 384-dim, normalized).
4. Store chunks + embeddings in a per-document ChromaDB collection (`cosine` space).
5. Save metadata to SQLite (`id, filename, upload_date, chunk_count, status`).
6. Auto-generate a 5-bullet summary via Groq and attach it to the document card.

**Query (on question)**
1. Embed the question with the same model.
2. Retrieve the **top 5** chunks by cosine similarity from ChromaDB.
3. If the best similarity `< 0.3`, refuse with *"I couldn't find relevant
   information in this document."* instead of hallucinating.
4. Otherwise build `system + context + question` and **stream** the Groq answer.
5. Persist the Q&A (with cited sources + confidence) to SQLite.

Confidence label is derived from the top similarity score:
`≥ 0.6 → High`, `≥ 0.4 → Medium`, else `Low`.

## Project layout

```
documind/
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── chroma/client.js        # ChromaDB connection + local embedding fn
│   │   ├── pipeline/
│   │   │   ├── chunker.js          # sliding-window chunking
│   │   │   ├── embeddings.js       # MiniLM local embeddings
│   │   │   ├── ingest.js           # parse → chunk → embed → store
│   │   │   └── query.js            # retrieve + confidence
│   │   ├── services/
│   │   │   ├── groq.js             # prompt build + streaming + completion
│   │   │   └── summarize.js        # auto 5-bullet summary
│   │   ├── routes/
│   │   │   ├── documents.js        # upload / list / delete / summarize
│   │   │   └── chat.js             # streaming query + history
│   │   ├── db/sqlite.js
│   │   └── util/paths.js
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx
        ├── api.js                  # fetch + XHR upload + NDJSON stream parser
        └── components/             # Sidebar, DocumentCard, ChatWindow, Sources, ...
```

## Setup

Prerequisites: **Node 18+**, **Python 3.9+** (for ChromaDB), and a free
[Groq API key](https://console.groq.com/keys).

```bash
# macOS / Linux
bash setup.sh
```

```powershell
# Windows (PowerShell)
./setup.ps1
```

This installs Node deps for both packages, installs `chromadb`, and creates
`backend/.env` from the example. **Edit `backend/.env` and set `GROQ_API_KEY`.**

## Running (3 terminals)

```bash
# 1 — ChromaDB vector server
chroma run --port 8001

# 2 — backend API
cd backend && npm start          # http://localhost:3001

# 3 — frontend
cd frontend && npm run dev       # http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend.

> First chat/upload triggers a one-time ~25MB download of the MiniLM embedding
> model; subsequent runs use the on-disk cache.

## Environment variables (`backend/.env`)

```
GROQ_API_KEY=...                  # required
PORT=3001
CHROMA_URL=http://localhost:8001
```

## REST API

| Method | Route                            | Description                          |
| ------ | -------------------------------- | ------------------------------------ |
| POST   | `/api/documents/upload`          | Upload PDF/DOCX/TXT/MD (≤`MAX_UPLOAD_MB`, default 50) → ingest |
| GET    | `/api/documents`                 | List documents                       |
| DELETE | `/api/documents/:id`             | Delete (Chroma + SQLite + file)      |
| POST   | `/api/documents/:id/summarize`   | (Re)generate 5-bullet summary        |
| POST   | `/api/chat/:docId`               | Ask a question (streamed NDJSON)     |
| GET    | `/api/chat/:docId/history`       | Chat history for a document          |
| DELETE | `/api/chat/:docId/history`       | Clear chat history                   |

### Streaming format

`POST /api/chat/:docId` responds with newline-delimited JSON:

```
{"type":"sources","sources":[...],"confidence":{"level":"High","score":0.71}}
{"type":"token","content":"The "}
{"type":"token","content":"document "}
...
{"type":"done"}
```

## Deploy to Render (free)

DocuMind deploys as **one free Render web service** (Express serves the API *and* the
built React app) plus **Chroma Cloud** (free tier) for the vector DB. The repo includes
a `render.yaml` blueprint.

**1. Create a free Chroma Cloud database** → https://trychroma.com
   - Sign up, create a database named `documind`, and copy your **API key**, **tenant
     ID**, and **database name**.

**2. Push this repo to GitHub** (Render deploys from a Git host).

**3. Create the Render service**
   - Render dashboard → **New → Blueprint** → pick your GitHub repo. Render reads
     `render.yaml` and creates the `documind` web service.
   - When prompted, fill in the secret env vars:
     - `GROQ_API_KEY` — your Groq key
     - `CHROMA_API_KEY` / `CHROMA_TENANT` — from Chroma Cloud
   - (`CHROMA_DATABASE`, `NODE_ENV`, `RELEVANCE_THRESHOLD` are preset in the blueprint.)
   - Deploy. Build runs `npm run build` (installs + builds frontend, installs backend);
     start runs `npm start`. Render injects `PORT` automatically.

**4. Open the service URL** — the React app and `/api` are served from the same origin.

### Free-tier caveats
- **RAM:** the local MiniLM embedder loads into memory; Render free is **512 MB**, which
  is tight and *may* OOM. If you see out-of-memory restarts, either upgrade to the
  **Starter** instance or switch embeddings to a hosted API.
- **Storage is ephemeral:** SQLite (`backend/data`) and uploaded PDFs reset on each
  deploy/sleep. **Vectors in Chroma Cloud persist.** For durable docs/history, add a
  Render persistent disk (paid).
- **Cold starts:** free services sleep after ~15 min idle; first request wakes it (slow)
  and re-downloads the ~25 MB embedding model.

## Notes & troubleshooting

- **ChromaDB not reachable** → locally, ensure `chroma run --port 8001` is running and
  `CHROMA_URL` matches. In production, set `CHROMA_API_KEY`/`CHROMA_TENANT` (Chroma Cloud).
- **Chat fails immediately** → `GROQ_API_KEY` missing/invalid in `backend/.env`.
- **"No extractable text"** → the PDF is likely scanned/image-only (no OCR here).
- **Short docs always get "couldn't find relevant information"** → a document
  shorter than ~500 tokens becomes a *single* coarse chunk that mixes every topic,
  so per-question cosine similarity falls below the `0.3` refusal threshold. This is
  expected; multi-page PDFs chunk far more granularly and score higher. Tune the
  threshold in `backend/src/routes/chat.js` (`RELEVANCE_THRESHOLD`) if needed.
- Chunk "tokens" are approximated as whitespace tokens (deterministic, dependency-free).
- `better-sqlite3` is pinned to v12 (ships a prebuilt binary for Node 24 — no C++ build tools required).
