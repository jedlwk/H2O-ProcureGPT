'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Upload,
  CheckCircle,
  Archive,
  Bot,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload & Extract', icon: Upload },
  { href: '/validate', label: 'Validate & Benchmark', icon: CheckCircle },
  { href: '/history', label: 'Historical Records', icon: Archive },
  { href: '/analyst', label: 'AI Analyst', icon: Bot },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.h2ogpte(),
    refetchInterval: 60000,
  })

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-border',
        collapsed ? 'h-14 justify-center px-2' : 'h-14 gap-3 px-4'
      )}>
        <Image
          src="/h2o-logo.svg"
          alt="H2O.ai"
          width={36}
          height={36}
          className="shrink-0 rounded-md"
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight">ProcureGPT</span>
            <span className="text-xs text-muted-foreground leading-tight">by H2O.ai</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }
          return link
        })}
      </nav>

      {/* H2OGPTE Status */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              health?.connected ? 'bg-emerald-400' : 'bg-red-400'
            )}
          />
          {!collapsed && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span>
                {health?.connected
                  ? `H2OGPTE`
                  : 'Disconnected'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}
