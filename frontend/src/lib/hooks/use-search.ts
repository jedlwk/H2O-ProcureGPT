'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search.global(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
