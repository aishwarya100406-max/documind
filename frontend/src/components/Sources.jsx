import { useState } from 'react';

export default function Sources({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-indigo-600 hover:underline"
      >
        {open ? '▼' : '▶'} {sources.length} source chunk{sources.length > 1 ? 's' : ''}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="text-xs bg-slate-50 border border-slate-200 rounded p-2">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>
                  {s.page ? `Page ${s.page} · ` : ''}Chunk #{s.chunkIndex}
                </span>
                <span>{Math.round(s.similarity * 100)}% match</span>
              </div>
              <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
