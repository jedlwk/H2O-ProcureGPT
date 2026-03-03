'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ValidationSummary } from '@/lib/types'

interface DataQualityBarProps {
  validation: ValidationSummary
}

export function DataQualityBar({ validation }: DataQualityBarProps) {
  const total = validation.valid + validation.warning + validation.error
  if (total === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <p className="text-sm text-muted-foreground">No records to validate yet. Upload a quote to get started.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/upload">Upload Quote</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const validPct = (validation.valid / total) * 100
  const warningPct = (validation.warning / total) * 100
  const errorPct = (validation.error / total) * 100

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Data Quality</h3>
          <Button variant="outline" size="sm" asChild>
            <Link href="/validate">Review Issues</Link>
          </Button>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {validPct > 0 && (
            <div
              className="bg-emerald-400 transition-all"
              style={{ width: `${validPct}%` }}
            />
          )}
          {warningPct > 0 && (
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${warningPct}%` }}
            />
          )}
          {errorPct > 0 && (
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${errorPct}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {validation.valid} valid ({Math.round(validPct)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            {validation.warning} warnings
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            {validation.error} errors
          </span>
        </div>
        {validation.error > 0 && (
          <p className="text-xs text-muted-foreground">
            {Math.round(validPct)}% of records passed validation. {validation.error} error{validation.error !== 1 ? 's' : ''} need{validation.error === 1 ? 's' : ''} review.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
