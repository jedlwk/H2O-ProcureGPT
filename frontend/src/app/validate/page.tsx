'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { FilterBar } from '@/components/records/filter-bar'
import { RecordCard, RecordCardHeader } from '@/components/records/record-card'
import { IssuesList } from '@/components/dashboard/issues-list'
import { PriceRangeChart } from '@/components/charts/price-range-chart'
import { SavingsWaterfallChart } from '@/components/charts/savings-waterfall-chart'
import { SpendConcentrationChart } from '@/components/charts/spend-concentration-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useApproveBatch, useValidateRecords } from '@/lib/hooks/use-records'
import { useCompanies, useDistributors } from '@/lib/hooks/use-historical'
// DB comment hooks unused on Validate page — records are in-memory pre-approval
import type { ProcurementRecord, BatchStatsResult, RecordComment } from '@/lib/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Download, CheckCircle, AlertTriangle, RotateCcw, Save, MessageCircle, X, BarChart3, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 20

export default function ValidatePage() {
  const router = useRouter()
  const [records, setRecords] = useState<ProcurementRecord[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [sourceFileId, setSourceFileId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    sku: '', distributor: '', eu_company: '', status: 'all', date_from: '', date_to: '',
  })
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [lastDeleted, setLastDeleted] = useState<ProcurementRecord | null>(null)
  const [commentRowIndex, setCommentRowIndex] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [localComments, setLocalComments] = useState<Record<number, RecordComment[]>>({})
  const [activeTab, setActiveTab] = useState('validate')
  const [page, setPage] = useState(0)
  const [savedFilters, setSavedFilters] = useState<Record<string, typeof filters>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('savedFilters')
      return stored ? JSON.parse(stored) : {}
    }
    return {}
  })

  const [historicalStats, setHistoricalStats] = useState<BatchStatsResult>({})

  const approveMutation = useApproveBatch()
  const validateMutation = useValidateRecords()
  const { data: companies } = useCompanies()
  const { data: distributors } = useDistributors()
  const commentRecord = commentRowIndex !== null ? records[commentRowIndex] : null

  // On the Validate page, records are always in-memory (pre-approval),
  // so always use local comments — DB comments only work after approval.
  const comments = commentRowIndex !== null ? localComments[commentRowIndex] : undefined

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingRecords')
    const storedFile = sessionStorage.getItem('sourceFile')
    const storedFileId = sessionStorage.getItem('sourceFileId')
    if (stored) {
      try {
        setRecords(JSON.parse(stored))
      } catch { /* empty */ }
    }
    if (storedFile) setSourceFile(storedFile)
    if (storedFileId) setSourceFileId(Number(storedFileId))
  }, [])

  // Fetch real historical stats for extracted SKUs
  useEffect(() => {
    const skus = [...new Set(records.map((r) => r.sku).filter(Boolean))] as string[]
    if (skus.length === 0) return
    api.historical.batchStats(skus).then(setHistoricalStats).catch(() => {})
  }, [records])

  // Persist records to sessionStorage on change
  const updateRecords = useCallback((updated: ProcurementRecord[]) => {
    setRecords(updated)
    sessionStorage.setItem('pendingRecords', JSON.stringify(updated))
  }, [])

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
    updateRecords(updated)
  }, [records, updateRecords])

  const handleAcknowledge = useCallback((rowIndex: number, fieldKey: string) => {
    const updated = [...records]
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
    updateRecords(updated)
  }, [records, updateRecords])

  const handleDelete = () => {
    if (deleteIndex !== null) {
      const deleted = records[deleteIndex]
      const updated = records.filter((_, i) => i !== deleteIndex)
      updateRecords(updated)
      setDeleteIndex(null)
      setLastDeleted(deleted)
      toast.success('Record removed', {
        action: {
          label: 'Undo',
          onClick: () => {
            updateRecords([deleted, ...records])
            setLastDeleted(null)
          },
        },
      })
    }
  }


  const handleRevalidate = async () => {
    try {
      const validated = await validateMutation.mutateAsync(records)
      updateRecords(validated)
      toast.success('Re-validation complete')
    } catch {
      toast.error('Re-validation failed')
    }
  }

  const handleSaveFilter = (name: string) => {
    const updated = { ...savedFilters, [name]: filters }
    setSavedFilters(updated)
    localStorage.setItem('savedFilters', JSON.stringify(updated))
    toast.success(`Filter saved as "${name}"`)
  }

  const handleLoadFilter = (name: string) => {
    const filter = savedFilters[name]
    if (filter) {
      setFilters(filter)
      toast.success(`Loaded filter "${name}"`)
    }
  }

  const handleAddComment = () => {
    if (commentRowIndex === null || !commentText.trim()) return
    const newComment: RecordComment = {
      id: Date.now(),
      record_id: 0,
      text: commentText.trim(),
      created_at: new Date().toISOString(),
    }
    setLocalComments((prev) => ({
      ...prev,
      [commentRowIndex]: [...(prev[commentRowIndex] || []), newComment],
    }))
    setCommentText('')
    toast.success('Comment added')
  }

  const handleDeleteComment = (commentId: number) => {
    if (commentRowIndex === null) return
    setLocalComments((prev) => ({
      ...prev,
      [commentRowIndex]: (prev[commentRowIndex] || []).filter((c) => c.id !== commentId),
    }))
    toast.success('Comment deleted')
  }

  const issueRecords = useMemo(
    () => records.filter((r) => r.validation_status === 'error' || r.validation_status === 'warning'),
    [records],
  )

  const duplicateCount = useMemo(
    () => records.filter((r) => r.field_validation?.sku?.message?.includes('Possible duplicate')).length,
    [records],
  )

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filters.sku && !(r.sku || '').toLowerCase().includes(filters.sku.toLowerCase())) return false
      if (filters.distributor && r.distributor !== filters.distributor) return false
      if (filters.eu_company && r.eu_company !== filters.eu_company) return false
      if (filters.status !== 'all' && r.validation_status !== filters.status) return false
      return true
    })
  }, [records, filters])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [filters])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const paginatedRecords = useMemo(
    () => filteredRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRecords, page],
  )

  const summary = useMemo(() => {
    const total = filteredRecords.reduce((sum, r) => sum + (r.total_price || 0), 0)
    const items = filteredRecords.length
    const aboveAvg = filteredRecords.filter((r) => {
      const fv = r.field_validation?.unit_price
      return fv && (fv.status === 'warning' || fv.status === 'error')
    }).length
    const errors = filteredRecords.filter((r) => r.validation_status === 'error').length
    const warnings = filteredRecords.filter((r) => r.validation_status === 'warning').length
    const acknowledged = filteredRecords.filter((r) => {
      const fv = r.field_validation || {}
      return Object.values(fv).some((f) => f.acknowledged)
    }).length
    const ready = filteredRecords.filter((r) => r.validation_status === 'valid' || r.validation_status === 'warning').length
    return { total, items, aboveAvg, errors, warnings, acknowledged, ready }
  }, [filteredRecords])

  // Benchmark computations
  const benchmarkData = useMemo(() => {
    const withStats = filteredRecords
      .filter((r) => r.sku && r.unit_price)
      .map((r) => {
        const stats = historicalStats[r.sku || '']
        const price = r.unit_price || 0
        const qty = r.quantity || 1
        const avg = stats?.avg_price
        const savings = avg && avg > 0 ? (price - avg) * qty : null
        const variancePct = avg && avg > 0 ? ((price - avg) / avg) * 100 : null
        return { record: r, stats, price, qty, avg, savings, variancePct }
      })

    const quoteTotal = filteredRecords.reduce((s, r) => s + (r.total_price || 0), 0)
    const savingsOpportunity = withStats.reduce((s, d) => s + (d.savings !== null && d.savings > 0 ? d.savings : 0), 0)
    const aboveAvgCount = withStats.filter((d) => d.variancePct !== null && d.variancePct > 0).length
    const withBenchmark = withStats.filter((d) => d.avg !== undefined && d.avg !== null).length
    const noBenchmarkCount = filteredRecords.filter((r) => r.sku && !historicalStats[r.sku]).length

    // Price range data — sorted by variance desc
    const priceRangeData = withStats
      .filter((d) => d.stats)
      .map((d) => ({
        sku: d.record.sku || '',
        quotePrice: d.price,
        minPrice: d.stats!.min_price,
        maxPrice: d.stats!.max_price,
        avgPrice: d.stats!.avg_price,
      }))
      .sort((a, b) => {
        const va = a.avgPrice > 0 ? Math.abs((a.quotePrice - a.avgPrice) / a.avgPrice) : 0
        const vb = b.avgPrice > 0 ? Math.abs((b.quotePrice - b.avgPrice) / b.avgPrice) : 0
        return vb - va
      })

    // Waterfall — top 8 by |savings|
    const waterfallData = withStats
      .filter((d) => d.savings !== null)
      .sort((a, b) => Math.abs(b.savings!) - Math.abs(a.savings!))
      .slice(0, 8)
      .map((d) => ({ sku: d.record.sku || '', savings: d.savings! }))

    // Concentration — group by distributor, top 5 + Other
    const distMap = new Map<string, number>()
    filteredRecords.forEach((r) => {
      const dist = r.distributor || 'Unknown'
      distMap.set(dist, (distMap.get(dist) || 0) + (r.total_price || 0))
    })
    const sorted = [...distMap.entries()].sort((a, b) => b[1] - a[1])
    const top5 = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const otherVal = sorted.slice(5).reduce((s, [, v]) => s + v, 0)
    if (otherVal > 0) top5.push({ name: 'Other', value: otherVal })

    // Per-SKU table data — sorted by absolute savings desc
    const skuTableData = withStats
      .map((d) => ({
        sku: d.record.sku || '',
        quotePrice: d.price,
        avg: d.avg,
        min: d.stats?.min_price,
        max: d.stats?.max_price,
        variancePct: d.variancePct,
        savingsDollar: d.savings,
        qty: d.qty,
      }))
      .sort((a, b) => Math.abs(b.savingsDollar ?? 0) - Math.abs(a.savingsDollar ?? 0))

    return {
      quoteTotal,
      savingsOpportunity,
      aboveAvgCount,
      withBenchmark,
      noBenchmarkCount,
      totalItems: filteredRecords.length,
      priceRangeData,
      waterfallData,
      concentrationData: top5,
      skuTableData,
    }
  }, [filteredRecords, historicalStats])

  const handleApprove = async () => {
    if (summary.errors > 0) {
      toast.error('Cannot approve: some records have errors')
      return
    }
    try {
      const result = await approveMutation.mutateAsync({ records, sourceFile })
      // Mark upload as approved
      if (sourceFileId) {
        await api.uploads.updateStatus(sourceFileId, 'approved').catch(() => {})
      }
      toast.success(`Approved ${result.approved_count} records`)
      sessionStorage.removeItem('pendingRecords')
      sessionStorage.removeItem('sourceFile')
      sessionStorage.removeItem('sourceFileId')
      router.push('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  const exportCsv = () => {
    if (!filteredRecords.length) return
    const headers = [
      'SKU', 'Description', 'Brand', 'Distributor', 'Company', 'Qty', 'Unit Price', 'Total',
      'Currency', 'Serial No', 'Start Date', 'End Date', 'Quote Ref', 'Quote Date',
      'Validity', 'Status', 'Catalog Match',
    ]
    const rows = filteredRecords.map((r) => [
      r.sku, r.item_description, r.brand, r.distributor, r.eu_company, r.quantity, r.unit_price, r.total_price,
      r.quote_currency, r.serial_no, r.start_date, r.end_date, r.quotation_ref_no, r.quotation_date,
      r.quotation_validity, r.validation_status, r.catalog_match ? 'Yes' : 'No',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'validated_records.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!records.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Validate & Benchmark" />
        <Card>
          <CardContent className="flex flex-col h-48 items-center justify-center gap-4">
            <p className="text-muted-foreground">
              No records to validate. Upload and extract a document first.
            </p>
            <Button variant="outline" onClick={() => router.push('/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Go to Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validate & Benchmark"
        description={`${records.length} records from ${sourceFile || 'upload'}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevalidate}
              disabled={validateMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {validateMutation.isPending ? 'Validating...' : 'Re-validate'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={summary.errors > 0 || approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {approveMutation.isPending ? 'Approving...' : `Approve (${summary.ready}/${summary.items})`}
            </Button>
          </div>
        }
      />

      {/* Tabs + summary strip */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b border-border">
          <TabsList variant="line" className="h-10">
            <TabsTrigger value="validate" className="px-4 text-sm gap-2">
              <CheckCircle className="h-4 w-4" />
              Validate
            </TabsTrigger>
            <TabsTrigger value="benchmark" className="px-4 text-sm gap-2">
              <BarChart3 className="h-4 w-4" />
              Benchmark
            </TabsTrigger>
          </TabsList>

          {/* Summary badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{summary.items} items</span>
            <span className="text-muted-foreground/40">|</span>
            {summary.errors > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {summary.errors} errors
              </span>
            )}
            {summary.warnings > 0 && (
              <span className="text-amber-400">{summary.warnings} warnings</span>
            )}
            {(summary.errors > 0 || summary.warnings > 0) && (
              <span className="text-muted-foreground/40">|</span>
            )}
            <span className="text-muted-foreground font-medium tabular-nums">
              ${summary.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ====== Validate Tab ====== */}
        <TabsContent value="validate" className="space-y-4">
          {/* Issues to Resolve */}
          {issueRecords.length > 0 && <IssuesList records={issueRecords} />}

          {/* Filter bar with Save Filter inline */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterBar
              filters={filters}
              onChange={setFilters}
              companies={companies}
              distributors={distributors}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const dupSkus = new Set(
                  records
                    .filter((r) => r.field_validation?.sku?.message?.includes('Possible duplicate'))
                    .map((r) => r.sku)
                )
                if (dupSkus.size > 0) {
                  setFilters((f) => ({ ...f, sku: [...dupSkus].join(' ') }))
                }
              }}
            >
              Show duplicates ({duplicateCount})
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={filters.sku || filters.distributor || filters.eu_company ? 'border-primary' : ''}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  {Object.keys(savedFilters).length > 0 && (
                    <div className="space-y-1">
                      {Object.keys(savedFilters).map((name) => (
                        <Button
                          key={name}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleLoadFilter(name)}
                        >
                          {name}
                        </Button>
                      ))}
                      <div className="border-t pt-2 mt-2" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Save current as:</label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="Filter name"
                        size={1}
                        className="text-xs"
                        id="filterName"
                      />
                      <Button
                        size="sm"
                        variant="default"
                        className="px-2"
                        onClick={() => {
                          const input = document.getElementById('filterName') as HTMLInputElement
                          if (input?.value) {
                            handleSaveFilter(input.value)
                            input.value = ''
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Column header row */}
          <div className="border-b border-border">
            <RecordCardHeader />
          </div>

          {/* Record cards */}
          <div className="space-y-3">
            {paginatedRecords.map((record) => {
              const globalIndex = records.indexOf(record)
              const key = record.id ?? `idx-${globalIndex}`
              return (
                <RecordCard
                  key={key}
                  record={record}
                  index={globalIndex}
                  historicalStats={historicalStats[record.sku || '']}
                  hasComments={(localComments[globalIndex]?.length ?? 0) > 0}
                  onCellSave={handleCellSave}
                  onAcknowledge={handleAcknowledge}
                  onDelete={(idx) => setDeleteIndex(idx)}
                  onOpenComments={() => setCommentRowIndex(globalIndex)}
                />
              )
            })}
            {paginatedRecords.length === 0 && (
              <div className="text-center text-muted-foreground py-12 text-sm">
                No records match the current filters
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1} to{' '}
                {Math.min((page + 1) * PAGE_SIZE, filteredRecords.length)}{' '}
                of {filteredRecords.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== Benchmark Tab ====== */}
        <TabsContent value="benchmark" className="space-y-6">
          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Quote Total</p>
                <p className="text-2xl font-bold tabular-nums">${benchmarkData.quoteTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">{benchmarkData.totalItems} line items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Savings Opportunity</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">${benchmarkData.savingsOpportunity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground mt-1">if negotiated to hist. avg</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Above Average</p>
                <p className="text-2xl font-bold tabular-nums">
                  <span className="text-amber-400">{benchmarkData.aboveAvgCount}</span>
                  <span className="text-muted-foreground text-lg"> / {benchmarkData.withBenchmark}</span>
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${benchmarkData.withBenchmark > 0 ? (benchmarkData.aboveAvgCount / benchmarkData.withBenchmark) * 100 : 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">No Benchmark</p>
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{benchmarkData.noBenchmarkCount}</p>
                <p className="text-xs text-muted-foreground mt-1">SKUs without historical data</p>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Price Range + Savings Waterfall */}
          <div className="grid grid-cols-3 gap-4">
            <PriceRangeChart data={benchmarkData.priceRangeData} />
            <SavingsWaterfallChart data={benchmarkData.waterfallData} />
          </div>

          {/* Row 3: Spend Concentration + Enhanced Per-SKU Table */}
          <div className="grid grid-cols-3 gap-4">
            <SpendConcentrationChart data={benchmarkData.concentrationData} />
            <div className="col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Per-SKU Benchmark</CardTitle>
                  <p className="text-xs text-muted-foreground">Sorted by absolute savings impact</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">SKU</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Quote Price</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Hist. Avg</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Range</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Variance</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Savings $</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarkData.skuTableData.map((row, i) => {
                          const absVar = row.variancePct !== null ? Math.abs(row.variancePct) : null
                          let statusColor = 'text-emerald-400'
                          let statusLabel = 'OK'
                          if (absVar !== null && absVar > 30) { statusColor = 'text-red-400'; statusLabel = 'High' }
                          else if (absVar !== null && absVar > 10) { statusColor = 'text-amber-400'; statusLabel = 'Watch' }
                          else if (!row.avg) { statusColor = 'text-muted-foreground'; statusLabel = 'No data' }
                          const rowTint = absVar !== null && absVar > 30
                            ? 'bg-red-500/5'
                            : absVar !== null && absVar > 10
                              ? 'bg-amber-500/5'
                              : ''
                          // Inline range bar
                          const rangeBar = row.min !== undefined && row.max !== undefined && row.max > row.min
                            ? (() => {
                                const span = row.max - row.min
                                const quotePos = Math.max(0, Math.min(100, ((row.quotePrice - row.min) / span) * 100))
                                return (
                                  <div className="relative w-[60px] h-3 mx-auto">
                                    <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                                      <div className="w-full h-[3px] rounded-full bg-muted-foreground/20" />
                                    </div>
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                                      style={{
                                        left: `${quotePos}%`,
                                        transform: 'translate(-50%, -50%)',
                                        backgroundColor: absVar !== null && absVar > 30 ? '#f87171' : absVar !== null && absVar > 10 ? '#fbbf24' : '#34d399',
                                      }}
                                    />
                                  </div>
                                )
                              })()
                            : <span className="text-muted-foreground">—</span>
                          return (
                            <tr key={i} className={`border-b border-border last:border-0 hover:bg-muted/20 ${rowTint}`}>
                              <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                              <td className="px-3 py-2 text-right tabular-nums">${row.quotePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.avg ? `$${row.avg.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                              <td className="px-3 py-2 text-center">{rangeBar}</td>
                              <td className={`px-3 py-2 text-right font-medium tabular-nums ${row.variancePct !== null && row.variancePct > 0 ? 'text-red-400' : row.variancePct !== null ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                {row.variancePct !== null ? `${row.variancePct > 0 ? '+' : ''}${row.variancePct.toFixed(1)}%` : '—'}
                              </td>
                              <td className={`px-3 py-2 text-right font-medium tabular-nums ${row.savingsDollar !== null && row.savingsDollar > 0 ? 'text-red-400' : row.savingsDollar !== null ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                {row.savingsDollar !== null ? `${row.savingsDollar > 0 ? '+' : ''}$${Math.abs(row.savingsDollar).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                              </td>
                              <td className={`px-3 py-2 text-center text-xs font-medium ${statusColor}`}>{statusLabel}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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

      {/* Comments Sheet */}
      <Sheet open={commentRowIndex !== null} onOpenChange={(open) => !open && setCommentRowIndex(null)}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>
              Comments {commentRecord?.sku ? `— ${commentRecord.sku}` : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4 flex-1 min-h-0">
            {/* Input area */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) handleAddComment() }}
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!commentText.trim()}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </div>
            {/* Comment list */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {!comments || comments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-muted/30 p-3 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
