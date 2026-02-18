"""Dashboard metrics endpoint."""
from fastapi import APIRouter, HTTPException
from backend.models import DashboardMetricsResponse
from procurement.services.database import get_dashboard_metrics

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetricsResponse)
async def dashboard_metrics():
    try:
        metrics = get_dashboard_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
