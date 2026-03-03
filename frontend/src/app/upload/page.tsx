'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { CompanySelector } from '@/components/upload/company-selector'
import { FileDropzone } from '@/components/upload/file-dropzone'
import { ExtractionStatus } from '@/components/upload/extraction-status'
import { VerificationWorkspace } from '@/components/upload/verification-workspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useExtractRecords } from '@/lib/hooks/use-upload'
import { useValidateRecords } from '@/lib/hooks/use-records'
import { api } from '@/lib/api'
import type { ProcurementRecord, UploadedFile } from '@/lib/types'
import { ArrowRight, RotateCcw, FileText, PanelLeftClose, PanelLeftOpen, Search, Trash2, RefreshCw } from 'lucide-react'

type Step = 'upload' | 'verify'

export default function UploadPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [euCompany, setEuCompany] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [records, setRecords] = useState<ProcurementRecord[]>([])
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'extracting' | 'completed' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [fileId, setFileId] = useState<number | null>(null)
  const [sourceFileName, setSourceFileName] = useState('')
  const markedValidatingRef = useRef(false)
  const userEdited = useRef(false)

  // Processed documents state
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [uploadsLoading, setUploadsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const extractMutation = useExtractRecords()
  const validateMutation = useValidateRecords()

  // Fetch upload history
  const fetchUploads = async () => {
    setUploadsLoading(true)
    try {
      const data = await api.uploads.history()
      setUploads(data)
    } catch {
      // silently fail — non-critical section
    } finally {
      setUploadsLoading(false)
    }
  }

  useEffect(() => { fetchUploads() }, [])

  // Hydrate from sessionStorage when coming from "Review" button
  useEffect(() => {
    const stored = sessionStorage.getItem('pendingRecords')
    const storedFile = sessionStorage.getItem('sourceFile')
    const storedFileId = sessionStorage.getItem('sourceFileId')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.length > 0) {
          const needsValidation = parsed.some((r: ProcurementRecord) => !r.field_validation)
          setRecords(parsed)
          setSourceFileName(storedFile || '')
          if (storedFileId) setFileId(Number(storedFileId))
          setExtractionStatus('completed')
          setStep('verify')
          sessionStorage.removeItem('pendingRecords')
          sessionStorage.removeItem('sourceFile')
          sessionStorage.removeItem('sourceFileId')
          if (needsValidation) {
            api.records.validate(parsed).then((validated) => {
              if (!userEdited.current) {
                setRecords(validated)
              }
            }).catch(() => {})
          }
        }
      } catch { /* empty */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExtract = async () => {
    if (!file) return
    setExtractionStatus('uploading')
    setErrorMessage('')

    try {
      setExtractionStatus('extracting')
      const result = await extractMutation.mutateAsync({ file, euCompany })
      setRecords(result.records)
      setFileId(result.file_id)
      setExtractionStatus('completed')
      toast.success(`Extracted ${result.records_extracted} records`)
      setStep('verify')
      // Refresh processed documents list
      fetchUploads()
    } catch (err) {
      setExtractionStatus('error')
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  const saveRecords = async (updated: ProcurementRecord[]) => {
    const fname = file?.name || sourceFileName
    if (!fname || updated.length === 0) return
    try {
      await api.uploads.saveDrafts(fname, updated)
    } catch (e) { console.error('[saveRecords] saveDrafts FAILED:', e) }
    if (fileId) {
      try {
        const status = !markedValidatingRef.current ? 'validating' : undefined
        await api.uploads.updateStatus(fileId, status, updated.length)
        if (!markedValidatingRef.current) {
          markedValidatingRef.current = true
          toast.success('Draft saved — status updated to Validating')
        }
      } catch (e) { console.error('[saveRecords] updateStatus FAILED:', e) }
    }
  }

  const handleRevalidate = async () => {
    try {
      const validated = await validateMutation.mutateAsync(records)
      setRecords(validated)
      saveRecords(validated)
      toast.success('Validation complete')
    } catch {
      toast.error('Validation failed')
    }
  }

  const handleProceed = async () => {
    const fname = file?.name || sourceFileName || ''
    if (fname) {
      await api.uploads.saveDrafts(fname, records).catch(e => console.error('[proceed] saveDrafts failed:', e))
    }
    if (fileId) {
      await api.uploads.updateStatus(fileId, 'validating').catch(e => console.error('[proceed] updateStatus failed:', e))
    }
    sessionStorage.setItem('pendingRecords', JSON.stringify(records))
    sessionStorage.setItem('sourceFile', fname)
    if (fileId) sessionStorage.setItem('sourceFileId', String(fileId))
    router.push('/validate')
  }

  const handleDiscard = () => {
    setRecords([])
    setFile(null)
    setExtractionStatus('idle')
    setStep('upload')
    toast.info('Discarded all records')
  }

  // Resume a processed upload into the verify step
  const handleResume = async (upload: UploadedFile) => {
    try {
      const originalName = upload.original_name || upload.filename
      const drafts = await api.uploads.getDrafts(originalName)
      if (drafts.length === 0) {
        toast.error('No draft records found. Records may have already been approved.')
        return
      }
      let validated = drafts
      try {
        validated = await api.records.validate(drafts)
      } catch { /* fall back to unvalidated */ }
      if (upload.upload_status !== 'validating') {
        await api.uploads.updateStatus(upload.id, 'validating').catch(() => {})
        setUploads((prev) => prev.map((u) => u.id === upload.id ? { ...u, upload_status: 'validating' } : u))
      }
      setRecords(validated)
      setSourceFileName(originalName)
      setFileId(upload.id)
      setExtractionStatus('completed')
      markedValidatingRef.current = true
      setStep('verify')
    } catch {
      toast.error('Failed to load records')
    }
  }

  const handleDeleteUpload = async (upload: UploadedFile) => {
    try {
      await api.uploads.delete(upload.id)
      setUploads((prev) => prev.filter((u) => u.id !== upload.id))
      toast.success(`Removed ${upload.original_name || upload.filename}`)
    } catch {
      toast.error('Failed to remove upload')
    }
  }

  const [showPreview, setShowPreview] = useState(false)

  const previewUrl = useMemo(() => {
    const name = file?.name || sourceFileName
    if (!name) return null
    return api.uploads.fileUrl(name)
  }, [file, sourceFileName])

  const fileName = file?.name || sourceFileName || 'Document'

  // Filter processed uploads by search query
  const filteredUploads = useMemo(() => {
    if (!searchQuery.trim()) return uploads
    const q = searchQuery.toLowerCase()
    return uploads.filter((u) =>
      (u.original_name || u.filename).toLowerCase().includes(q)
    )
  }, [uploads, searchQuery])

  const statusLabel = (status: string) => {
    switch (status) {
      case 'uploaded':
      case 'completed':
        return 'Newly Uploaded'
      case 'validating': return 'Validating'
      case 'approved': return 'Approved'
      case 'processing': return 'Processing'
      case 'error': return 'Error'
      default: return status
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'validating': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'processing': return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload & Extract"
        description="Upload procurement documents and extract structured data"
      />

      {/* Upload area — company selector + file dropzone together */}
      {step === 'upload' && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <CompanySelector value={euCompany} onChange={setEuCompany} />
              <FileDropzone
                file={file}
                onFileSelect={setFile}
                disabled={extractionStatus === 'extracting'}
              />
            </div>

            <ExtractionStatus
              status={extractionStatus}
              message={errorMessage || undefined}
              recordCount={records.length}
            />

            <div className="flex justify-end gap-2">
              {extractionStatus === 'error' && (
                <Button variant="outline" onClick={() => setExtractionStatus('idle')}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              <Button
                onClick={handleExtract}
                disabled={!file || extractionStatus === 'extracting' || extractionStatus === 'uploading'}
              >
                {extractionStatus === 'extracting' ? 'Extracting...' : 'Extract Records'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification workspace with original file sidebar */}
      {step === 'verify' && (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            {previewUrl && !showPreview && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                >
                  <PanelLeftOpen className="h-4 w-4 mr-2" />
                  View Original
                </Button>
              </div>
            )}

            <VerificationWorkspace
              records={records}
              onRecordsChange={(updated) => { userEdited.current = true; setRecords(updated); saveRecords(updated) }}
              onRevalidate={handleRevalidate}
              isValidating={validateMutation.isPending}
            />

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleDiscard}>
                Discard All
              </Button>
              <Button
                onClick={handleProceed}
                disabled={records.length === 0}
              >
                Proceed to Benchmark
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {showPreview && previewUrl && (
            <div className="w-[480px] shrink-0 flex flex-col rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{fileName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setShowPreview(false)}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[calc(100vh-280px)]"
                  title="Original document"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processed Documents — visible when not in verify step */}
      {step !== 'verify' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Processed Documents</h2>
            <Button variant="ghost" size="sm" onClick={fetchUploads} disabled={uploadsLoading}>
              <RefreshCw className={`h-4 w-4 ${uploadsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {uploadsLoading && uploads.length === 0 ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading uploads...</p>
              </CardContent>
            </Card>
          ) : filteredUploads.length === 0 ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No uploads match your search' : 'No processed documents yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredUploads.map((upload) => (
                <Card key={upload.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{upload.original_name || upload.filename}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(upload.uploaded_at).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {upload.file_type?.toUpperCase()}
                          </span>
                          {upload.file_size > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {(upload.file_size / 1024).toFixed(0)} KB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={statusColor(upload.upload_status)}>
                        {statusLabel(upload.upload_status)}
                      </Badge>
                      {upload.records_extracted > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {upload.records_extracted} records
                        </span>
                      )}
                      {['uploaded', 'validating', 'completed'].includes(upload.upload_status) && upload.records_extracted > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResume(upload)}
                        >
                          {upload.upload_status === 'validating' ? 'Continue Review' : 'Review'}
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteUpload(upload)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
