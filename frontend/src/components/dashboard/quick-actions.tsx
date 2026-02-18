'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, Bot, Archive } from 'lucide-react'

const actions = [
  {
    href: '/upload',
    label: 'Upload Document',
    description: 'Extract data from a new quotation',
    icon: Upload,
  },
  {
    href: '/validate',
    label: 'Validate Records',
    description: 'Review and benchmark pricing',
    icon: CheckCircle,
  },
  {
    href: '/history',
    label: 'Browse History',
    description: 'Search historical records',
    icon: Archive,
  },
  {
    href: '/analyst',
    label: 'Ask AI Analyst',
    description: 'Get insights from your data',
    icon: Bot,
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant="outline"
                className="h-auto w-full flex-col items-start gap-1 p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <action.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{action.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
