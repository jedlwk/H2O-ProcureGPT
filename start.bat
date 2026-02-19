@echo off
REM ProcureGPT — Start both backend and frontend (Windows)

if not exist .env (
    echo ERROR: .env not found. Run: copy .env.example .env
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from https://www.python.org
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 20+ from https://nodejs.org
    exit /b 1
)

REM Verify Python >= 3.10
for /f "tokens=*" %%v in ('python -c "import sys; print(sys.version_info.minor)"') do set PY_MINOR=%%v
if %PY_MINOR% LSS 10 (
    echo ERROR: Python 3.10+ required.
    exit /b 1
)

echo Installing Python dependencies...
pip install -q -r backend\requirements.txt

if not exist data\document_intel.db (
    echo Seeding demo data...
    python seed_demo.py
)

echo Installing frontend dependencies...
cd frontend
call npm install --silent
cd ..

echo.
echo Starting ProcureGPT...
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo.
echo Press Ctrl+C to stop both servers.
echo.

start "ProcureGPT Backend" /b python -m uvicorn backend.main:app --port 8000
timeout /t 3 /nobreak >nul
cd frontend
call npm run dev
