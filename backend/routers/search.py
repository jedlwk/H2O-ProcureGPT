"""Global search endpoints."""
from fastapi import APIRouter, Query, HTTPException
from procurement.services.database import (
    get_current_records,
    get_catalog_entries,
    search_historical_records,
)

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
async def global_search(q: str = Query(..., min_length=1)):
    """Search across records, catalog, and historical data."""
    try:
        # Search records (by sku, item_description, distributor)
        all_records = get_current_records()
        q_lower = q.lower()
        records_results = [
            r for r in all_records
            if (r.get('sku') and q_lower in r['sku'].lower()) or
               (r.get('item_description') and q_lower in r['item_description'].lower()) or
               (r.get('distributor') and q_lower in r['distributor'].lower())
        ][:5]

        # Search catalog (by sku, item_description, brand)
        catalog_results = get_catalog_entries(search=q, limit=3)

        # Search historical (by sku, distributor)
        historical_results = search_historical_records(query=q, limit=3)

        return {
            "records": records_results,
            "catalog": catalog_results,
            "historical": historical_results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
