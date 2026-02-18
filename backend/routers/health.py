"""Health check endpoints."""
from fastapi import APIRouter
from backend.models import HealthResponse
from procurement.services.llm_service import get_h2ogpte_client, get_best_llm

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/h2ogpte", response_model=HealthResponse)
async def h2ogpte_health():
    try:
        client = get_h2ogpte_client()
        model = get_best_llm(client)
        return HealthResponse(connected=True, model=model)
    except Exception as e:
        return HealthResponse(connected=False, error=str(e))
