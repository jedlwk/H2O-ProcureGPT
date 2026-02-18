#!/bin/bash
# ProcureGPT — Start both backend and frontend

set -e

# ── Check prerequisites ──

if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  echo "Run:  cp .env.example .env  and fill in your H2OGPTE credentials."
  exit 1
fi

# Find Python
PYTHON=""
for cmd in python3 python; do
  if command -v $cmd &>/dev/null; then
    PYTHON=$cmd
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python not found. Install Python 3.10+ from https://www.python.org/downloads/"
  exit 1
fi
echo "Using $($PYTHON --version)"

# Find pip
PIP=""
for cmd in pip3 pip "$PYTHON -m pip"; do
  if $cmd --version &>/dev/null 2>&1; then
    PIP=$cmd
    break
  fi
done
if [ -z "$PIP" ]; then
  echo "pip not found. Installing pip..."
  curl -sS https://bootstrap.pypa.io/get-pip.py | $PYTHON
  PIP="$PYTHON -m pip"
fi

# Find Node
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install Node.js 20+ from https://nodejs.org/"
  exit 1
fi
echo "Using Node $(node --version)"

# ── Install dependencies ──

echo "Installing Python dependencies..."
$PIP install -q -r backend/requirements.txt

# Seed demo data if DB doesn't exist
if [ ! -f data/document_intel.db ]; then
  echo "Seeding demo data..."
  $PYTHON seed_demo.py
fi

echo "Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# ── Start servers ──

echo ""
echo "Starting backend on http://localhost:8000..."
$PYTHON -m uvicorn backend.main:app --port 8000 &
BACKEND_PID=$!

sleep 3

echo "Starting frontend on http://localhost:3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================"
echo "  ProcureGPT is running!"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:8000"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
