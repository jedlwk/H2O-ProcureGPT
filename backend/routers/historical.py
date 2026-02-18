"""Historical records search and price trend endpoints."""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.models import PriceTrendResponse
from procurement.services.database import (
    search_historical_records,
    get_historical_stats,
    get_price_trend_by_sku,
    get_distinct_eu_companies,
    get_distinct_distributors,
    get_all_skus,
)

router = APIRouter(prefix="/api", tags=["historical"])


@router.get("/historical/search")
async def historical_search(
    query: Optional[str] = None,
    eu_company: Optional[str] = None,
    distributor: Optional[str] = None,
    sku: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=500, le=5000),
):
    try:
        records = search_historical_records(
            sku=sku, eu_company=eu_company, distributor=distributor,
            date_from=date_from, date_to=date_to, query=query, limit=limit,
        )
        stats = get_historical_stats(sku=sku, eu_company=eu_company)
        return {"records": records, "stats": stats, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical/price-trend/{sku}", response_model=PriceTrendResponse)
async def price_trend(sku: str):
    try:
        return get_price_trend_by_sku(sku)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical/chart-data")
async def chart_data(
    eu_company: Optional[str] = None,
    sku: Optional[str] = None,
):
    try:
        records = search_historical_records(sku=sku, eu_company=eu_company, limit=1000)
        stats = get_historical_stats(sku=sku, eu_company=eu_company)
        return {"records": records, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical/all-skus")
async def all_skus():
    try:
        return get_all_skus()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{sku}")
async def sku_summary(sku: str):
    try:
        trend = get_price_trend_by_sku(sku)
        stats = get_historical_stats(sku=sku)
        records = search_historical_records(sku=sku, limit=50)
        return {"trend": trend, "stats": stats, "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies")
async def list_companies():
    try:
        return get_distinct_eu_companies()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/distributors")
async def list_distributors():
    try:
        return get_distinct_distributors()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
