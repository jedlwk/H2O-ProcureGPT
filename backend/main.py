"""
FastAPI application for the Procurement Contract Sourcing System.
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from backend.routers import dashboard, historical, health, upload, records, analyst, catalog, search
from procurement.services.database import init_db


# Filter out noisy socket.io websocket log lines from uvicorn
class _SocketIOLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "socket.io" in msg:
            return False
        if msg in ("connection open", "connection closed", "connection failed (403 Forbidden)"):
            return False
        return True

logging.getLogger("uvicorn.access").addFilter(_SocketIOLogFilter())
logging.getLogger("uvicorn.error").addFilter(_SocketIOLogFilter())


class RejectSocketIOMiddleware:
    """Raw ASGI middleware that silently closes stray socket.io WebSocket connections."""
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "websocket" and scope["path"].startswith("/socket.io"):
            await receive()
            await send({"type": "websocket.accept"})
            await send({"type": "websocket.close", "code": 1000})
            return
        await self.app(scope, receive, send)


app = FastAPI(
    title="ProcureGPT API",
    description="Procurement Contract Sourcing System API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:8501",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RejectSocketIOMiddleware)

app.include_router(dashboard.router)
app.include_router(historical.router)
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(records.router)
app.include_router(analyst.router)
app.include_router(catalog.router)
app.include_router(search.router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/api/ping")
async def ping():
    return {"status": "ok"}
