#!/bin/bash
# ProcureGPT — Start both backend and frontend (macOS / Linux)
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

# Verify Python >= 3.10
PY_VERSION=$($PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MINOR=$($PYTHON -c "import sys; print(sys.version_info.minor)")
if [ "$PY_MINOR" -lt 10 ]; then
  echo "ERROR: Python 3.10+ required (found $PY_VERSION)"
  exit 1
fi

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
