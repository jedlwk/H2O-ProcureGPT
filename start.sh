#!/bin/bash
# ProcureGPT — Start both backend and frontend
set -e

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run: cp .env.example .env"
  exit 1
fi

PYTHON=$(command -v python3 || command -v python)
PIP=$(command -v pip3 || command -v pip)
[ -z "$PYTHON" ] && echo "ERROR: Python not found." && exit 1
[ -z "$PIP" ] && PIP="$PYTHON -m pip"
command -v node >/dev/null || { echo "ERROR: Node.js not found."; exit 1; }

$PIP install -q -r backend/requirements.txt
[ ! -f data/document_intel.db ] && $PYTHON seed_demo.py
cd frontend && npm install --silent && cd ..

$PYTHON -m uvicorn backend.main:app --port 8000 &
sleep 3
cd frontend && npm run dev &
cd ..

echo ""
echo "  ProcureGPT is running"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:8000"
echo ""

trap "kill $(jobs -p) 2>/dev/null" EXIT
wait
