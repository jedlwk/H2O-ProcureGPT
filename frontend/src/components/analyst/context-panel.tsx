'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Database, ShieldCheck, BookOpen, Sparkles } from 'lucide-react'

const quickQueries = [
  'Compare pricing across distributors',
  'Which SKUs have the highest price variance?',
  'Summarize recent procurement trends',
  'Flag overpriced items vs catalog',
  'What are the biggest negotiation opportunities?',
]

interface ContextPanelProps {
  onQuerySelect: (query: string) => void
}

export function ContextPanel({ onQuerySelect }: ContextPanelProps) {
  const { data: metrics } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.getMetrics(),
  })

  const { data: catalogStats } = useQuery({
    queryKey: ['catalog-stats'],
    queryFn: () => api.catalog.stats(),
  })

  const vs = metrics?.validation_summary

  return (
    <div className="space-y-4">
      {/* Your Data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Your Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Records</span>
            <span className="font-medium">{metrics?.total_records ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Companies</span>
            <span className="font-medium">{metrics?.num_companies ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unique SKUs</span>
            <span className="font-medium">{metrics?.num_skus ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
            {vs?.valid ?? 0} valid
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 text-amber-500">
            {vs?.warning ?? 0} warnings
          </Badge>
          <Badge variant="outline" className="border-red-500/30 text-red-500">
            {vs?.error ?? 0} errors
          </Badge>
        </CardContent>
      </Card>

      {/* Catalog */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entries</span>
            <span className="font-medium">{catalogStats?.total_entries ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Brands</span>
            <span className="font-medium">{catalogStats?.total_brands ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categories</span>
            <span className="font-medium">{catalogStats?.total_categories ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Queries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Quick Queries
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {quickQueries.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left text-xs h-auto py-2 whitespace-normal"
              onClick={() => onQuerySelect(q)}
            >
              {q}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
