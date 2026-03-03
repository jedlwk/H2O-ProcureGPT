'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UploadedFile } from '@/lib/types'

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'border-l-emerald-500'
    case 'validating':
      return 'border-l-amber-500'
    default:
      return 'border-l-blue-500'
  }
}

interface RecentActivityProps {
  uploads: UploadedFile[]
}

export function RecentActivity({ uploads }: RecentActivityProps) {
  if (!uploads?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent uploads</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent Uploads</CardTitle>
        <Link href="/uploads" className="text-xs text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {uploads.slice(0, 5).map((file) => (
          <div
            key={file.id}
            className={cn(
              'flex items-center gap-3 border-l-2 pl-3 py-2 rounded-r-md',
              statusColor(file.upload_status)
            )}
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.original_name || file.filename}</p>
              <p className="text-xs text-muted-foreground">
                {file.records_extracted} records
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  file.upload_status === 'validating' ? 'border-amber-500/30 text-amber-500' :
                  file.upload_status === 'completed' || file.upload_status === 'approved' ? 'border-emerald-500/30 text-emerald-500' :
                  'border-blue-500/30 text-blue-500'
                }`}
              >
                {file.upload_status === 'validating' ? 'Validating' :
                 file.upload_status === 'completed' || file.upload_status === 'approved' ? 'Approved' :
                 'Uploaded'}
              </Badge>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(file.uploaded_at)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
