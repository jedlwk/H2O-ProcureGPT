"""
FastAPI application for the Procurement Contract Sourcing System.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import dashboard, historical, health, upload, records, analyst
from procurement.services.database import init_db

app = FastAPI(
    title="ProcureGPT API",
    description="Procurement Contract Sourcing System API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8501",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(historical.router)
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(records.router)
app.include_router(analyst.router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/api/ping")
async def ping():
    return {"status": "ok"}
