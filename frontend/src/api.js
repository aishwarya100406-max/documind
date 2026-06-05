const API = '/api';

export async function listDocuments() {
  const r = await fetch(`${API}/documents`);
  if (!r.ok) throw new Error('Failed to load documents');
  return r.json();
}

export async function deleteDocument(id) {
  const r = await fetch(`${API}/documents/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function summarizeDocument(id) {
  const r = await fetch(`${API}/documents/${id}/summarize`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Summarize failed');
  return r.json();
}

export async function getHistory(docId) {
  const r = await fetch(`${API}/chat/${docId}/history`);
  return r.json();
}

export async function clearHistory(docId) {
  const r = await fetch(`${API}/chat/${docId}/history`, { method: 'DELETE' });
  return r.json();
}

/** Upload with progress via XHR (fetch can't report upload progress). */
export function uploadDocument(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/documents/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(JSON.parse(xhr.responseText || '{}').error || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

/**
 * Stream a chat answer. Parses newline-delimited JSON messages:
 *   { type: 'sources', sources, confidence }
 *   { type: 'token', content }
 *   { type: 'done' } | { type: 'error', error }
 */
export async function streamChat(docId, question, { onSources, onToken, onDone, onError }) {
  let res;
  try {
    res = await fetch(`${API}/chat/${docId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  } catch (e) {
    onError?.(e.message);
    return;
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    onError?.(e.error || 'Request failed');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === 'sources') onSources?.(msg.sources, msg.confidence);
      else if (msg.type === 'token') onToken?.(msg.content);
      else if (msg.type === 'done') {
        finished = true;
        onDone?.();
      } else if (msg.type === 'error') {
        finished = true;
        onError?.(msg.error);
      }
    }
  }
  if (!finished) onDone?.();
}
