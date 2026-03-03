# ProcureGPT

H2OGPTe-powered procurement document processing system built with **Next.js**, **FastAPI**, and **H2OGPTe**.

Upload vendor quotations (PDF/Excel), extract structured line items via AI, validate against business rules, benchmark pricing against historical data, and get conversational insights from an AI analyst.

![Dashboard](https://img.shields.io/badge/Frontend-Next.js_16-black?style=flat-square&logo=next.js)
![API](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![AI](https://img.shields.io/badge/AI-H2OGPTE-FEC925?style=flat-square)
![DB](https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Extraction** | Upload PDF/Excel quotations → H2OGPTe extracts structured line items (17 fields) |
| **Validation Engine** | 3-tier validation (error/warning/valid) with 15+ business rules |
| **Price Benchmarking** | Compare prices against historical averages and catalog pricing |
| **Catalog Management** | Structured product catalog with batch price adjustment and PDF fallback via RAG |
| **Historical Browser** | Search 18 months of pricing data with trend sparklines |
| **AI Analyst** | Ask natural-language questions about your procurement data |
| **Global Search** | Cmd+K command palette searches records, catalog, and historical data |
| **Inline Editing** | Edit, delete, bulk delete, undo, and re-validate records in-place |
| **Comments** | Add per-record comments during review |
| **CSV Export** | Export validated records with all 17 fields |
| **Dark UI** | Modern dark theme with violet accent, built on shadcn/ui |

---

## Prerequisites

> **Using Docker?** Skip straight to [Docker Setup](#docker-setup) — no Python or Node.js needed.

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Python** | 3.10+ | Tested on 3.10, 3.11, 3.13 |
| **Node.js** | 20+ | Tested on 20, 24 |
| **npm** | 10+ | Comes with Node.js |
| **H2OGPTe** | 1.6.47+ | You need an API key and endpoint |

> **Why Python 3.10 specifically?** Key packages (pandas, numpy, uvicorn) don't ship pre-built Windows wheels for 3.9. On 3.10+, everything installs cleanly on both macOS and Windows — no C compiler needed.

---

## Quick Start (Local)

These steps are the same on **macOS**, **Windows**, and **Linux**. Where a command differs, both versions are shown.

### 1. Clone the repo

```bash
git clone https://github.com/jedlwk/H2O-ProcureGPT.git
cd H2O-ProcureGPT
```

### 2. Create your `.env` file

| macOS / Linux | Windows |
|---------------|---------|
| `cp .env.example .env` | `copy .env.example .env` |

Then open `.env` and add your H2OGPTe credentials:

```
H2OGPTE_API_KEY=sk-your-api-key-here
H2OGPTE_ADDRESS=https://h2ogpte.genai.h2o.ai/
```

> **Where to get these:** Refer to the [Step-by-Step Guide (PDF)](./HOW_TO_GET_H2OGPTE_API.pdf)

### 3. Start the app

| macOS / Linux | Windows |
|---------------|---------|
| `./start.sh` | `start.bat` |

This single command:
- **Finds Python 3.10+** automatically (even if your default `python3` is older)
- **Creates a `.venv`** virtual environment (or recreates it if the existing one uses an old Python)
- Installs all Python and Node dependencies
- Seeds demo data on first run
- Starts the backend (port 8000) and frontend (port 3000)

> **Note:** You need Python 3.10+ **installed** somewhere on your system, but it doesn't have to be your default. The script searches for `python3.13`, `python3.12`, `python3.11`, `python3.10` automatically. On Windows, it also checks the `py` launcher (`py -3.13`, etc.).

### 4. Open

Go to **http://localhost:3000** in your browser. Done.

> **Sample quotes:** Three demo quotation files are provided in the `sample_quotes/` folder. Upload any of them to see AI extraction, validation, and historical price benchmarking in action — the seed data includes 18 months of pricing history for all SKUs in these files.

---

<details>
<summary><strong>Manual setup</strong> (if you prefer to run backend and frontend separately)</summary>

**Install dependencies:**

| macOS / Linux | Windows |
|---------------|---------|
| `pip3 install -r backend/requirements.txt` | `pip install -r backend\requirements.txt` |

**Seed demo data (first time only):**

| macOS / Linux | Windows |
|---------------|---------|
| `python3 seed_demo.py` | `python seed_demo.py` |

**Start backend (terminal 1):**

| macOS / Linux | Windows |
|---------------|---------|
| `python3 -m uvicorn backend.main:app --port 8000` | `python -m uvicorn backend.main:app --port 8000` |

**Start frontend (terminal 2):**

```bash
cd frontend
npm install
npm run dev
```

</details>

---

## Docker Setup

Works on **macOS**, **Windows**, and **Linux** — anywhere Docker runs. No Python or Node.js installation required.

### 1. Create your `.env` file

| macOS / Linux | Windows |
|---------------|---------|
| `cp .env.example .env` | `copy .env.example .env` |

Edit `.env` with your H2OGPTE credentials (same as step 2 above).

### 2. Build and run

```bash
docker compose up --build
```

This builds and starts both containers:
- **Backend** — Python 3.10, FastAPI on port 8000
- **Frontend** — Node 20, Next.js on port 3000

### 3. Open the app

Go to **http://localhost:3000**.

### Stop

```bash
docker compose down
```

---

## Environment Variables

### `.env` (root — backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `H2OGPTE_API_KEY` | **Yes** | Your H2OGPTE API key (starts with `sk-`) |
| `H2OGPTE_ADDRESS` | **Yes** | Your H2OGPTE instance URL |

### `frontend/.env.local` (frontend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend API URL |

---

## Project Structure

```
Procurement/
├── backend/                  # FastAPI backend
│   ├── main.py               # App entry point, CORS, router registration
│   ├── models.py             # Pydantic request/response models
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile
│   └── routers/
│       ├── analyst.py        # POST /api/analyst — AI chat
│       ├── catalog.py        # CRUD /api/catalog, batch price adjust, reference PDFs
│       ├── dashboard.py      # GET  /api/dashboard/metrics
│       ├── health.py         # GET  /api/health/h2ogpte
│       ├── historical.py     # GET  /api/historical/search, price trends, batch stats
│       ├── records.py        # CRUD /api/records, validate, approve, comments
│       ├── search.py         # GET  /api/search — global cross-table search
│       └── upload.py         # POST /api/upload, extract, verify, drafts
│
├── procurement/              # Core Python services
│   ├── config/
│   │   └── settings.py       # Environment config
│   └── services/
│       ├── database.py       # SQLite CRUD, search, metrics, comments, catalog
│       ├── extraction.py     # H2OGPTE document extraction
│       ├── llm_service.py    # H2OGPTE client, model selection, analyst, PDF RAG
│       └── validation.py     # 3-tier validation engine + catalog + PDF fallback
│
├── frontend/                 # Next.js 16 + TypeScript
│   ├── Dockerfile
│   ├── src/
│   │   ├── app/              # Pages: /, /upload, /validate, /history, /catalog, /analyst
│   │   ├── components/       # UI components (shadcn/ui + custom)
│   │   └── lib/              # API client, types, hooks
│   └── public/               # Static assets (H2O logo)
│
├── data/                     # SQLite database + file uploads
│   ├── document_intel.db     # (auto-created on first run)
│   └── uploads/              # Uploaded documents
│
├── tests/                    # Python tests (pytest)
│   ├── test_database.py      # 9 tests — CRUD, search, metrics
│   └── test_validation.py    # 28 tests — all validation rules
│
├── sample_quotes/            # Sample quotation files for testing
│   ├── Sample_Quote.xlsx
│   ├── Sample_Quote_1.pdf
│   └── Sample_Quote_2.pdf
│
├── extraction_prompt.txt     # AI extraction prompt (17-field schema)
├── docker-compose.yml        # Docker setup (backend + frontend)
├── start.sh                  # One-command start (macOS / Linux)
├── start.bat                 # One-command start (Windows)
└── .env.example              # Template for backend env vars
```

---

## API Endpoints

### Upload & Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a document |
| `POST` | `/api/upload/extract` | Upload + AI extraction |
| `POST` | `/api/upload/verify` | Check if document is procurement-related |
| `GET` | `/api/upload/history` | List all uploaded files with status |
| `GET` | `/api/upload/drafts/{filename}` | Get draft records for a file |
| `PUT` | `/api/upload/drafts/{filename}` | Save updated draft records |
| `PATCH` | `/api/upload/{file_id}/status` | Update upload status |
| `DELETE` | `/api/upload/{file_id}` | Delete upload and its drafts |
| `GET` | `/api/files/{filename}` | Download/preview original file |

### Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/records` | List active records |
| `GET` | `/api/records/{id}` | Get single record |
| `PUT` | `/api/records/{id}` | Update a record |
| `DELETE` | `/api/records/{id}` | Soft-delete a record |
| `POST` | `/api/records/validate` | Run validation on records |
| `POST` | `/api/records/approve-batch` | Approve and save to DB |
| `POST` | `/api/records/batch-delete` | Delete multiple records by ID |
| `GET` | `/api/records/{id}/comments` | Get comments for a record |
| `POST` | `/api/records/{id}/comments` | Add a comment |
| `DELETE` | `/api/records/{id}/comments/{comment_id}` | Delete a comment |

### Catalog

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/catalog` | Search catalog entries |
| `GET` | `/api/catalog/skus` | List all catalog SKUs |
| `GET` | `/api/catalog/stats` | Catalog statistics |
| `POST` | `/api/catalog/upload` | Upload CSV/Excel catalog file |
| `DELETE` | `/api/catalog/{id}` | Delete catalog entry |
| `POST` | `/api/catalog/batch-adjust-prices` | Adjust prices by percentage |
| `POST` | `/api/catalog/upload-reference-pdf` | Upload reference PDF catalog |
| `GET` | `/api/catalog/reference-docs` | List reference PDFs |
| `DELETE` | `/api/catalog/reference-docs/{id}` | Delete reference PDF |

### Historical & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/historical/search` | Search historical archive |
| `GET` | `/api/historical/price-trend/{sku}` | Monthly price trend |
| `GET` | `/api/historical/batch-stats` | Stats for multiple SKUs |
| `GET` | `/api/historical/all-skus` | List unique SKUs in history |
| `GET` | `/api/companies` | List distinct companies |
| `GET` | `/api/distributors` | List distinct distributors |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ping` | Health check |
| `GET` | `/api/dashboard/metrics` | Dashboard aggregate stats |
| `GET` | `/api/health/h2ogpte` | H2OGPTE connection status |
| `GET` | `/api/search?q=` | Global search across records, catalog, historical |
| `POST` | `/api/analyst` | AI analyst query |

---

## Running Tests

```bash
pytest tests/ -v
```

All 37 tests should pass:
- `test_database.py` — 9 tests (CRUD, soft-delete, search, metrics)
- `test_validation.py` — 28 tests (field validation, anomalies, duplicates)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Data Tables | TanStack Table v8 |
| Server State | TanStack Query v5 |
| Icons | Lucide React |
| Backend | FastAPI, Pydantic v2 |
| Database | SQLite |
| AI/LLM | H2OGPTE (document extraction + conversational analyst) |

---

## Author

**Jed Lee** — [jed.lee@h2o.ai](mailto:jed.lee@h2o.ai)

---

## License

Proprietary — H2O.ai. Internal use only. Not for redistribution.
