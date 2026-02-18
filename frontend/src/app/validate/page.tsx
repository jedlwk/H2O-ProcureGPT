'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { type ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/layout/page-header'
import { FilterBar } from '@/components/records/filter-bar'
import { DataTable } from '@/components/records/data-table'
import { ValidationBadge } from '@/components/records/validation-badge'
import { IssuesList } from '@/components/dashboard/issues-list'
import { PriceVarianceChart } from '@/components/charts/price-variance-chart'
import { QuantityTrendsChart } from '@/components/charts/quantity-trends-chart'
import { SpendImpactGauge } from '@/components/charts/spend-impact-gauge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useApproveBatch } from '@/lib/hooks/use-records'
import { useCompanies, useDistributors } from '@/lib/hooks/use-historical'
import type { ProcurementRecord, BatchStatsResult } from '@/lib/types'
import { Download, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ValidatePage() {
  const router = useRouter()
  const [records, setRecords] = useState<ProcurementRecord[]>([])
  const [sourceFile, setSourceFile] = useState('')
  const [filters, setFilters] = useState({
    sku: '', distributor: '', eu_company: '', status: 'all', date_from: '', date_to: '',
  })

  const [historicalStats, setHistoricalStats] = useState<BatchStatsResult>({})

  const approveMutation = useApproveBatch()
  const { data: companies } = useCompanies()
  const { data: distributors } = useDistributors()

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingRecords')
    const storedFile = sessionStorage.getItem('sourceFile')
    if (stored) {
      try {
        setRecords(JSON.parse(stored))
      } catch { /* empty */ }
    }
    if (storedFile) setSourceFile(storedFile)
  }, [])

  // Fetch real historical stats for extracted SKUs
  useEffect(() => {
    const skus = [...new Set(records.map((r) => r.sku).filter(Boolean))] as string[]
    if (skus.length === 0) return
    api.historical.batchStats(skus).then(setHistoricalStats).catch(() => {})
  }, [records])

  const issueRecords = useMemo(
    () => records.filter((r) => r.validation_status === 'error' || r.validation_status === 'warning'),
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

  const summary = useMemo(() => {
    const total = filteredRecords.reduce((sum, r) => sum + (r.total_price || 0), 0)
    const items = filteredRecords.length
    const aboveAvg = filteredRecords.filter((r) => {
      const fv = r.field_validation?.unit_price
      return fv && (fv.status === 'warning' || fv.status === 'error')
    }).length
    const errors = filteredRecords.filter((r) => r.validation_status === 'error').length
    return { total, items, aboveAvg, errors }
  }, [filteredRecords])

  // Chart data — uses real historical stats when available
  const priceVarianceData = useMemo(() =>
    filteredRecords
      .filter((r) => r.sku && r.unit_price)
      .slice(0, 15)
      .map((r) => {
        const stats = historicalStats[r.sku || '']
        const currentPrice = r.unit_price || 0
        const avgPrice = stats?.avg_price || currentPrice
        const variance = avgPrice > 0
          ? ((currentPrice - avgPrice) / avgPrice) * 100
          : 0
        return {
          sku: r.sku || '',
          current_price: currentPrice,
          historical_avg: avgPrice,
          variance_pct: Math.round(variance * 10) / 10,
        }
      }),
    [filteredRecords, historicalStats]
  )

  const quantityData = useMemo(() =>
    filteredRecords
      .filter((r) => r.sku && r.quantity)
      .slice(0, 15)
      .map((r) => {
        const stats = historicalStats[r.sku || '']
        return {
          sku: r.sku || '',
          current_qty: r.quantity || 0,
          historical_avg_qty: Math.round(stats?.avg_quantity || r.quantity || 0),
        }
      }),
    [filteredRecords, historicalStats]
  )

  const handleApprove = async () => {
    if (summary.errors > 0) {
      toast.error('Cannot approve: some records have errors')
      return
    }
    try {
      const result = await approveMutation.mutateAsync({ records, sourceFile })
      toast.success(`Approved ${result.approved_count} records`)
      sessionStorage.removeItem('pendingRecords')
      sessionStorage.removeItem('sourceFile')
      router.push('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  const exportCsv = () => {
    if (!filteredRecords.length) return
    const headers = ['SKU', 'Description', 'Distributor', 'Qty', 'Unit Price', 'Total', 'Status']
    const rows = filteredRecords.map((r) => [
      r.sku, r.item_description, r.distributor, r.quantity, r.unit_price, r.total_price, r.validation_status,
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

  const columns: ColumnDef<ProcurementRecord, unknown>[] = useMemo(() => [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <ValidationBadge status={(row.original.validation_status as 'valid' | 'warning' | 'error' | 'pending') || 'pending'} />,
      size: 100,
    },
    { accessorKey: 'sku', header: 'SKU', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'item_description', header: 'Description', cell: ({ getValue }) => <span className="max-w-48 truncate block">{getValue() as string}</span> },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ getValue }) => (getValue() as number)?.toLocaleString() },
    {
      accessorKey: 'unit_price',
      header: 'Unit Price',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'
      },
    },
    {
      accessorKey: 'total_price',
      header: 'Total',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'
      },
    },
    { accessorKey: 'distributor', header: 'Distributor' },
    { accessorKey: 'eu_company', header: 'Company' },
  ], [])

  if (!records.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Validate & Benchmark" />
        <Card>
          <CardContent className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">
              No records to validate. Upload and extract a document first.
            </p>
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
              {approveMutation.isPending ? 'Approving...' : 'Approve & Save'}
            </Button>
          </div>
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        companies={companies}
        distributors={distributors}
      />

      {/* Issues to Resolve */}
      {issueRecords.length > 0 && <IssuesList records={issueRecords} />}

      {/* Summary + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Value</span>
              <span className="font-semibold">${summary.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Items</span>
              <span className="font-semibold">{summary.items}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Price Alerts</span>
              <span className="font-semibold text-amber-400">{summary.aboveAvg}</span>
            </div>
            {summary.errors > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {summary.errors} error{summary.errors !== 1 ? 's' : ''} must be resolved
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <PriceVarianceChart data={priceVarianceData} />
        </div>

        <SpendImpactGauge totalValue={summary.total} />
      </div>

      <QuantityTrendsChart data={quantityData} />

      {/* Records Table */}
      <DataTable data={filteredRecords} columns={columns} />
    </div>
  )
}
