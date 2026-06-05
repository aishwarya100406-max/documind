import { useState } from 'react';
import { deleteDocument, summarizeDocument } from '../api.js';

const statusStyle = {
  ready: 'bg-green-100 text-green-700',
  processing: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

export default function DocumentCard({ doc, active, onSelect, onChanged }) {
  const [showSummary, setShowSummary] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDelete(e) {
    e.stopPropagation();
    if (!confirm(`Delete "${doc.filename}"? This removes its chunks and chat history.`)) return;
    await deleteDocument(doc.id);
    onChanged();
  }

  async function onSummarize(e) {
    e.stopPropagation();
    setBusy(true);
    try {
      await summarizeDocument(doc.id);
      onChanged();
      setShowSummary(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-3 cursor-pointer transition ${
        active
          ? 'border-indigo-500 ring-1 ring-indigo-300 bg-indigo-50'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm font-medium truncate" title={doc.filename}>
          {doc.filename}
        </p>
        <button
          onClick={onDelete}
          title="Delete document"
          className="text-slate-300 hover:text-red-500 text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center flex-wrap gap-2 mt-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusStyle[doc.status] || ''}`}>
          {doc.status}
        </span>
        {doc.pages > 0 && <span className="text-[10px] text-slate-400">{doc.pages} pages</span>}
        <span className="text-[10px] text-slate-400">{doc.chunk_count} chunks</span>
        <span className="text-[10px] text-slate-400">
          {new Date(doc.upload_date).toLocaleDateString()}
        </span>
      </div>

      {doc.status === 'ready' && (
        <div className="mt-2">
          {doc.summary ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSummary((s) => !s);
                }}
                className="text-[11px] text-indigo-600 hover:underline"
              >
                {showSummary ? '▼ Hide summary' : '▶ Show summary'}
              </button>
              {showSummary && (
                <div className="mt-1 text-[11px] text-slate-600 whitespace-pre-wrap bg-white rounded p-2 border border-slate-200">
                  {doc.summary}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={onSummarize}
              disabled={busy}
              className="text-[11px] text-indigo-600 hover:underline disabled:opacity-50"
            >
              {busy ? 'Summarizing…' : '✨ Generate summary'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
