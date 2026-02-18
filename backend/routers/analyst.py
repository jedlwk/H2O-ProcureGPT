"""AI Analyst chat endpoint."""
from fastapi import APIRouter, HTTPException
from backend.models import AnalystRequest, AnalystResponseModel
from procurement.services.llm_service import query_analyst

router = APIRouter(prefix="/api/analyst", tags=["analyst"])


@router.post("", response_model=AnalystResponseModel)
async def analyst_query(request: AnalystRequest):
    try:
        result = query_analyst(
            query=request.query,
            context_records=request.context_records,
            historical_summary=request.historical_summary,
        )
        return AnalystResponseModel(
            response=result.response,
            suggestions=result.suggestions,
            confidence=result.confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
