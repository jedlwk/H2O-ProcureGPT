'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'Upload & Extract',
  '/validate': 'Validate & Benchmark',
  '/history': 'Historical Records',
  '/analyst': 'AI Analyst',
}

export function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'ProcureGPT'

  return (
    <header className="flex h-14 items-center border-b border-border px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  )
}
