'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ProcurementRecord } from '@/lib/types'

export function useRecords() {
  return useQuery({
    queryKey: ['records'],
    queryFn: () => api.records.list(),
  })
}

export function useUpdateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<ProcurementRecord> }) =>
      api.records.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
  })
}

export function useDeleteRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.records.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
  })
}

export function useValidateRecords() {
  return useMutation({
    mutationFn: (records: ProcurementRecord[]) => api.records.validate(records),
  })
}

export function useApproveBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ records, sourceFile }: { records: ProcurementRecord[]; sourceFile: string }) =>
      api.records.approveBatch(records, sourceFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['historical'] })
    },
  })
}
