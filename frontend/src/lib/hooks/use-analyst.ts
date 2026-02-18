'use client'

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ProcurementRecord } from '@/lib/types'

export function useAnalystQuery() {
  return useMutation({
    mutationFn: ({
      query,
      contextRecords,
      historicalSummary,
    }: {
      query: string
      contextRecords?: ProcurementRecord[]
      historicalSummary?: Record<string, unknown>
    }) => api.analyst.query(query, contextRecords, historicalSummary),
  })
}
