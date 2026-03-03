'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldValidation } from '@/lib/types'

const CURRENCIES = ['SGD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'MYR', 'AUD'] as const

interface CurrencyCellProps {
  value: string | null
  fieldKey: string
  fieldValidation?: FieldValidation
  onSave: (key: string, value: string | null) => void
  onAcknowledge?: (fieldKey: string) => void
}

export function CurrencyCell({
  value,
  fieldKey,
  fieldValidation,
  onSave,
  onAcknowledge,
}: CurrencyCellProps) {
  const status = fieldValidation?.status || 'valid'
  const acknowledged = fieldValidation?.acknowledged
  const borderColor = status === 'error' ? 'border-red-500/50' : status === 'warning' ? 'border-amber-500/50' : ''

  return (
    <div className={cn('group flex items-center gap-1 rounded border border-transparent', borderColor)}>
      <Select
        value={value || ''}
        onValueChange={(v) => onSave(fieldKey, v || null)}
      >
        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-1.5 py-0.5 w-20">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fieldValidation?.message && !acknowledged && status !== 'valid' && (
        <p className={cn(
          'text-[10px] leading-tight',
          status === 'error' ? 'text-red-400/80' : 'text-amber-400/80'
        )}>
          {fieldValidation.message}
        </p>
      )}
      {status !== 'valid' && !acknowledged && onAcknowledge && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onAcknowledge(fieldKey) }}
            >
              <Check className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Acknowledge</TooltipContent>
        </Tooltip>
      )}
      {acknowledged && onAcknowledge && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onAcknowledge(fieldKey) }}
            >
              <Undo2 className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Un-acknowledge</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
