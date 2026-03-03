"""Records CRUD and validation endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.models import RecordResponse, RecordUpdate, BatchApproveRequest, BatchApproveResponse
from procurement.services.database import (
    get_current_records, get_record_by_id, update_record,
    delete_record, save_approved_records, get_all_known_skus, get_catalog_entries_batch,
    get_comments_for_record, add_comment, delete_comment, batch_delete_records,
    get_historical_price_summaries_batch,
)
from procurement.services.validation import validate_records


class BatchDeleteRequest(BaseModel):
    ids: list[int]


class CommentRequest(BaseModel):
    text: str

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
        # Pre-fetch known SKUs, catalog entries, and historical stats
        known_skus = get_all_known_skus()
        skus_in_batch = [r.get('sku') for r in records if r.get('sku')]
        catalog_entries = get_catalog_entries_batch(skus_in_batch)
        historical_stats = get_historical_price_summaries_batch(skus_in_batch)

        validated = validate_records(records, known_skus=known_skus, catalog_entries=catalog_entries, historical_stats=historical_stats)
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


@router.post("/batch-delete")
async def batch_delete_endpoint(request: BatchDeleteRequest):
    """Delete multiple records by ID."""
    try:
        deleted = batch_delete_records(request.ids)
        return {"deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{record_id}/comments")
async def get_record_comments(record_id: int):
    """Get all comments for a record."""
    try:
        comments = get_comments_for_record(record_id)
        return comments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{record_id}/comments")
async def add_record_comment(record_id: int, request: CommentRequest):
    """Add a comment to a record."""
    try:
        # Verify record exists
        record = get_record_by_id(record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")

        comment_id = add_comment(record_id, request.text)
        comments = get_comments_for_record(record_id)
        return comments[-1] if comments else {"id": comment_id, "record_id": record_id, "text": request.text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{record_id}/comments/{comment_id}")
async def delete_record_comment(record_id: int, comment_id: int):
    """Delete a comment."""
    try:
        success = delete_comment(comment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found")
        return {"status": "deleted", "id": comment_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
