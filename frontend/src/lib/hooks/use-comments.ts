'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

export function useComments(recordId: number) {
  return useQuery({
    queryKey: ['comments', recordId],
    queryFn: () => api.records.getComments(recordId),
    enabled: recordId > 0,
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recordId, text }: { recordId: number; text: string }) =>
      api.records.addComment(recordId, text),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', recordId] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recordId, commentId }: { recordId: number; commentId: number }) =>
      api.records.deleteComment(recordId, commentId),
    onSuccess: (_, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', recordId] })
    },
  })
}
