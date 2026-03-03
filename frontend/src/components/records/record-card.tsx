'use client'

import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EditableCell } from '@/components/records/editable-cell'
import { CurrencyCell } from '@/components/records/currency-cell'
import { ValidationBadge } from '@/components/records/validation-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronDown, MessageSquare, Trash2, BookOpen, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ProcurementRecord, SkuPriceSummary } from '@/lib/types'

// Shared grid template — used by both the header row and each card
export const CARD_GRID_CLASSES = 'grid items-center gap-x-4'
export const CARD_GRID_COLS = 'grid-cols-[80px_140px_1fr_140px_60px_90px_90px_100px_120px]'

export function BenchmarkDot({ price, stats }: { price: number | null; stats?: SkuPriceSummary }) {
  if (!price || !stats || !stats.avg_price) return <span className="text-muted-foreground text-xs">—</span>
  const avg = stats.avg_price
  const deviation = Math.abs(price - avg) / avg
  let color = 'bg-emerald-500'
  let label = 'Within 10% of avg'
  if (deviation > 0.30) { color = 'bg-red-500'; label = `${(deviation * 100).toFixed(0)}% from avg` }
  else if (deviation > 0.10) { color = 'bg-amber-500'; label = `${(deviation * 100).toFixed(0)}% from avg` }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
          <span className="text-[10px] text-muted-foreground">${avg.toFixed(0)}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-0.5">
          <p>Avg: ${avg.toFixed(2)}</p>
          <p>Range: ${stats.min_price.toFixed(2)} – ${stats.max_price.toFixed(2)}</p>
          <p>Current: ${price.toFixed(2)}</p>
          <p className="font-medium">{label}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/** Column header row — render once above the card list */
export function RecordCardHeader() {
  return (
    <div className={cn(CARD_GRID_CLASSES, CARD_GRID_COLS, 'px-5 py-2.5 text-xs font-medium text-muted-foreground')}>
      <span>Status</span>
      <span>SKU</span>
      <span>Description</span>
      <span>Unit Price</span>
      <span>Qty</span>
      <span className="text-right">Total</span>
      <span>Brand</span>
      <span>Distributor</span>
      <span />
    </div>
  )
}

interface RecordCardProps {
  record: ProcurementRecord
  index: number
  historicalStats?: SkuPriceSummary
  hasComments?: boolean
  onCellSave: (rowIndex: number, fieldKey: string, value: string | number | null) => void
  onAcknowledge: (rowIndex: number, fieldKey: string) => void
  onDelete: (index: number) => void
  onOpenComments: () => void
}

export function RecordCard({
  record,
  index,
  historicalStats,
  hasComments,
  onCellSave,
  onAcknowledge,
  onDelete,
  onOpenComments,
}: RecordCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [historyData, setHistoryData] = useState<ProcurementRecord[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (isOpen && !historyData && record.sku) {
      setHistoryLoading(true)
      api.historical.search({ sku: record.sku })
        .then(result => setHistoryData(result.records))
        .catch(() => setHistoryData([]))
        .finally(() => setHistoryLoading(false))
    }
  }, [isOpen, historyData, record.sku])

  const fv = record.field_validation || {}
  const hasFieldError = Object.values(fv).some((f) => f.status === 'error' && !f.acknowledged)
  const hasFieldWarning = Object.values(fv).some((f) => f.status === 'warning' && !f.acknowledged)
  const isDuplicate = fv.sku?.message?.includes('Possible duplicate')

  let cardBorder = 'border-border'
  let cardBg = ''
  if (record.validation_status === 'error' || hasFieldError) {
    cardBorder = 'border-red-500/30'
    cardBg = 'bg-red-500/5 shadow-[inset_3px_0_0_0_rgb(239,68,68)]'
  } else if (record.validation_status === 'warning' || hasFieldWarning) {
    cardBorder = 'border-amber-500/30'
    cardBg = 'bg-amber-500/5 shadow-[inset_3px_0_0_0_rgb(245,158,11)]'
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border', cardBorder, cardBg)}>
        {/* Summary row — grid aligned with header */}
        <div className={cn(CARD_GRID_CLASSES, CARD_GRID_COLS, 'px-5 py-3')}>
          {/* Status */}
          <ValidationBadge
            status={(record.validation_status as 'valid' | 'warning' | 'error' | 'pending') || 'pending'}
          />

          {/* SKU */}
          <div className="flex items-center gap-1.5 min-w-0">
            <EditableCell
              value={record.sku}
              fieldKey="sku"
              fieldValidation={fv.sku}
              onSave={(k, v) => onCellSave(index, k, v)}
              onAcknowledge={(k) => onAcknowledge(index, k)}
            />
            {isDuplicate && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[10px] px-1 py-0 shrink-0">dup</Badge>}
          </div>

          {/* Description */}
          <div className="min-w-0 text-sm text-muted-foreground truncate" title={record.item_description || ''}>
            {record.item_description || '—'}
          </div>

          {/* Unit Price + Benchmark */}
          <div className="flex items-center gap-2 min-w-0">
            <EditableCell
              value={record.unit_price}
              fieldKey="unit_price"
              fieldValidation={fv.unit_price}
              onSave={(k, v) => onCellSave(index, k, v)}
              onAcknowledge={(k) => onAcknowledge(index, k)}
            />
            <BenchmarkDot price={record.unit_price} stats={historicalStats} />
          </div>

          {/* Qty */}
          <EditableCell
            value={record.quantity}
            fieldKey="quantity"
            fieldValidation={fv.quantity}
            onSave={(k, v) => onCellSave(index, k, v)}
            onAcknowledge={(k) => onAcknowledge(index, k)}
          />

          {/* Total */}
          <span className="text-sm text-right font-medium tabular-nums">
            {record.total_price != null ? `$${record.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
          </span>

          {/* Brand */}
          <span className="text-sm text-muted-foreground truncate" title={record.brand || ''}>
            {record.brand || '—'}
          </span>

          {/* Distributor */}
          <span className="text-sm text-muted-foreground truncate" title={record.distributor || ''}>
            {record.distributor || '—'}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1 justify-end">
            {record.catalog_match && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-8 w-8 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Catalog match</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary relative"
              onClick={(e) => { e.stopPropagation(); onOpenComments() }}
            >
              <MessageSquare className="h-4 w-4" />
              {hasComments && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(index) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded section */}
        <CollapsibleContent>
          <div className="border-t border-border px-6 py-5 space-y-6">
            {/* Secondary fields grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
              <FieldGroup label="Description">
                <EditableCell
                  value={record.item_description}
                  fieldKey="item_description"
                  fieldValidation={fv.item_description}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Currency">
                <CurrencyCell
                  value={record.quote_currency}
                  fieldKey="quote_currency"
                  fieldValidation={fv.quote_currency}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Serial No">
                <EditableCell
                  value={record.serial_no}
                  fieldKey="serial_no"
                  fieldValidation={fv.serial_no}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Company">
                <EditableCell
                  value={record.eu_company}
                  fieldKey="eu_company"
                  fieldValidation={fv.eu_company}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Start Date">
                <EditableCell
                  value={record.start_date}
                  fieldKey="start_date"
                  fieldValidation={fv.start_date}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="End Date">
                <EditableCell
                  value={record.end_date}
                  fieldKey="end_date"
                  fieldValidation={fv.end_date}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Quote Ref">
                <EditableCell
                  value={record.quotation_ref_no}
                  fieldKey="quotation_ref_no"
                  fieldValidation={fv.quotation_ref_no}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Quote Date">
                <EditableCell
                  value={record.quotation_date}
                  fieldKey="quotation_date"
                  fieldValidation={fv.quotation_date}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Validity">
                <EditableCell
                  value={record.quotation_validity}
                  fieldKey="quotation_validity"
                  fieldValidation={fv.quotation_validity}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Brand">
                <EditableCell
                  value={record.brand}
                  fieldKey="brand"
                  fieldValidation={fv.brand}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Distributor">
                <EditableCell
                  value={record.distributor}
                  fieldKey="distributor"
                  fieldValidation={fv.distributor}
                  onSave={(k, v) => onCellSave(index, k, v)}
                  onAcknowledge={(k) => onAcknowledge(index, k)}
                />
              </FieldGroup>
              <FieldGroup label="Notes">
                <EditableCell
                  value={record.comments_notes}
                  fieldKey="comments_notes"
                  fieldValidation={fv.comments_notes}
                  onSave={(k, v) => onCellSave(index, k, v)}
                />
              </FieldGroup>
            </div>

            {/* Historical records mini-table */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Historical Records for {record.sku || 'this SKU'}
              </h4>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading historical data...
                </div>
              ) : historyData && historyData.length > 0 ? (
                <div className="rounded-md border border-border overflow-x-auto">
                  <table className="text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">SKU</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Description</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Brand</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Distributor</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Company</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Unit Price</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Total</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Ccy</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Serial No</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Start Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">End Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Quote Ref</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Quote Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Validity</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.slice(0, 12).map((h, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-xs">{h.sku || '—'}</td>
                          <td className="px-3 py-2 max-w-48 truncate">{h.item_description || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.brand || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.distributor || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.eu_company || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{h.quantity ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.unit_price != null ? `$${h.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.total_price != null ? `$${h.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{h.quote_currency || '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{h.serial_no || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.start_date || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.end_date || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{h.quotation_ref_no || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.quotation_date || h.created_at?.slice(0, 10) || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{h.quotation_validity || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{h.source_file || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 py-3">No historical data found</p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div>{children}</div>
    </div>
  )
}
