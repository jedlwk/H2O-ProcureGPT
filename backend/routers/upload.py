"""Upload and extraction endpoints."""
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.models import UploadResponse
from procurement.config.settings import UPLOAD_DIR, ALLOWED_EXTENSIONS
from procurement.services.database import (
    insert_uploaded_file, update_uploaded_file, generate_historical_for_skus,
    save_draft_records, replace_draft_records, get_uploaded_files,
    get_draft_records_by_file, delete_uploaded_file,
)
from procurement.services.extraction import extract_document_with_llm
from procurement.services.llm_service import verify_procurement_document


class StatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    records_extracted: Optional[int] = None


router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    eu_company: str = Form(default=''),
):
    """Upload a file and optionally extract records."""
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save file
    upload_dir = Path(UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = f"{timestamp}_{file.filename}"
    file_path = upload_dir / safe_name

    with open(file_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)
    file_id = insert_uploaded_file(file.filename, ext, file_size, disk_filename=safe_name)

    return UploadResponse(
        file_id=file_id,
        filename=file.filename,
        status='uploaded',
        records_extracted=0,
        records=[],
    )


@router.post("/extract", response_model=UploadResponse)
async def extract_records(
    file: UploadFile = File(...),
    eu_company: str = Form(default=''),
):
    """Upload and extract records from a procurement document."""
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    upload_dir = Path(UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = f"{timestamp}_{file.filename}"
    file_path = upload_dir / safe_name

    with open(file_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)
    file_id = insert_uploaded_file(file.filename, ext, file_size, disk_filename=safe_name)

    try:
        update_uploaded_file(file_id, 'processing')
        records = extract_document_with_llm(str(file_path), filename=file.filename)

        # Add eu_company to all records if provided
        if eu_company:
            for rec in records:
                if not rec.get('eu_company'):
                    rec['eu_company'] = eu_company

        update_uploaded_file(file_id, 'uploaded', len(records))

        # Auto-generate historical data for extracted SKUs so benchmarking works immediately
        try:
            generate_historical_for_skus(records)
        except Exception:
            pass  # Non-critical — don't fail extraction if historical generation has issues

        # Auto-save records as drafts so they persist across navigation
        try:
            save_draft_records(records, file_id=file_id, source_file=file.filename)
        except Exception:
            pass  # Non-critical — records still returned to frontend

        return UploadResponse(
            file_id=file_id,
            filename=file.filename,
            status='uploaded',
            records_extracted=len(records),
            records=records,
        )
    except Exception as e:
        update_uploaded_file(file_id, 'error')
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/history")
async def upload_history():
    """List all uploaded files with their processing status."""
    try:
        files = get_uploaded_files()
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{file_id}/status")
async def update_upload_status(file_id: int, request: StatusUpdateRequest):
    """Update the status and/or records_extracted of an uploaded file."""
    allowed_statuses = ("uploaded", "validating", "approved")
    if request.status and request.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {request.status}")
    try:
        update_uploaded_file(file_id, request.status, records_extracted=request.records_extracted)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}")
async def remove_uploaded_file(file_id: int):
    """Delete an uploaded file record and its associated drafts."""
    deleted = delete_uploaded_file(file_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"ok": True}


@router.get("/drafts/{filename:path}")
async def get_drafts(filename: str):
    """Get draft (unapproved) records for a given source filename."""
    try:
        records = get_draft_records_by_file(filename)
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/drafts/{filename:path}")
async def save_drafts(filename: str, records: list[dict]):
    """Save updated draft records (replaces existing drafts for this file)."""
    try:
        ids = replace_draft_records(records, source_file=filename)
        return {"saved": len(ids), "ids": ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify")
async def verify_document(file: UploadFile = File(...)):
    """Quick check whether a document is a procurement document."""
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    upload_dir = Path(UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = f"{timestamp}_verify_{file.filename}"
    file_path = upload_dir / safe_name

    with open(file_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    try:
        is_procurement = verify_procurement_document(str(file_path), file.filename)
        return {"is_procurement_document": is_procurement, "confidence": 0.9 if is_procurement else 0.1}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass


def _find_uploaded_file(original_name: str):
    """Find an uploaded file on disk by original name."""
    import glob

    upload_dir = Path(UPLOAD_DIR)
    exact = upload_dir / original_name
    if exact.is_file():
        return exact
    matches = sorted(glob.glob(str(upload_dir / f"*_{original_name}")), reverse=True)
    return Path(matches[0]) if matches else None


@router.get("/files/{original_name:path}")
async def serve_uploaded_file(original_name: str):
    """Serve an uploaded file by its original name (finds the timestamped copy on disk)."""
    import mimetypes

    disk_path = _find_uploaded_file(original_name)
    if not disk_path:
        raise HTTPException(status_code=404, detail=f"File not found: {original_name}")

    media_type = mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    return FileResponse(disk_path, media_type=media_type, content_disposition_type="inline")
