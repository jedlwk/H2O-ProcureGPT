'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SpendImpactGaugeProps {
  totalValue: number
  budgetEstimate?: number
}

export function SpendImpactGauge({ totalValue, budgetEstimate = 100000 }: SpendImpactGaugeProps) {
  const percentage = budgetEstimate > 0 ? Math.min((totalValue / budgetEstimate) * 100, 100) : 0
  const color = percentage < 50 ? 'text-emerald-400' : percentage < 75 ? 'text-amber-400' : 'text-red-400'
  const bgColor = percentage < 50 ? 'bg-emerald-400' : percentage < 75 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spend Impact</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {/* Circular gauge visualization */}
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="56" fill="none" stroke="oklch(0.22 0.005 285)" strokeWidth="12" />
              <circle
                cx="64" cy="64" r="56" fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={`${(percentage / 100) * 351.86} 351.86`}
                strokeLinecap="round"
                className={color}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-bold', color)}>{percentage.toFixed(0)}%</span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-lg font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Quote Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
