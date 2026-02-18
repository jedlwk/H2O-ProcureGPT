import type {
  DashboardMetrics,
  UploadResponse,
  ProcurementRecord,
  HistoricalSearchResult,
  PriceTrendResponse,
  AnalystResponse,
  HealthStatus,
  BatchApproveResponse,
  BatchStatsResult,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
}
