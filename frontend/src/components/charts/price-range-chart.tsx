'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PriceRangeItem {
  sku: string
  quotePrice: number
  minPrice: number
  maxPrice: number
  avgPrice: number
}

interface PriceRangeChartProps {
  data: PriceRangeItem[]
}

export function PriceRangeChart({ data }: PriceRangeChartProps) {
  if (!data.length) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Price Position vs Historical Range</CardTitle>
        </CardHeader>
        <CardContent className="flex h-60 items-center justify-center">
          <p className="text-sm text-muted-foreground">No benchmark data available</p>
        </CardContent>
      </Card>
    )
  }

  // Compute global min/max for scaling
  const globalMin = Math.min(...data.map((d) => Math.min(d.minPrice, d.quotePrice)))
  const globalMax = Math.max(...data.map((d) => Math.max(d.maxPrice, d.quotePrice)))
  const range = globalMax - globalMin || 1

  const toPercent = (v: number) => ((v - globalMin) / range) * 100

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Price Position vs Historical Range</CardTitle>
        <p className="text-xs text-muted-foreground">Where your quote price falls within the historical min–max range</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {data.map((item) => {
            const barLeft = toPercent(item.minPrice)
            const barRight = toPercent(item.maxPrice)
            const barWidth = barRight - barLeft
            const avgPos = toPercent(item.avgPrice)
            const quotePos = toPercent(item.quotePrice)

            const variancePct = item.avgPrice > 0
              ? ((item.quotePrice - item.avgPrice) / item.avgPrice) * 100
              : 0
            let dotColor = '#34d399' // emerald
            if (variancePct > 30) dotColor = '#f87171' // red
            else if (variancePct > 10) dotColor = '#fbbf24' // amber

            return (
              <div key={item.sku} className="flex items-center gap-2 group">
                <span className="text-[11px] font-mono text-muted-foreground w-28 truncate shrink-0" title={item.sku}>
                  {item.sku}
                </span>
                <div className="relative flex-1 h-5">
                  {/* Track */}
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                    <div className="w-full h-[3px] rounded-full bg-muted/40" />
                  </div>
                  {/* Historical range bar */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-muted-foreground/20"
                    style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 0.5)}%` }}
                  />
                  {/* Avg tick */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-muted-foreground/50"
                    style={{ left: `${avgPos}%` }}
                  />
                  {/* Quote price dot */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-background shadow-sm"
                    style={{ left: `${quotePos}%`, backgroundColor: dotColor, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground w-14 text-right shrink-0">
                  ${item.quotePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-6 h-1.5 rounded bg-muted-foreground/20 inline-block" /> Range
          </span>
          <span className="flex items-center gap-1">
            <span className="w-[2px] h-2.5 bg-muted-foreground/50 inline-block" /> Avg
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#34d399' }} /> &le;avg
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#fbbf24' }} /> 10-30%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#f87171' }} /> &gt;30%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
