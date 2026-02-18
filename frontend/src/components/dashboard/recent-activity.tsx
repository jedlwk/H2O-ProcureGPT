'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
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
      <CardHeader>
        <CardTitle className="text-base">Recent Uploads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {uploads.slice(0, 5).map((file) => (
          <div key={file.id} className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.original_name || file.filename}</p>
              <p className="text-xs text-muted-foreground">
                {file.records_extracted} records
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={file.upload_status === 'completed' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {file.upload_status}
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
