#!/bin/bash
# ProcureGPT — Start both backend and frontend (macOS / Linux)
set -e

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run: cp .env.example .env"
  exit 1
fi

command -v node >/dev/null || { echo "ERROR: Node.js not found."; exit 1; }

# --- Find Python 3.10+ ---
# Search for versioned binaries first (highest to lowest), then fall back to python3/python
PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3 python; do
  bin=$(command -v "$candidate" 2>/dev/null) || continue
  minor=$("$bin" -c "import sys; print(sys.version_info.minor)" 2>/dev/null) || continue
  if [ "$minor" -ge 10 ]; then
    PYTHON="$bin"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "ERROR: Python 3.10+ not found."
  echo "  Your default python3 is $(python3 --version 2>/dev/null || echo 'not installed')."
  echo "  Install Python 3.10+ and make sure it's on your PATH."
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "Using $PYTHON ($PY_VERSION)"

# --- Create / recreate virtual environment ---
VENV_DIR=".venv"

needs_new_venv=false
if [ -d "$VENV_DIR" ]; then
  # Check if existing venv Python is 3.10+
  venv_minor=$("$VENV_DIR/bin/python" -c "import sys; print(sys.version_info.minor)" 2>/dev/null) || venv_minor=0
  if [ "$venv_minor" -lt 10 ]; then
    echo "Existing .venv uses Python 3.$venv_minor — removing and recreating with $PY_VERSION..."
    rm -rf "$VENV_DIR"
    needs_new_venv=true
  fi
else
  needs_new_venv=true
fi

if [ "$needs_new_venv" = true ]; then
  echo "Creating virtual environment with Python $PY_VERSION..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

echo "Installing Python dependencies..."
pip install -q -r backend/requirements.txt

[ ! -f data/document_intel.db ] && python seed_demo.py

cd frontend && npm install --silent && cd ..

python -m uvicorn backend.main:app --port 8000 &
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
