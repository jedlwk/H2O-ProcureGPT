'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QuantityData {
  sku: string
  current_qty: number
  historical_avg_qty: number
}

interface QuantityTrendsChartProps {
  data: QuantityData[]
}

export function QuantityTrendsChart({ data }: QuantityTrendsChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quantity Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-60 items-center justify-center">
          <p className="text-sm text-muted-foreground">No quantity data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quantity: Current vs Historical</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.005 285)" />
            <XAxis dataKey="sku" stroke="oklch(0.65 0.01 285)" fontSize={10} angle={-30} textAnchor="end" height={60} />
            <YAxis stroke="oklch(0.65 0.01 285)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.18 0.005 285)',
                border: '1px solid oklch(0.26 0.005 285)',
                borderRadius: '0.5rem',
                color: 'oklch(0.93 0.01 285)',
              }}
            />
            <Legend />
            <Bar dataKey="historical_avg_qty" name="Historical Avg" fill="#8B7CF6" opacity={0.5} />
            <Bar dataKey="current_qty" name="Current Quote" fill="#8B7CF6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
