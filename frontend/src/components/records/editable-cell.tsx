'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, X, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableCellProps {
  value: string | number | null
  fieldKey: string
  fieldValidation?: { status: string; message: string }
  onSave: (key: string, value: string | number | null) => void
}

export function EditableCell({
  value,
  fieldKey,
  fieldValidation,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value ?? ''))

  const status = fieldValidation?.status || 'valid'
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
      title={fieldValidation?.message}
    >
      <span className="truncate max-w-32">{value ?? '-'}</span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </div>
  )
}
