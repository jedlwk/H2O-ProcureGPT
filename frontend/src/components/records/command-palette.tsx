'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSearch } from '@/lib/hooks/use-search'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Upload,
  CheckCircle,
  Archive,
  Bot,
  BookOpen,
} from 'lucide-react'

const pages = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Upload & Extract', href: '/upload', icon: Upload },
  { label: 'Validate & Benchmark', href: '/validate', icon: CheckCircle },
  { label: 'Historical Records', href: '/history', icon: Archive },
  { label: 'AI Analyst', href: '/analyst', icon: Bot },
  { label: 'Catalog Management', href: '/catalog', icon: BookOpen },
]

interface CommandPaletteProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const { data: results } = useSearch(debouncedQuery)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, setOpen])

  const handleSelect = useCallback(
    (id: number, type: 'record' | 'catalog' | 'historical') => {
      setOpen(false)
      setSearchQuery('')

      switch (type) {
        case 'record':
          router.push(`/validate?recordId=${id}`)
          break
        case 'catalog':
          router.push(`/catalog?sku=${id}`)
          break
        case 'historical':
          router.push(`/history?recordId=${id}`)
          break
      }
    },
    [router, setOpen]
  )

  const handlePageSelect = useCallback(
    (href: string) => {
      setOpen(false)
      setSearchQuery('')
      router.push(href)
    },
    [router, setOpen]
  )

  // Filter pages by search query
  const filteredPages = searchQuery
    ? pages.filter((p) => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages

  const hasApiResults = results && (
    results.records.length > 0 ||
    results.catalog.length > 0 ||
    results.historical.length > 0
  )

  const showEmptyTip = debouncedQuery.length >= 2 && !hasApiResults && filteredPages.length === 0

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search records, catalog, or go to page..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {/* Pages group - always visible */}
        {filteredPages.length > 0 && (
          <CommandGroup heading="Pages">
            {filteredPages.map((page) => {
              const Icon = page.icon
              return (
                <CommandItem
                  key={page.href}
                  onSelect={() => handlePageSelect(page.href)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{page.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* API search results */}
        {results?.records && results.records.length > 0 && (
          <CommandGroup heading="Records">
            {results.records.map((record) => (
              <CommandItem
                key={`record-${record.id}`}
                onSelect={() => handleSelect(record.id || 0, 'record')}
                className="cursor-pointer"
              >
                <div className="flex flex-col flex-1">
                  <span className="font-medium">{record.sku}</span>
                  <span className="text-xs text-muted-foreground">{record.item_description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.catalog && results.catalog.length > 0 && (
          <CommandGroup heading="Catalog">
            {results.catalog.map((entry) => (
              <CommandItem
                key={`catalog-${entry.id}`}
                onSelect={() => handleSelect(entry.id || 0, 'catalog')}
                className="cursor-pointer"
              >
                <div className="flex flex-col flex-1">
                  <span className="font-medium">{entry.sku}</span>
                  <span className="text-xs text-muted-foreground">{entry.brand}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.historical && results.historical.length > 0 && (
          <CommandGroup heading="Historical">
            {results.historical.map((record) => (
              <CommandItem
                key={`historical-${record.id}`}
                onSelect={() => handleSelect(record.id || 0, 'historical')}
                className="cursor-pointer"
              >
                <div className="flex flex-col flex-1">
                  <span className="font-medium">{record.sku}</span>
                  <span className="text-xs text-muted-foreground">{record.distributor}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Empty state */}
        {showEmptyTip && (
          <CommandEmpty>
            <div className="space-y-1">
              <p>No results for &apos;{debouncedQuery}&apos;</p>
              <p className="text-xs text-muted-foreground">
                Tip: Search covers approved records, catalog, and historical data.
              </p>
            </div>
          </CommandEmpty>
        )}

        {!showEmptyTip && !hasApiResults && filteredPages.length === 0 && (
          <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  )
}
