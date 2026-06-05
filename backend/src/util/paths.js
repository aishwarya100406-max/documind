import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/ root (two levels up from src/util)
export const BACKEND_ROOT = path.resolve(__dirname, '../..');
export const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
export const UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads');
export const DATA_DIR = path.join(BACKEND_ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'documind.db');
// Built React app (produced by `frontend/npm run build`) — served in production.
export const FRONTEND_DIST = path.join(REPO_ROOT, 'frontend', 'dist');

export function ensureDirs() {
  for (const dir of [UPLOAD_DIR, DATA_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
