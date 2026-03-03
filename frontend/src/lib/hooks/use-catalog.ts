import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CatalogEntry, CatalogStats, CatalogUploadResponse, ReferenceDocument } from '@/lib/types'

export function useCatalogEntries(params?: { search?: string; brand?: string; category?: string; limit?: number }) {
  return useQuery({
    queryKey: ['catalog', params],
    queryFn: () => api.catalog.list(params),
  })
}

export function useCatalogStats() {
  return useQuery({
    queryKey: ['catalog-stats'],
    queryFn: () => api.catalog.stats(),
  })
}

export function useUploadCatalog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => api.catalog.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stats'] })
    },
  })
}

export function useDeleteCatalogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.catalog.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stats'] })
    },
  })
}

export function useReferenceDocs() {
  return useQuery({
    queryKey: ['reference-docs'],
    queryFn: () => api.catalog.listReferenceDocs(),
  })
}

export function useUploadReferencePdf() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => api.catalog.uploadReferencePdf(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-docs'] })
    },
  })
}

export function useDeleteReferenceDoc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.catalog.deleteReferenceDoc(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-docs'] })
    },
  })
}
