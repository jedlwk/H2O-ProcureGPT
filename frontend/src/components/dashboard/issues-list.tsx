'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, XCircle, ArrowRight } from 'lucide-react'
import type { ProcurementRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

interface IssuesListProps {
  records: ProcurementRecord[]
}

export function IssuesList({ records }: IssuesListProps) {
  const errors = records.filter((r) => r.validation_status === 'error')
  const warnings = records.filter((r) => r.validation_status === 'warning')
  const issues = [...errors, ...warnings].slice(0, 8)

  if (issues.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {errors.length > 0 && <XCircle className="h-4 w-4 text-red-400" />}
            {errors.length === 0 && <AlertTriangle className="h-4 w-4 text-amber-400" />}
            Issues to Resolve
            <Badge variant="outline" className="ml-1 text-xs">
              {errors.length + warnings.length}
            </Badge>
          </CardTitle>
          <Link href="/validate">
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((rec, i) => {
          const isError = rec.validation_status === 'error'
          return (
            <div
              key={rec.id ?? i}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                isError
                  ? 'border-red-500/20 bg-red-500/5'
                  : 'border-amber-500/20 bg-amber-500/5'
              )}
            >
              {isError ? (
                <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium font-mono">{rec.sku}</span>
                  <span className="text-xs text-muted-foreground">{rec.eu_company}</span>
                </div>
                <p className={cn(
                  'text-xs mt-0.5',
                  isError ? 'text-red-400/80' : 'text-amber-400/80'
                )}>
                  {rec.validation_message}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] shrink-0',
                  isError
                    ? 'border-red-500/30 text-red-400'
                    : 'border-amber-500/30 text-amber-400'
                )}
              >
                {isError ? 'Error' : 'Warning'}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
