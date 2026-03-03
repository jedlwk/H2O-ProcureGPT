import type {
  DashboardMetrics,
  UploadResponse,
  UploadedFile,
  ProcurementRecord,
  HistoricalSearchResult,
  PriceTrendResponse,
  AnalystResponse,
  HealthStatus,
  BatchApproveResponse,
  BatchStatsResult,
  CatalogEntry,
  CatalogUploadResponse,
  CatalogStats,
  RecordComment,
  SearchResults,
  ReferenceDocument,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new APIError(res.status, text)
  }
  return res.json()
}

export const api = {
  dashboard: {
    getMetrics: () => fetchAPI<DashboardMetrics>('/api/dashboard/metrics'),
  },

  upload: {
    uploadFile: async (file: File, euCompany: string = ''): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('eu_company', euCompany)
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new APIError(res.status, await res.text())
      return res.json()
    },

    extractRecords: async (file: File, euCompany: string = ''): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('eu_company', euCompany)
      const res = await fetch(`${API_BASE}/api/upload/extract`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new APIError(res.status, await res.text())
      return res.json()
    },

    verifyDocument: async (file: File): Promise<{ is_procurement_document: boolean; confidence: number }> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/api/upload/verify`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new APIError(res.status, await res.text())
      return res.json()
    },
  },

  records: {
    list: () => fetchAPI<ProcurementRecord[]>('/api/records'),
    get: (id: number) => fetchAPI<ProcurementRecord>(`/api/records/${id}`),
    update: (id: number, updates: Partial<ProcurementRecord>) =>
      fetchAPI<ProcurementRecord>(`/api/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: number) =>
      fetchAPI<{ status: string; id: number }>(`/api/records/${id}`, { method: 'DELETE' }),
    validate: (records: ProcurementRecord[]) =>
      fetchAPI<ProcurementRecord[]>('/api/records/validate', {
        method: 'POST',
        body: JSON.stringify(records),
      }),
    approveBatch: (records: ProcurementRecord[], sourceFile: string = '') =>
      fetchAPI<BatchApproveResponse>('/api/records/approve-batch', {
        method: 'POST',
        body: JSON.stringify({ records, source_file: sourceFile }),
      }),
    batchDelete: (ids: number[]) =>
      fetchAPI<{ deleted: number }>('/api/records/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    getComments: (id: number) =>
      fetchAPI<RecordComment[]>(`/api/records/${id}/comments`),
    addComment: (id: number, text: string) =>
      fetchAPI<RecordComment>(`/api/records/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    deleteComment: (recordId: number, commentId: number) =>
      fetchAPI<{ status: string; id: number }>(`/api/records/${recordId}/comments/${commentId}`, {
        method: 'DELETE',
      }),
  },

  historical: {
    search: (params: Record<string, string | number | undefined>) => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.set(k, String(v))
      })
      return fetchAPI<HistoricalSearchResult>(`/api/historical/search?${searchParams}`)
    },
    priceTrend: (sku: string) =>
      fetchAPI<PriceTrendResponse>(`/api/historical/price-trend/${encodeURIComponent(sku)}`),
    chartData: (params?: Record<string, string>) => {
      const searchParams = new URLSearchParams(params)
      return fetchAPI<{ records: ProcurementRecord[]; stats: Record<string, number> }>(
        `/api/historical/chart-data?${searchParams}`
      )
    },
    allSkus: () => fetchAPI<string[]>('/api/historical/all-skus'),
    batchStats: (skus: string[]) =>
      fetchAPI<BatchStatsResult>(
        `/api/historical/batch-stats?skus=${skus.map(encodeURIComponent).join(',')}`
      ),
  },

  companies: {
    list: () => fetchAPI<string[]>('/api/companies'),
  },

  distributors: {
    list: () => fetchAPI<string[]>('/api/distributors'),
  },

  analyst: {
    query: (
      query: string,
      contextRecords?: ProcurementRecord[],
      historicalSummary?: Record<string, unknown>
    ) =>
      fetchAPI<AnalystResponse>('/api/analyst', {
        method: 'POST',
        body: JSON.stringify({
          query,
          context_records: contextRecords,
          historical_summary: historicalSummary,
        }),
      }),
  },

  health: {
    h2ogpte: () => fetchAPI<HealthStatus>('/api/health/h2ogpte'),
  },

  catalog: {
    list: (params?: { search?: string; brand?: string; category?: string; limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        if (params.search) searchParams.set('search', params.search)
        if (params.brand) searchParams.set('brand', params.brand)
        if (params.category) searchParams.set('category', params.category)
        if (params.limit) searchParams.set('limit', String(params.limit))
      }
      return fetchAPI<CatalogEntry[]>(`/api/catalog?${searchParams}`)
    },

    stats: () => fetchAPI<CatalogStats>('/api/catalog/stats'),

    skus: () => fetchAPI<string[]>('/api/catalog/skus'),

    upload: async (file: File): Promise<CatalogUploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/api/catalog/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new APIError(res.status, await res.text())
      return res.json()
    },

    deleteEntry: (id: number) =>
      fetchAPI<{ status: string; id: number }>(`/api/catalog/${id}`, { method: 'DELETE' }),

    batchAdjustPrices: (pct: number, brand?: string, category?: string) =>
      fetchAPI<{ updated: number }>('/api/catalog/batch-adjust-prices', {
        method: 'POST',
        body: JSON.stringify({ pct, brand: brand || null, category: category || null }),
      }),

    uploadReferencePdf: async (file: File): Promise<ReferenceDocument> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/api/catalog/upload-reference-pdf`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new APIError(res.status, await res.text())
      return res.json()
    },

    listReferenceDocs: () =>
      fetchAPI<ReferenceDocument[]>('/api/catalog/reference-docs'),

    deleteReferenceDoc: (id: number) =>
      fetchAPI<{ status: string; id: number }>(`/api/catalog/reference-docs/${id}`, { method: 'DELETE' }),
  },

  uploads: {
    history: () => fetchAPI<UploadedFile[]>('/api/upload/history'),
    getDrafts: (filename: string) =>
      fetchAPI<ProcurementRecord[]>(`/api/upload/drafts/${encodeURIComponent(filename)}`),
    saveDrafts: (filename: string, records: ProcurementRecord[]) =>
      fetchAPI<{ saved: number }>(`/api/upload/drafts/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        body: JSON.stringify(records),
      }),
    updateStatus: (fileId: number, status?: string, recordsExtracted?: number) =>
      fetchAPI<{ ok: boolean }>(`/api/upload/${fileId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status || null, records_extracted: recordsExtracted ?? null }),
      }),
    delete: (fileId: number) =>
      fetchAPI<{ ok: boolean }>(`/api/upload/${fileId}`, { method: 'DELETE' }),
    fileUrl: (filename: string) =>
      `/api/files?name=${encodeURIComponent(filename)}`,
  },

  search: {
    global: (q: string) =>
      fetchAPI<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
  },
}
