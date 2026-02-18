'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { CompanySelector } from '@/components/upload/company-selector'
import { FileDropzone } from '@/components/upload/file-dropzone'
import { ExtractionStatus } from '@/components/upload/extraction-status'
import { VerificationWorkspace } from '@/components/upload/verification-workspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useExtractRecords } from '@/lib/hooks/use-upload'
import { useValidateRecords } from '@/lib/hooks/use-records'
import type { ProcurementRecord } from '@/lib/types'
import { ArrowRight, RotateCcw } from 'lucide-react'

type Step = 'company' | 'upload' | 'verify'

export default function UploadPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('company')
  const [euCompany, setEuCompany] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [records, setRecords] = useState<ProcurementRecord[]>([])
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'extracting' | 'completed' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const extractMutation = useExtractRecords()
  const validateMutation = useValidateRecords()

  const handleExtract = async () => {
    if (!file) return
    setExtractionStatus('uploading')
    setErrorMessage('')

    try {
      setExtractionStatus('extracting')
      const result = await extractMutation.mutateAsync({ file, euCompany })
      setRecords(result.records)
      setExtractionStatus('completed')
      toast.success(`Extracted ${result.records_extracted} records`)
      setStep('verify')
    } catch (err) {
      setExtractionStatus('error')
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  const handleRevalidate = async () => {
    try {
      const validated = await validateMutation.mutateAsync(records)
      setRecords(validated)
      toast.success('Validation complete')
    } catch {
      toast.error('Validation failed')
    }
  }

  const handleProceed = () => {
    // Store records in sessionStorage for the validate page
    sessionStorage.setItem('pendingRecords', JSON.stringify(records))
    sessionStorage.setItem('sourceFile', file?.name || '')
    router.push('/validate')
  }

  const handleDiscard = () => {
    setRecords([])
    setFile(null)
    setExtractionStatus('idle')
    setStep('company')
    toast.info('Discarded all records')
  }

  const stepIndex = step === 'company' ? 0 : step === 'upload' ? 1 : 2

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload & Extract"
        description="Upload a procurement document and extract structured data"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {['Company', 'Upload & Extract', 'Verify'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i <= stepIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${
                i <= stepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 0: Company selection */}
      {step === 'company' && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <CompanySelector value={euCompany} onChange={setEuCompany} />
            <Button
              onClick={() => setStep('upload')}
              disabled={!euCompany}
            >
              Continue to Upload
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Upload & Extract */}
      {step === 'upload' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Company: <span className="font-medium text-foreground">{euCompany}</span>
                </p>
              </div>

              <FileDropzone
                file={file}
                onFileSelect={setFile}
                disabled={extractionStatus === 'extracting'}
              />

              <ExtractionStatus
                status={extractionStatus}
                message={errorMessage || undefined}
                recordCount={records.length}
              />

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('company')}>
                  Back
                </Button>
                <div className="flex gap-2">
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Verification workspace */}
      {step === 'verify' && (
        <div className="space-y-4">
          <VerificationWorkspace
            records={records}
            onRecordsChange={setRecords}
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
      )}
    </div>
  )
}
