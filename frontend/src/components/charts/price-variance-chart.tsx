'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PriceVarianceData {
  sku: string
  current_price: number
  historical_avg: number
  variance_pct: number
}

interface PriceVarianceChartProps {
  data: PriceVarianceData[]
}

export function PriceVarianceChart({ data }: PriceVarianceChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price Variance</CardTitle>
        </CardHeader>
        <CardContent className="flex h-60 items-center justify-center">
          <p className="text-sm text-muted-foreground">No pricing data available</p>
        </CardContent>
      </Card>
    )
  }

  const favorable = data.filter((d) => d.variance_pct <= 0)
  const unfavorable = data.filter((d) => d.variance_pct > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price Variance: Current vs Historical</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.005 285)" />
            <XAxis dataKey="sku" type="category" allowDuplicatedCategory={false} stroke="oklch(0.65 0.01 285)" fontSize={10} angle={-30} textAnchor="end" height={60} />
            <YAxis stroke="oklch(0.65 0.01 285)" fontSize={12} label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.18 0.005 285)',
                border: '1px solid oklch(0.26 0.005 285)',
                borderRadius: '0.5rem',
                color: 'oklch(0.93 0.01 285)',
              }}
              formatter={(value) => typeof value === 'number' ? `$${value.toFixed(2)}` : value}
            />
            <Scatter name="Favorable" data={favorable} fill="#34d399" dataKey="current_price" />
            <Scatter name="Above Avg" data={unfavorable} fill="#f87171" dataKey="current_price" />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
