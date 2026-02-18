'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface Filters {
  sku: string
  distributor: string
  eu_company: string
  status: string
  date_from: string
  date_to: string
}

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
  companies?: string[]
  distributors?: string[]
}

export function FilterBar({ filters, onChange, companies, distributors }: FilterBarProps) {
  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const hasFilters = Object.values(filters).some((v) => v && v !== 'all')
  const clear = () =>
    onChange({ sku: '', distributor: '', eu_company: '', status: 'all', date_from: '', date_to: '' })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">SKU</Label>
        <Input
          placeholder="Search SKU..."
          value={filters.sku}
          onChange={(e) => update('sku', e.target.value)}
          className="h-9 w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Company</Label>
        <Select value={filters.eu_company || 'all'} onValueChange={(v) => update('eu_company', v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies?.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Distributor</Label>
        <Select value={filters.distributor || 'all'} onValueChange={(v) => update('distributor', v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All distributors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All distributors</SelectItem>
            {distributors?.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v)}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={filters.date_from}
          onChange={(e) => update('date_from', e.target.value)}
          className="h-9 w-36"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={filters.date_to}
          onChange={(e) => update('date_to', e.target.value)}
          className="h-9 w-36"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-9">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
