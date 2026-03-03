'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, X, Edit2, Lightbulb, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldValidation } from '@/lib/types'

interface EditableCellProps {
  value: string | number | null
  fieldKey: string
  fieldValidation?: FieldValidation
  onSave: (key: string, value: string | number | null) => void
  onAcknowledge?: (fieldKey: string) => void
}

export function EditableCell({
  value,
  fieldKey,
  fieldValidation,
  onSave,
  onAcknowledge,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value ?? ''))

  const status = fieldValidation?.status || 'valid'
  const acknowledged = fieldValidation?.acknowledged
  const borderColor = status === 'error' ? 'border-red-500/50' : status === 'warning' ? 'border-amber-500/50' : ''

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-7 text-xs w-24"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(fieldKey, editValue || null)
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { onSave(fieldKey, editValue || null); setEditing(false) }}>
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'cursor-pointer rounded px-1.5 py-0.5 text-xs hover:bg-muted/50 group flex items-center gap-1 border border-transparent',
        borderColor
      )}
      onClick={() => setEditing(true)}
    >
      <div className="flex-1 min-w-0">
        <span className="whitespace-normal break-words">{value ?? '-'}</span>
        {fieldValidation?.message && !acknowledged && fieldValidation.status !== 'valid' && (
          <p className={cn(
            "text-[10px] leading-tight mt-0.5",
            fieldValidation.status === 'error' ? 'text-red-400/80' : 'text-amber-400/80'
          )}>
            {fieldValidation.message}
          </p>
        )}
        {acknowledged && (
          <p className="text-[10px] leading-tight mt-0.5 text-muted-foreground/60 italic">acknowledged</p>
        )}
      </div>
      {fieldValidation?.suggestion && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onSave(fieldKey, fieldValidation.suggestion!)
              }}
            >
              <Lightbulb className="h-3 w-3 text-amber-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Suggested: {fieldValidation.suggestion} / Click to apply
          </TooltipContent>
        </Tooltip>
      )}
      {status !== 'valid' && !acknowledged && onAcknowledge && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onAcknowledge(fieldKey)
              }}
            >
              <Check className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Acknowledge this warning</TooltipContent>
        </Tooltip>
      )}
      {acknowledged && onAcknowledge && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onAcknowledge(fieldKey)
              }}
            >
              <Undo2 className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Un-acknowledge</TooltipContent>
        </Tooltip>
      )}
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </div>
  )
}
