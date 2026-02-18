'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const config = {
  valid: { icon: CheckCircle, label: 'Valid', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  warning: { icon: AlertTriangle, label: 'Warning', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  error: { icon: XCircle, label: 'Error', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  pending: { icon: Clock, label: 'Pending', className: 'bg-muted text-muted-foreground border-border' },
}

interface ValidationBadgeProps {
  status: 'valid' | 'warning' | 'error' | 'pending'
  className?: string
}

export function ValidationBadge({ status, className }: ValidationBadgeProps) {
  const { icon: Icon, label, className: badgeClass } = config[status] || config.pending
  return (
    <Badge variant="outline" className={cn('gap-1', badgeClass, className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
