import { useState, useEffect, useRef } from 'react';
import { getHistory, clearHistory, streamChat } from '../api.js';
import ConfidenceBadge from './ConfidenceBadge.jsx';
import Sources from './Sources.jsx';

export default function ChatWindow({ doc }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function load() {
    const h = await getHistory(doc.id);
    setMessages(
      h.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
        confidence: m.confidence,
      }))
    );
  }

  async function send() {
    const q = input.trim();
    if (!q || busy || doc.status !== 'ready') return;

    setInput('');
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: 'user', content: q },
      { role: 'assistant', content: '', sources: [], confidence: null, streaming: true },
    ]);

    await streamChat(doc.id, q, {
      onSources: (sources, confidence) =>
        setMessages((m) => {
          const c = [...m];
          const last = c[c.length - 1];
          last.sources = sources;
          last.confidence = confidence?.level;
          return c;
        }),
      onToken: (t) =>
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1].content += t;
          return c;
        }),
      onDone: () => {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1].streaming = false;
          return c;
        });
        setBusy(false);
      },
      onError: (e) => {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1].content = c[c.length - 1].content || `⚠️ ${e}`;
          c[c.length - 1].streaming = false;
          return c;
        });
        setBusy(false);
      },
    });
  }

  async function onClear() {
    if (!confirm('Clear all chat history for this document?')) return;
    await clearHistory(doc.id);
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold truncate" title={doc.filename}>
            {doc.filename}
          </h2>
          <p className="text-xs text-slate-400">
            {doc.chunk_count} chunks · {doc.status}
          </p>
        </div>
        <button onClick={onClear} className="text-sm text-slate-500 hover:text-red-600 shrink-0">
          Clear chat
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-slate-400 mt-10">
            Ask a question about this document to get started.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl rounded-2xl px-4 py-2 ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {m.content}
                {m.streaming && <span className="animate-pulse">▌</span>}
              </p>
              {m.role === 'assistant' && m.confidence && (
                <div className="mt-1.5">
                  <ConfidenceBadge level={m.confidence} />
                </div>
              )}
              {m.role === 'assistant' && <Sources sources={m.sources} />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3">
        {doc.status !== 'ready' && (
          <p className="text-xs text-amber-600 mb-2">Document is still processing…</p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask a question…  (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 max-h-40"
          />
          <button
            onClick={send}
            disabled={busy || doc.status !== 'ready'}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition"
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
