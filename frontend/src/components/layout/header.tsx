'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/records/command-palette'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'Upload & Extract',
  '/validate': 'Validate & Benchmark',
  '/history': 'Historical Records',
  '/analyst': 'AI Analyst',
  '/catalog': 'Catalog Management',
}

export function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'ProcureGPT'
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline text-xs text-muted-foreground">Search</span>
        </Button>
      </header>
      <CommandPalette open={commandOpen} setOpen={setCommandOpen} />
    </>
  )
}
