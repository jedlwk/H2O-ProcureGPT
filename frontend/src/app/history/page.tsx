'use client'

import { useState, useMemo, useEffect } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useHistoricalSearch, usePriceTrend, useCompanies, useDistributors } from '@/lib/hooks/use-historical'
import { PageHeader } from '@/components/layout/page-header'
import { FilterBar } from '@/components/records/filter-bar'
import { DataTable } from '@/components/records/data-table'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Database, Package, Building2, DollarSign } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import type { ProcurementRecord, BatchStatsResult } from '@/lib/types'

const PriceSparkline = ({ minPrice, avgPrice, maxPrice }: { minPrice: number; avgPrice: number; maxPrice: number }) => {
  if (!minPrice || !avgPrice || !maxPrice || minPrice > maxPrice) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const range = maxPrice - minPrice
  const avgPercent = range > 0 ? ((avgPrice - minPrice) / range) * 100 : 50

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-16 h-5 bg-muted rounded overflow-hidden">
        {/* Track showing range */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-600/20" />
        {/* Avg price dot */}
        <div className="absolute top-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full -translate-y-1/2" style={{ left: `${avgPercent}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">${avgPrice.toFixed(2)}</span>
    </div>
  )
}

export default function HistoryPage() {
  const [filters, setFilters] = useState({
    sku: '', distributor: '', eu_company: '', status: 'all', date_from: '', date_to: '',
  })
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [historicalStats, setHistoricalStats] = useState<BatchStatsResult>({})

  const { data: companies } = useCompanies()
  const { data: distributors } = useDistributors()

  const searchParams = useMemo(() => ({
    sku: filters.sku || undefined,
    eu_company: filters.eu_company || undefined,
    distributor: filters.distributor || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    limit: 500,
  }), [filters])

  const { data: searchResult, isLoading } = useHistoricalSearch(searchParams)
  const { data: priceTrend } = usePriceTrend(selectedSku)

  const records = useMemo(() => searchResult?.records ?? [], [searchResult])
  const stats = searchResult?.stats

  // Fetch historical stats for visible SKUs
  useEffect(() => {
    const skus = [...new Set(records.map((r) => r.sku).filter(Boolean))] as string[]
    if (skus.length === 0) return
    api.historical.batchStats(skus).then(setHistoricalStats).catch(() => {})
  }, [records])

  const handleRowClick = (row: ProcurementRecord) => {
    if (row.sku) {
      setSelectedSku(row.sku === selectedSku ? null : row.sku)
    }
  }

  const columns: ColumnDef<ProcurementRecord, unknown>[] = useMemo(() => [
    { accessorKey: 'sku', header: 'SKU', cell: (info) => <span className="font-mono text-xs">{info.getValue() as string}</span> },
    { accessorKey: 'item_description', header: 'Description', cell: (info) => <span className="max-w-48 truncate block">{info.getValue() as string}</span> },
    { accessorKey: 'brand', header: 'Brand' },
    { accessorKey: 'distributor', header: 'Distributor' },
    { accessorKey: 'eu_company', header: 'Company' },
    { accessorKey: 'quantity', header: 'Qty', cell: (info) => (info.getValue() as number)?.toLocaleString() },
    { accessorKey: 'unit_price', header: 'Unit Price', cell: (info) => {
      const v = info.getValue() as number
      return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'
    }},
    { accessorKey: 'total_price', header: 'Total', cell: (info) => {
      const v = info.getValue() as number
      return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'
    }},
    { accessorKey: 'quote_currency', header: 'Ccy' },
    { accessorKey: 'serial_no', header: 'Serial No', cell: (info) => <span className="font-mono text-xs">{(info.getValue() as string) || '-'}</span> },
    { accessorKey: 'start_date', header: 'Start Date', cell: (info) => <span className="text-xs">{(info.getValue() as string) || '-'}</span> },
    { accessorKey: 'end_date', header: 'End Date', cell: (info) => <span className="text-xs">{(info.getValue() as string) || '-'}</span> },
    { accessorKey: 'quotation_ref_no', header: 'Quote Ref', cell: (info) => <span className="text-xs">{(info.getValue() as string) || '-'}</span> },
    { accessorKey: 'quotation_date', header: 'Quote Date', cell: (info) => <span className="text-xs">{(info.getValue() as string) || '-'}</span> },
    { accessorKey: 'quotation_validity', header: 'Validity', cell: (info) => <span className="text-xs">{(info.getValue() as string) || '-'}</span> },
    {
      id: 'trend',
      header: 'Trend',
      cell: (info) => {
        const sku = (info.row.original.sku || '') as string
        const stats = historicalStats[sku]
        if (!stats || !stats.min_price || !stats.max_price) {
          return <span className="text-muted-foreground text-xs">—</span>
        }
        return <PriceSparkline minPrice={stats.min_price} avgPrice={stats.avg_price} maxPrice={stats.max_price} />
      },
      size: 150,
    },
    { accessorKey: 'source_file', header: 'Source', cell: (info) => <span className="max-w-32 truncate block text-xs text-muted-foreground">{(info.getValue() as string) || '-'}</span> },
  ], [historicalStats])

  const exportCsv = () => {
    if (!records.length) return
    const headers = ['SKU', 'Description', 'Brand', 'Distributor', 'Company', 'Qty', 'Unit Price', 'Total', 'Currency', 'Serial No', 'Start Date', 'End Date', 'Quote Ref', 'Quote Date', 'Validity', 'Source']
    const rows = records.map((r) => [
      r.sku, r.item_description, r.brand, r.distributor, r.eu_company, r.quantity, r.unit_price, r.total_price,
      r.quote_currency, r.serial_no, r.start_date, r.end_date, r.quotation_ref_no, r.quotation_date, r.quotation_validity, r.source_file,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'historical_records.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historical Records"
        description="Search and analyze approved procurement data"
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        companies={companies}
        distributors={distributors}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard title="Records" value={stats?.total_records ?? 0} icon={Database} />
        <MetricCard title="Unique SKUs" value={stats?.unique_skus ?? 0} icon={Package} />
        <MetricCard title="Distributors" value={stats?.unique_distributors ?? 0} icon={Building2} />
        <MetricCard
          title="Avg Unit Price"
          value={stats?.avg_unit_price != null ? `$${stats.avg_unit_price.toFixed(2)}` : '-'}
          icon={DollarSign}
        />
      </div>

      {/* Price Trend Chart */}
      {selectedSku && priceTrend && priceTrend.data_points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price Trend: {selectedSku}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={priceTrend.data_points}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.005 285)" />
                <XAxis dataKey="month" stroke="oklch(0.65 0.01 285)" fontSize={12} />
                <YAxis stroke="oklch(0.65 0.01 285)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'oklch(0.18 0.005 285)',
                    border: '1px solid oklch(0.26 0.005 285)',
                    borderRadius: '0.5rem',
                    color: 'oklch(0.93 0.01 285)',
                  }}
                />
                <Line type="monotone" dataKey="avg_price" stroke="#8B7CF6" strokeWidth={2} dot={{ r: 4 }} name="Avg Price" />
                <Line type="monotone" dataKey="min_price" stroke="#34d399" strokeWidth={1} strokeDasharray="3 3" name="Min" />
                <Line type="monotone" dataKey="max_price" stroke="#f87171" strokeWidth={1} strokeDasharray="3 3" name="Max" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">
              No historical records found. Upload and approve documents to build your historical database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable data={records} columns={columns} onRowClick={handleRowClick} />
      )}
    </div>
  )
}
