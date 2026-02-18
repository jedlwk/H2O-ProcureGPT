'use client'

import { Progress } from '@/components/ui/progress'
import { CheckCircle, Loader2, XCircle, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'uploading' | 'extracting' | 'completed' | 'error'

interface ExtractionStatusProps {
  status: Status
  message?: string
  recordCount?: number
}

const statusConfig = {
  idle: { icon: FileSearch, label: 'Ready to extract', progress: 0, color: 'text-muted-foreground' },
  uploading: { icon: Loader2, label: 'Uploading document...', progress: 30, color: 'text-primary' },
  extracting: { icon: Loader2, label: 'Extracting records via H2OGPTe...', progress: 65, color: 'text-primary' },
  completed: { icon: CheckCircle, label: 'Extraction complete', progress: 100, color: 'text-emerald-400' },
  error: { icon: XCircle, label: 'Extraction failed', progress: 0, color: 'text-red-400' },
}

export function ExtractionStatus({ status, message, recordCount }: ExtractionStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isAnimating = status === 'uploading' || status === 'extracting'

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', config.color, isAnimating && 'animate-spin')} />
        <div className="flex-1">
          <p className={cn('text-sm font-medium', config.color)}>
            {message || config.label}
          </p>
          {status === 'completed' && recordCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {recordCount} record{recordCount !== 1 ? 's' : ''} extracted
            </p>
          )}
        </div>
      </div>
      {(status === 'uploading' || status === 'extracting') && (
        <Progress value={config.progress} className="h-2" />
      )}
    </div>
  )
}
