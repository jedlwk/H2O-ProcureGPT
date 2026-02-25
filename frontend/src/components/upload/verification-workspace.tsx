'use client'

import { useState, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import type { ProcurementRecord } from '@/lib/types'
import { DataTable } from '@/components/records/data-table'
import { EditableCell } from '@/components/records/editable-cell'
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
import { Trash2 } from 'lucide-react'

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

  const handleCellSave = useCallback((rowIndex: number, fieldKey: string, value: string | number | null) => {
    const updated = [...records]
    const numericFields = ['quantity', 'unit_price', 'total_price']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = updated[rowIndex] as any
    if (numericFields.includes(fieldKey) && value !== null) {
      const num = parseFloat(String(value))
      rec[fieldKey] = isNaN(num) ? value : num
    } else {
      rec[fieldKey] = value
    }
    updated[rowIndex] = { ...rec, user_modified: true }
    onRecordsChange(updated)
  }, [records, onRecordsChange])

  const handleDelete = () => {
    if (deleteIndex !== null) {
      const updated = records.filter((_, i) => i !== deleteIndex)
      onRecordsChange(updated)
      setDeleteIndex(null)
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
          onClick={(e) => { e.stopPropagation(); setDeleteIndex(row.index) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
      size: 40,
    },
  ], [handleCellSave])

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
          <DataTable data={records} columns={columns} pageSize={10} />
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
