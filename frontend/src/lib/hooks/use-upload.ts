'use client'

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, euCompany }: { file: File; euCompany: string }) =>
      api.upload.uploadFile(file, euCompany),
  })
}

export function useExtractRecords() {
  return useMutation({
    mutationFn: ({ file, euCompany }: { file: File; euCompany: string }) =>
      api.upload.extractRecords(file, euCompany),
  })
}

export function useVerifyDocument() {
  return useMutation({
    mutationFn: (file: File) => api.upload.verifyDocument(file),
  })
}
