#!/usr/bin/env bash
set -e

echo "════════════════════════════════════════"
echo "  DocuMind — setup"
echo "════════════════════════════════════════"

echo "▶ Installing backend Node dependencies…"
( cd backend && npm install )

echo "▶ Installing frontend Node dependencies…"
( cd frontend && npm install )

echo "▶ Installing ChromaDB (Python)…"
pip install chromadb

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "▶ Created backend/.env — add your GROQ_API_KEY before running."
fi

echo ""
echo "✅ Setup complete. To run (3 terminals):"
echo "   1) chroma run --port 8001"
echo "   2) cd backend  && npm start"
echo "   3) cd frontend && npm run dev"
echo ""
echo "Then open http://localhost:5173"
