'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useHistoricalSearch(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['historical', params],
    queryFn: () => api.historical.search(params),
  })
}

export function usePriceTrend(sku: string | null) {
  return useQuery({
    queryKey: ['price-trend', sku],
    queryFn: () => api.historical.priceTrend(sku!),
    enabled: !!sku,
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => api.companies.list(),
  })
}

export function useDistributors() {
  return useQuery({
    queryKey: ['distributors'],
    queryFn: () => api.distributors.list(),
  })
}

export function useAllSkus() {
  return useQuery({
    queryKey: ['all-skus'],
    queryFn: () => api.historical.allSkus(),
  })
}
