# DocuMind — Windows setup (PowerShell)
$ErrorActionPreference = 'Stop'

Write-Host "════════════════════════════════════════"
Write-Host "  DocuMind — setup (Windows)"
Write-Host "════════════════════════════════════════"

Write-Host "Installing backend Node dependencies..."
Push-Location backend; npm install; Pop-Location

Write-Host "Installing frontend Node dependencies..."
Push-Location frontend; npm install; Pop-Location

Write-Host "Installing ChromaDB (Python)..."
pip install chromadb

if (-not (Test-Path backend\.env)) {
  Copy-Item backend\.env.example backend\.env
  Write-Host "Created backend\.env - add your GROQ_API_KEY before running."
}

Write-Host ""
Write-Host "Setup complete. To run (3 terminals):"
Write-Host "  1) chroma run --port 8001"
Write-Host "  2) cd backend ; npm start"
Write-Host "  3) cd frontend ; npm run dev"
Write-Host ""
Write-Host "Then open http://localhost:5173"
