'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WaterfallItem {
  sku: string
  savings: number // positive = overpaying, negative = good deal
}

interface SavingsWaterfallChartProps {
  data: WaterfallItem[]
}

export function SavingsWaterfallChart({ data }: SavingsWaterfallChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings Waterfall</CardTitle>
        </CardHeader>
        <CardContent className="flex h-60 items-center justify-center">
          <p className="text-sm text-muted-foreground">No benchmark data available</p>
        </CardContent>
      </Card>
    )
  }

  const net = data.reduce((sum, d) => sum + d.savings, 0)
  const chartData = [
    ...data.map((d) => ({ name: d.sku.length > 10 ? d.sku.slice(0, 10) + '...' : d.sku, value: Math.round(d.savings), fullSku: d.sku })),
    { name: 'Net', value: Math.round(net), fullSku: 'Net Total' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Savings Waterfall</CardTitle>
        <p className="text-xs text-muted-foreground">Top SKUs by dollar impact vs historical avg</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
            <XAxis
              dataKey="name"
              stroke="oklch(0.65 0.01 285)"
              fontSize={10}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              stroke="oklch(0.65 0.01 285)"
              fontSize={11}
              tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.18 0.005 285)',
                border: '1px solid oklch(0.26 0.005 285)',
                borderRadius: '0.5rem',
                color: 'oklch(0.93 0.01 285)',
                fontSize: '12px',
              }}
              formatter={(value) => {
                const v = Number(value) || 0
                const label = v > 0 ? 'Overpaying' : 'Saving'
                return [`$${Math.abs(v).toLocaleString()}`, label]
              }}
            />
            <ReferenceLine y={0} stroke="oklch(0.35 0.01 285)" />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.name === 'Net'
                      ? '#8B7CF6'
                      : entry.value > 0
                        ? '#f87171'
                        : '#34d399'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
