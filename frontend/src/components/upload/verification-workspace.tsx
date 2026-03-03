'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import type { ProcurementRecord } from '@/lib/types'
import { DataTable } from '@/components/records/data-table'
import { EditableCell } from '@/components/records/editable-cell'
import { CurrencyCell } from '@/components/records/currency-cell'
import { ValidationBadge } from '@/components/records/validation-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2, CheckCheck } from 'lucide-react'

interface VerificationWorkspaceProps {
  records: ProcurementRecord[]
  onRecordsChange: (records: ProcurementRecord[]) => void
  onRevalidate: () => void
  isValidating?: boolean
}

export function VerificationWorkspace({
  records,
  onRecordsChange,
  onRevalidate,
  isValidating,
}: VerificationWorkspaceProps) {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const deleteIndexRef = useRef<number | null>(null)

  // Use refs to always read the latest values — avoids stale closures in callbacks
  const recordsRef = useRef(records)
  recordsRef.current = records
  const onChangeRef = useRef(onRecordsChange)
  onChangeRef.current = onRecordsChange

  const handleCellSave = useCallback((rowIndex: number, fieldKey: string, value: string | number | null) => {
    const current = recordsRef.current
    const updated = [...current]
    const numericFields = ['quantity', 'unit_price', 'total_price']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = { ...updated[rowIndex] } as any
    if (numericFields.includes(fieldKey) && value !== null) {
      const num = parseFloat(String(value))
      rec[fieldKey] = isNaN(num) ? value : num
    } else {
      rec[fieldKey] = value
    }
    // Clear field validation when user provides a value (remove stale warning)
    if (value !== null && value !== '' && rec.field_validation?.[fieldKey]) {
      const fv = { ...rec.field_validation }
      fv[fieldKey] = { status: 'valid', message: '', suggestion: '' }
      rec.field_validation = fv
      // Recalculate overall status
      let worst: 'valid' | 'warning' | 'error' = 'valid'
      for (const fd of Object.values(fv) as { status: string; acknowledged?: boolean }[]) {
        if (fd.acknowledged) continue
        if (fd.status === 'error') { worst = 'error'; break }
        if (fd.status === 'warning') worst = 'warning'
      }
      rec.validation_status = worst
    }
    updated[rowIndex] = { ...rec, user_modified: true }
    console.log('[handleCellSave]', { rowIndex, fieldKey, value, recordCount: updated.length })
    onChangeRef.current(updated)
  }, [])

  const handleAcknowledge = useCallback((rowIndex: number, fieldKey: string) => {
    const current = recordsRef.current
    const updated = [...current]
    const rec = { ...updated[rowIndex] }
    const fv = { ...(rec.field_validation || {}) }
    const field = { ...(fv[fieldKey] || { status: 'valid' as const, message: '' }) }

    // Toggle acknowledged
    field.acknowledged = !field.acknowledged
    fv[fieldKey] = field
    rec.field_validation = fv

    // Recalculate validation_status ignoring acknowledged fields
    let worst: 'valid' | 'warning' | 'error' = 'valid'
    for (const [, fd] of Object.entries(fv)) {
      if (fd.acknowledged) continue
      if (fd.status === 'error') { worst = 'error'; break }
      if (fd.status === 'warning') worst = 'warning'
    }
    rec.validation_status = worst

    updated[rowIndex] = rec
    onChangeRef.current(updated)
  }, [])

  const handleAcknowledgeAllWarnings = useCallback(() => {
    const current = recordsRef.current
    const updated = current.map((rec) => {
      const fv = rec.field_validation
      if (!fv) return rec
      let changed = false
      const newFv = { ...fv }
      for (const [key, field] of Object.entries(newFv)) {
        if (field.status === 'warning' && !field.acknowledged) {
          newFv[key] = { ...field, acknowledged: true }
          changed = true
        }
      }
      if (!changed) return rec
      // Recalculate overall status ignoring acknowledged fields
      let worst: 'valid' | 'warning' | 'error' = 'valid'
      for (const fd of Object.values(newFv) as { status: string; acknowledged?: boolean }[]) {
        if (fd.acknowledged) continue
        if (fd.status === 'error') { worst = 'error'; break }
        if (fd.status === 'warning') worst = 'warning'
      }
      return { ...rec, field_validation: newFv, validation_status: worst }
    })
    onChangeRef.current(updated)
  }, [])

  const handleDelete = () => {
    const idx = deleteIndexRef.current
    console.log('[handleDelete]', { idx, recordCount: recordsRef.current.length })
    if (idx !== null) {
      const updated = recordsRef.current.filter((_, i) => i !== idx)
      // Recalculate duplicate warnings — clear stale ones, keep valid ones
      recalcDuplicates(updated)
      onChangeRef.current(updated)
      deleteIndexRef.current = null
      setDeleteIndex(null)
    }
  }

  /** Recompute duplicate-SKU warnings after a record is removed. */
  function recalcDuplicates(recs: ProcurementRecord[]) {
    // Build composite key groups (same logic as backend)
    const groups: Record<string, number[]> = {}
    recs.forEach((r, i) => {
      const sku = (r.sku || '').trim().toUpperCase()
      const key = `${sku}|${r.unit_price}|${r.quantity}`
      ;(groups[key] ??= []).push(i)
    })

    for (const indices of Object.values(groups)) {
      if (indices.length >= 2) continue // still duplicates — leave warnings
      // Only one record with this key — clear the duplicate warning if present
      const rec = recs[indices[0]]
      const fv = rec.field_validation
      if (fv?.sku?.message?.includes('Possible duplicate')) {
        const newFv = { ...fv, sku: { status: 'valid' as const, message: '', suggestion: '' } }
        // Recalculate overall status
        let worst: 'valid' | 'warning' | 'error' = 'valid'
        for (const fd of Object.values(newFv) as { status: string; acknowledged?: boolean }[]) {
          if (fd.acknowledged) continue
          if (fd.status === 'error') { worst = 'error'; break }
          if (fd.status === 'warning') worst = 'warning'
        }
        recs[indices[0]] = { ...rec, field_validation: newFv, validation_status: worst }
      }
    }
  }

  const columns: ColumnDef<ProcurementRecord, unknown>[] = useMemo(() => [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <ValidationBadge status={(row.original.validation_status as 'valid' | 'warning' | 'error' | 'pending') || 'pending'} />
      ),
      size: 100,
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.sku}
          fieldKey="sku"
          fieldValidation={row.original.field_validation?.sku}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'item_description',
      header: 'Description',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.item_description}
          fieldKey="item_description"
          fieldValidation={row.original.field_validation?.item_description}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'brand',
      header: 'Brand',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.brand}
          fieldKey="brand"
          fieldValidation={row.original.field_validation?.brand}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'distributor',
      header: 'Distributor',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.distributor}
          fieldKey="distributor"
          fieldValidation={row.original.field_validation?.distributor}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'eu_company',
      header: 'Company',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.eu_company}
          fieldKey="eu_company"
          fieldValidation={row.original.field_validation?.eu_company}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.quantity}
          fieldKey="quantity"
          fieldValidation={row.original.field_validation?.quantity}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: 'Unit Price',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.unit_price}
          fieldKey="unit_price"
          fieldValidation={row.original.field_validation?.unit_price}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'total_price',
      header: 'Total',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.total_price}
          fieldKey="total_price"
          fieldValidation={row.original.field_validation?.total_price}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quote_currency',
      header: 'Currency',
      cell: ({ row }) => (
        <CurrencyCell
          value={row.original.quote_currency}
          fieldKey="quote_currency"
          fieldValidation={row.original.field_validation?.quote_currency}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'serial_no',
      header: 'Serial No',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.serial_no}
          fieldKey="serial_no"
          fieldValidation={row.original.field_validation?.serial_no}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.start_date}
          fieldKey="start_date"
          fieldValidation={row.original.field_validation?.start_date}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.end_date}
          fieldKey="end_date"
          fieldValidation={row.original.field_validation?.end_date}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quotation_ref_no',
      header: 'Quote Ref',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.quotation_ref_no}
          fieldKey="quotation_ref_no"
          fieldValidation={row.original.field_validation?.quotation_ref_no}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quotation_date',
      header: 'Quote Date',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.quotation_date}
          fieldKey="quotation_date"
          fieldValidation={row.original.field_validation?.quotation_date}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quotation_end_date',
      header: 'Quote End Date',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.quotation_end_date}
          fieldKey="quotation_end_date"
          fieldValidation={row.original.field_validation?.quotation_end_date}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'quotation_validity',
      header: 'Validity',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.quotation_validity}
          fieldKey="quotation_validity"
          fieldValidation={row.original.field_validation?.quotation_validity}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
          onAcknowledge={(k) => handleAcknowledge(row.index, k)}
        />
      ),
    },
    {
      accessorKey: 'comments_notes',
      header: 'Comments/Notes',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.comments_notes}
          fieldKey="comments_notes"
          fieldValidation={row.original.field_validation?.comments_notes}
          onSave={(k, v) => handleCellSave(row.index, k, v)}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-400"
          onClick={(e) => { e.stopPropagation(); deleteIndexRef.current = row.index; setDeleteIndex(row.index) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
      size: 40,
    },
  ], [handleCellSave, handleAcknowledge])

  const summary = useMemo(() => {
    const s = { valid: 0, warning: 0, error: 0 }
    records.forEach((r) => {
      const st = r.validation_status || 'pending'
      if (st in s) s[st as keyof typeof s]++
    })
    return s
  }, [records])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Extracted Records ({records.length})
            </CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400">{summary.valid} valid</span>
              <span className="text-amber-400">{summary.warning} warnings</span>
              <span className="text-red-400">{summary.error} errors</span>
              {summary.warning > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAllWarnings}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledge Warnings
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onRevalidate}
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : 'Re-validate'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={records}
            columns={columns}
            pageSize={10}
            rowClassName={(row) => {
              const fv = row.field_validation || {}
              const hasFieldError = Object.values(fv).some((f) => f.status === 'error' && !f.acknowledged)
              const hasFieldWarning = Object.values(fv).some((f) => f.status === 'warning' && !f.acknowledged)
              if (row.validation_status === 'error' || hasFieldError) return 'bg-red-500/5 shadow-[inset_3px_0_0_0_rgb(239,68,68)]'
              if (row.validation_status === 'warning' || hasFieldWarning) return 'bg-amber-500/5 shadow-[inset_3px_0_0_0_rgb(245,158,11)]'
              return ''
            }}
          />
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove this record? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteIndex(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
