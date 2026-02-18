#!/bin/bash
# ProcureGPT — Start both backend and frontend

set -e

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  echo "Run:  cp .env.example .env  and fill in your H2OGPTE credentials."
  exit 1
fi

# Install Python deps
echo "Installing Python dependencies..."
pip install -q -r backend/requirements.txt

# Seed demo data if DB doesn't exist
if [ ! -f data/document_intel.db ]; then
  echo "Seeding demo data..."
  python seed_demo.py
fi

# Install frontend deps
echo "Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# Start backend
echo "Starting backend on http://localhost:8000..."
uvicorn backend.main:app --port 8000 &
BACKEND_PID=$!

# Wait for backend
sleep 3

# Start frontend
echo "Starting frontend on http://localhost:3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "ProcureGPT is running:"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
