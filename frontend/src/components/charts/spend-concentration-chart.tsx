'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ConcentrationItem {
  name: string
  value: number
}

interface SpendConcentrationChartProps {
  data: ConcentrationItem[]
}

const COLORS = ['#8B7CF6', '#34d399', '#fbbf24', '#f87171', '#60a5fa', 'oklch(0.45 0.01 285)']

export function SpendConcentrationChart({ data }: SpendConcentrationChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend by Distributor</CardTitle>
        </CardHeader>
        <CardContent className="flex h-60 items-center justify-center">
          <p className="text-sm text-muted-foreground">No distributor data available</p>
        </CardContent>
      </Card>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const topEntry = data[0]
  const topPct = total > 0 ? ((topEntry.value / total) * 100).toFixed(0) : '0'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Spend by Distributor</CardTitle>
        <p className="text-xs text-muted-foreground">Concentration risk and negotiation leverage</p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.18 0.005 285)',
                  border: '1px solid oklch(0.26 0.005 285)',
                  borderRadius: '0.5rem',
                  color: 'oklch(0.93 0.01 285)',
                  fontSize: '12px',
                }}
                formatter={(value) => [`$${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Spend']}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold">{topPct}%</span>
            <span className="text-[10px] text-muted-foreground max-w-[80px] text-center truncate">{topEntry.name}</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
          {data.map((item, i) => (
            <span key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {item.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
