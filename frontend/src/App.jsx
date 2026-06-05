import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import { listDocuments } from './api.js';

export default function App() {
  const [docs, setDocs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any document is still processing so cards update to "ready".
  useEffect(() => {
    if (!docs.some((d) => d.status === 'processing')) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [docs, refresh]);

  const selected = docs.find((d) => d.id === selectedId) || null;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <Sidebar docs={docs} selectedId={selectedId} onSelect={setSelectedId} onRefresh={refresh} />
      <main className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <ChatWindow doc={selected} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg font-medium">Select a document to start chatting</p>
              <p className="text-sm">or upload a PDF from the sidebar</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
