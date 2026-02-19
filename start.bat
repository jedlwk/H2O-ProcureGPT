@echo off
setlocal enabledelayedexpansion
REM ProcureGPT — Start both backend and frontend (Windows)

if not exist .env (
    echo ERROR: .env not found. Run: copy .env.example .env
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 20+ from https://nodejs.org
    exit /b 1
)

REM --- Find Python 3.10+ ---
REM Try the Windows Python Launcher (py) first, then versioned binaries, then plain python
set "PYTHON="

REM Try py launcher with version flags (most reliable on Windows)
for %%V in (3.13 3.12 3.11 3.10) do (
    if not defined PYTHON (
        py -%%V --version >nul 2>&1
        if not errorlevel 1 (
            set "PYTHON=py -%%V"
        )
    )
)

REM Fall back to python on PATH
if not defined PYTHON (
    where python >nul 2>&1
    if not errorlevel 1 (
        for /f "tokens=*" %%m in ('python -c "import sys; print(sys.version_info.minor)"') do (
            if %%m GEQ 10 set "PYTHON=python"
        )
    )
)

if not defined PYTHON (
    echo ERROR: Python 3.10+ not found.
    echo   Install Python 3.10+ from https://www.python.org
    echo   Make sure "Add Python to PATH" is checked during install.
    exit /b 1
)

for /f "tokens=*" %%v in ('%PYTHON% -c "import sys; print(f\"{sys.version_info.major}.{sys.version_info.minor}\")"') do set PY_VERSION=%%v
echo Using %PYTHON% (%PY_VERSION%)

REM --- Create / recreate virtual environment ---
set "VENV_DIR=.venv"

if exist "%VENV_DIR%" (
    REM Check if existing venv is 3.10+
    for /f "tokens=*" %%m in ('"%VENV_DIR%\Scripts\python" -c "import sys; print(sys.version_info.minor)" 2^>nul') do set VENV_MINOR=%%m
    if not defined VENV_MINOR set VENV_MINOR=0
    if !VENV_MINOR! LSS 10 (
        echo Existing .venv uses old Python — removing and recreating with %PY_VERSION%...
        rmdir /s /q "%VENV_DIR%"
        goto :create_venv
    )
    goto :activate_venv
)

:create_venv
echo Creating virtual environment with Python %PY_VERSION%...
%PYTHON% -m venv %VENV_DIR%

:activate_venv
call %VENV_DIR%\Scripts\activate.bat

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
