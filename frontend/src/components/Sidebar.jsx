import { useRef, useState } from 'react';
import { uploadDocument } from '../api.js';
import DocumentCard from './DocumentCard.jsx';

// Keep in sync with MAX_UPLOAD_MB on the backend (this is just a UX pre-check;
// the server is the real enforcer).
const MAX_UPLOAD_MB = 50;
const ACCEPT = '.pdf,.docx,.txt,.md';

export default function Sidebar({ docs, selectedId, onSelect, onRefresh }) {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_UPLOAD_MB}MB limit`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      setProgress(0);
      await uploadDocument(file, setProgress);
      setProgress(null);
      onRefresh();
    } catch (err) {
      setError(err.message);
      setProgress(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <aside className="w-80 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-indigo-700">🧠 DocuMind</h1>
        <p className="text-xs text-slate-400">RAG document intelligence</p>
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition"
        >
          ＋ Upload document
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onFile}
        />
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          PDF, DOCX, TXT, MD · up to {MAX_UPLOAD_MB}MB
        </p>
        {progress !== null && (
          <div className="mt-2">
            <div className="h-2 bg-slate-200 rounded overflow-hidden">
              <div
                className="h-2 bg-indigo-500 rounded transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Uploading {progress}%…</p>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {docs.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-6">No documents yet.</p>
        )}
        {docs.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            active={d.id === selectedId}
            onSelect={() => onSelect(d.id)}
            onChanged={onRefresh}
          />
        ))}
      </div>
    </aside>
  );
}
