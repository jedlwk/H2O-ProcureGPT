"""Upload and extraction endpoints."""
import os
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from backend.models import UploadResponse
from procurement.config.settings import UPLOAD_DIR, ALLOWED_EXTENSIONS
from procurement.services.database import insert_uploaded_file, update_uploaded_file, generate_historical_for_skus
from procurement.services.extraction import extract_document_with_llm
from procurement.services.llm_service import verify_procurement_document

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
    file_id = insert_uploaded_file(file.filename, ext, file_size)

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
    file_id = insert_uploaded_file(file.filename, ext, file_size)

    try:
        update_uploaded_file(file_id, 'processing')
        records = extract_document_with_llm(str(file_path), filename=file.filename)

        # Add eu_company to all records if provided
        if eu_company:
            for rec in records:
                if not rec.get('eu_company'):
                    rec['eu_company'] = eu_company

        update_uploaded_file(file_id, 'completed', len(records))

        # Auto-generate historical data for extracted SKUs so benchmarking works immediately
        try:
            generate_historical_for_skus(records)
        except Exception:
            pass  # Non-critical — don't fail extraction if historical generation has issues

        return UploadResponse(
            file_id=file_id,
            filename=file.filename,
            status='completed',
            records_extracted=len(records),
            records=records,
        )
    except Exception as e:
        update_uploaded_file(file_id, 'error')
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


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
