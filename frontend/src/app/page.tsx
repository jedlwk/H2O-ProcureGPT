'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, CalendarPlus, Building2, Package } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

const COLORS = {
  valid: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
}

export default function DashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.getMetrics(),
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
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const validationData = metrics
    ? [
        { name: 'Valid', value: metrics.validation_summary.valid, color: COLORS.valid },
        { name: 'Warning', value: metrics.validation_summary.warning, color: COLORS.warning },
        { name: 'Error', value: metrics.validation_summary.error, color: COLORS.error },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your procurement database"
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Records"
          value={metrics?.total_records ?? 0}
          icon={Database}
        />
        <MetricCard
          title="New This Month"
          value={metrics?.new_this_month ?? 0}
          icon={CalendarPlus}
        />
        <MetricCard
          title="Companies"
          value={metrics?.num_companies ?? 0}
          icon={Building2}
        />
        <MetricCard
          title="Unique SKUs"
          value={metrics?.num_skus ?? 0}
          icon={Package}
        />
      </div>

      {/* Activity + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <RecentActivity uploads={metrics?.recent_uploads ?? []} />
          <QuickActions />
        </div>

        {/* Validation Summary Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {validationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={validationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {validationData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.18 0.005 285)',
                      border: '1px solid oklch(0.26 0.005 285)',
                      borderRadius: '0.5rem',
                      color: 'oklch(0.93 0.01 285)',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-60 items-center justify-center">
                <p className="text-sm text-muted-foreground">No validation data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
