'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { DataQualityBar } from '@/components/dashboard/data-quality-bar'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, AlertTriangle, CalendarPlus, BookOpen, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.getMetrics(),
  })

  const { data: catalogStats } = useQuery({
    queryKey: ['catalog-stats'],
    queryFn: () => api.catalog.stats(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your procurement database" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-20" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const vs = metrics?.validation_summary ?? { valid: 0, warning: 0, error: 0 }
  const pendingReview = vs.warning + vs.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your procurement database"
      />

      {/* Row 1: Pipeline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Records"
          value={metrics?.total_records ?? 0}
          description={`across ${metrics?.num_companies ?? 0} companies`}
          icon={Database}
        />
        <MetricCard
          title="Pending Review"
          value={pendingReview}
          description={`${vs.error} errors, ${vs.warning} warnings`}
          icon={AlertTriangle}
          iconBgClassName={pendingReview > 0 ? 'bg-amber-400/10' : undefined}
          iconClassName={pendingReview > 0 ? 'text-amber-400' : undefined}
        />
        <MetricCard
          title="This Month"
          value={metrics?.new_this_month ?? 0}
          description="new records added"
          icon={CalendarPlus}
        />
        <MetricCard
          title="Catalog Coverage"
          value={catalogStats?.total_entries ?? 0}
          description={`${catalogStats?.total_brands ?? 0} brands tracked`}
          icon={BookOpen}
        />
      </div>

      {/* Row 2: Data Quality Bar */}
      <DataQualityBar validation={vs} />

      {/* Row 3: Recent Activity + Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentActivity uploads={metrics?.recent_uploads ?? []} />
        </div>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Top Distributor</p>
              {metrics?.top_distributor ? (
                <p className="text-sm font-medium">
                  {metrics.top_distributor}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({metrics.top_distributor_count} records)
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Unit Price</p>
              {metrics?.avg_unit_price != null ? (
                <p className="text-sm font-medium">
                  ${metrics.avg_unit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Most Quoted SKU</p>
              {metrics?.most_quoted_sku ? (
                <p className="text-sm font-medium">
                  {metrics.most_quoted_sku}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({metrics.most_quoted_sku_count} records)
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
