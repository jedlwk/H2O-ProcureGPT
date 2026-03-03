export interface FieldValidation {
  status: 'valid' | 'warning' | 'error'
  message: string
  suggestion?: string
  acknowledged?: boolean
}

export interface ProcurementRecord {
  id?: number
  sku: string | null
  distributor: string | null
  item_description: string | null
  brand: string | null
  quote_currency: string | null
  quantity: number | null
  serial_no: string | null
  start_date: string | null
  end_date: string | null
  unit_price: number | null
  total_price: number | null
  eu_company: string | null
  comments_notes: string | null
  quotation_ref_no: string | null
  quotation_date: string | null
  quotation_end_date: string | null
  quotation_validity: string | null
  source_file: string | null
  validation_status?: 'valid' | 'warning' | 'error' | 'pending'
  validation_message?: string | null
  field_validation?: Record<string, FieldValidation>
  catalog_match?: boolean
  user_modified?: boolean
  is_current?: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface UploadedFile {
  id: number
  filename: string
  original_name: string
  file_type: string
  file_size: number
  upload_status: string
  records_extracted: number
  uploaded_at: string
}

export interface ValidationSummary {
  valid: number
  warning: number
  error: number
}

export interface DashboardMetrics {
  total_records: number
  new_this_month: number
  num_companies: number
  num_skus: number
  recent_uploads: UploadedFile[]
  validation_summary: ValidationSummary
  top_distributor?: string | null
  top_distributor_count?: number
  avg_unit_price?: number | null
  most_quoted_sku?: string | null
  most_quoted_sku_count?: number
}

export interface UploadResponse {
  file_id: number
  filename: string
  status: string
  records_extracted: number
  records: ProcurementRecord[]
}

export interface AnalystResponse {
  response: string
  suggestions: string[]
  confidence: number
}

export interface HistoricalStats {
  total_records: number
  unique_skus: number
  unique_distributors: number
  avg_unit_price: number | null
  min_unit_price: number | null
  max_unit_price: number | null
}

export interface HistoricalSearchResult {
  records: ProcurementRecord[]
  stats: HistoricalStats
  count: number
}

export interface PriceTrendPoint {
  month: string
  avg_price: number
  min_price: number
  max_price: number
  record_count: number
}

export interface PriceTrendResponse {
  sku: string
  data_points: PriceTrendPoint[]
}

export interface HealthStatus {
  connected: boolean
  model: string | null
  error: string | null
}

export interface BatchApproveResponse {
  approved_count: number
  record_ids: number[]
}

export interface SkuPriceSummary {
  avg_price: number
  min_price: number
  max_price: number
  avg_quantity: number
  record_count: number
}

export type BatchStatsResult = Record<string, SkuPriceSummary>

export interface CatalogEntry {
  id?: number
  sku: string
  item_description?: string | null
  brand?: string | null
  base_price?: number | null
  min_price?: number | null
  max_price?: number | null
  currency?: string
  category?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CatalogUploadResponse {
  inserted_count: number
  errors: string[]
}

export interface CatalogStats {
  total_entries: number
  total_brands: number
  total_categories: number
}

export interface RecordComment {
  id: number
  record_id: number
  text: string
  created_at: string
}

export interface SearchResults {
  records: ProcurementRecord[]
  catalog: CatalogEntry[]
  historical: ProcurementRecord[]
}

export interface ReferenceDocument {
  id: number
  filename: string
  original_name: string
  collection_id: string
  created_at: string
}
