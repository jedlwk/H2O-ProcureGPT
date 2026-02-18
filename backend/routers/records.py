"""Records CRUD and validation endpoints."""
from fastapi import APIRouter, HTTPException
from backend.models import RecordResponse, RecordUpdate, BatchApproveRequest, BatchApproveResponse
from procurement.services.database import (
    get_current_records, get_record_by_id, update_record,
    delete_record, save_approved_records,
)
from procurement.services.validation import validate_records

router = APIRouter(prefix="/api/records", tags=["records"])


@router.get("")
async def list_records():
    try:
        records = get_current_records()
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{record_id}")
async def get_record(record_id: int):
    record = get_record_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.put("/{record_id}")
async def update_record_endpoint(record_id: int, updates: RecordUpdate):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    success = update_record(record_id, update_data)
    if not success:
        raise HTTPException(status_code=400, detail="Update failed. Check field names.")
    return get_record_by_id(record_id)


@router.delete("/{record_id}")
async def delete_record_endpoint(record_id: int):
    record = get_record_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    delete_record(record_id)
    return {"status": "deleted", "id": record_id}


@router.post("/validate")
async def validate_records_endpoint(records: list[dict]):
    """Run validation engine on a batch of records."""
    try:
        validated = validate_records(records)
        return validated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-batch", response_model=BatchApproveResponse)
async def approve_batch(request: BatchApproveRequest):
    """Approve and save a batch of records to both active and historical tables."""
    try:
        ids = save_approved_records(request.records, source_file=request.source_file)
        return BatchApproveResponse(approved_count=len(ids), record_ids=ids)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
