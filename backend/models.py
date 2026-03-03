"""
Pydantic models for FastAPI request/response validation.
"""
from pydantic import BaseModel
from typing import Optional


class RecordBase(BaseModel):
    sku: Optional[str] = None
    distributor: Optional[str] = None
    item_description: Optional[str] = None
    brand: Optional[str] = None
    quote_currency: Optional[str] = None
    quantity: Optional[float] = None
    serial_no: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    eu_company: Optional[str] = None
    comments_notes: Optional[str] = None
    quotation_ref_no: Optional[str] = None
    quotation_date: Optional[str] = None
    quotation_end_date: Optional[str] = None
    quotation_validity: Optional[str] = None


class RecordResponse(RecordBase):
    id: Optional[int] = None
    source_file: Optional[str] = None
    validation_status: Optional[str] = None
    validation_message: Optional[str] = None
    field_validation: Optional[dict] = None
    catalog_match: Optional[bool] = None
    user_modified: Optional[bool] = None
    is_current: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class RecordUpdate(BaseModel):
    sku: Optional[str] = None
    distributor: Optional[str] = None
    item_description: Optional[str] = None
    brand: Optional[str] = None
    quote_currency: Optional[str] = None
    quantity: Optional[float] = None
    serial_no: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    eu_company: Optional[str] = None
    comments_notes: Optional[str] = None
    quotation_ref_no: Optional[str] = None
    quotation_date: Optional[str] = None
    quotation_end_date: Optional[str] = None
    quotation_validity: Optional[str] = None


class UploadResponse(BaseModel):
    file_id: int
    filename: str
    status: str
    records_extracted: int = 0
    records: list[dict] = []


class ValidationSummary(BaseModel):
    valid: int = 0
    warning: int = 0
    error: int = 0


class DashboardMetricsResponse(BaseModel):
    total_records: int = 0
    new_this_month: int = 0
    num_companies: int = 0
    num_skus: int = 0
    recent_uploads: list[dict] = []
    validation_summary: ValidationSummary = ValidationSummary()
    top_distributor: Optional[str] = None
    top_distributor_count: int = 0
    avg_unit_price: Optional[float] = None
    most_quoted_sku: Optional[str] = None
    most_quoted_sku_count: int = 0


class HistoricalSearchParams(BaseModel):
    query: Optional[str] = None
    eu_company: Optional[str] = None
    distributor: Optional[str] = None
    sku: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 500


class PriceTrendResponse(BaseModel):
    sku: str
    data_points: list[dict] = []


class AnalystRequest(BaseModel):
    query: str
    context_records: Optional[list[dict]] = None
    historical_summary: Optional[dict] = None


class AnalystResponseModel(BaseModel):
    response: str
    suggestions: list[str] = []
    confidence: float = 0.85


class BatchApproveRequest(BaseModel):
    records: list[dict]
    source_file: str = ''


class BatchApproveResponse(BaseModel):
    approved_count: int
    record_ids: list[int] = []


class HealthResponse(BaseModel):
    connected: bool
    model: Optional[str] = None
    error: Optional[str] = None


class CatalogEntry(BaseModel):
    id: Optional[int] = None
    sku: str
    item_description: Optional[str] = None
    brand: Optional[str] = None
    base_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    currency: Optional[str] = 'USD'
    category: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CatalogUploadResponse(BaseModel):
    inserted_count: int
    errors: list[str] = []


class CatalogStatsResponse(BaseModel):
    total_entries: int = 0
    total_brands: int = 0
    total_categories: int = 0


class ReferenceDocumentResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    collection_id: str
    created_at: Optional[str] = None
