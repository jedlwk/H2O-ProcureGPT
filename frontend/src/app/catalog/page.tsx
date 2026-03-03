'use client'

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { type ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/records/data-table'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { AlertTriangle, Upload, Trash2, BookOpen, DollarSign, FileText, X } from 'lucide-react'
import { useCatalogEntries, useCatalogStats, useUploadCatalog, useDeleteCatalogEntry, useReferenceDocs, useUploadReferencePdf, useDeleteReferenceDoc } from '@/lib/hooks/use-catalog'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import type { CatalogEntry } from '@/lib/types'

export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [adjustDialog, setAdjustDialog] = useState(false)
  const [adjustPct, setAdjustPct] = useState('')
  const [adjustBrand, setAdjustBrand] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading } = useCatalogStats()
  const { data: entries, isLoading: entriesLoading, refetch } = useCatalogEntries({ search, limit: 1000 })
  const uploadMutation = useUploadCatalog()
  const deleteMutation = useDeleteCatalogEntry()
  const { data: referenceDocs, isLoading: refDocsLoading } = useReferenceDocs()
  const uploadRefPdfMutation = useUploadReferencePdf()
  const deleteRefDocMutation = useDeleteReferenceDoc()

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    if (!search) return entries
    const lowerSearch = search.toLowerCase()
    return entries.filter(
      (e) =>
        e.sku.toLowerCase().includes(lowerSearch) ||
        (e.item_description?.toLowerCase().includes(lowerSearch)) ||
        (e.brand?.toLowerCase().includes(lowerSearch))
    )
  }, [entries, search])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const result = await uploadMutation.mutateAsync(file)
      toast.success(`Uploaded ${result.inserted_count} entries`)
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errors during upload`)
      }
      refetch()
      e.target.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    try {
      await deleteMutation.mutateAsync(deleteId)
      toast.success('Entry deleted')
      setDeleteId(null)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleBatchAdjustPrices = async () => {
    if (!adjustPct || isNaN(parseFloat(adjustPct))) {
      toast.error('Please enter a valid percentage')
      return
    }

    setIsAdjusting(true)
    try {
      const pct = parseFloat(adjustPct)
      const result = await api.catalog.batchAdjustPrices(pct, adjustBrand || undefined)
      toast.success(`Updated prices for ${result.updated} entries`)
      setAdjustDialog(false)
      setAdjustPct('')
      setAdjustBrand('')
      queryClient.invalidateQueries({ queryKey: ['catalogEntries'] })
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Batch adjust failed')
    } finally {
      setIsAdjusting(false)
    }
  }

  const handleRefPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await uploadRefPdfMutation.mutateAsync(file)
      toast.success(`Reference PDF "${file.name}" uploaded and indexed`)
      e.target.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleDeleteRefDoc = async (id: number) => {
    try {
      await deleteRefDocMutation.mutateAsync(id)
      toast.success('Reference PDF removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnDef<CatalogEntry, unknown>[] = useMemo(() => [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono font-semibold">{row.original.sku}</span>,
    },
    {
      accessorKey: 'item_description',
      header: 'Description',
      cell: ({ row }) => <span className="text-sm">{row.original.item_description || '-'}</span>,
    },
    {
      accessorKey: 'brand',
      header: 'Brand',
      cell: ({ row }) => (row.original.brand ? <Badge variant="outline">{row.original.brand}</Badge> : <span className="text-muted-foreground">-</span>),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.category || '-'}</span>,
    },
    {
      accessorKey: 'base_price',
      header: 'Base Price',
      cell: ({ row }) => {
        const price = row.original.base_price
        return price !== null && price !== undefined ? `${row.original.currency || 'USD'} ${price.toFixed(2)}` : '-'
      },
    },
    {
      accessorKey: 'min_price',
      header: 'Min',
      cell: ({ row }) => {
        const price = row.original.min_price
        return price !== null && price !== undefined ? price.toFixed(2) : '-'
      },
    },
    {
      accessorKey: 'max_price',
      header: 'Max',
      cell: ({ row }) => {
        const price = row.original.max_price
        return price !== null && price !== undefined ? price.toFixed(2) : '-'
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-400"
          onClick={() => setDeleteId(row.original.id || null)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
      size: 40,
    },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Catalog"
        description="Upload and manage your product catalog"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustDialog(true)}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Adjust Prices
          </Button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Entries"
            value={stats.total_entries}
            icon={BookOpen}
          />
          <MetricCard
            title="Brands"
            value={stats.total_brands}
            icon={BookOpen}
          />
          <MetricCard
            title="Categories"
            value={stats.total_categories}
            icon={BookOpen}
          />
        </div>
      )}

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Upload a CSV or Excel file with columns: sku (required), item_description, brand, base_price, min_price, max_price, currency, category
            </p>
            <div className="relative">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
                className="hidden"
                id="catalog-upload"
              />
              <label htmlFor="catalog-upload">
                <Button
                  asChild
                  variant="outline"
                  className="w-full cursor-pointer"
                  disabled={uploadMutation.isPending}
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadMutation.isPending ? 'Uploading...' : 'Choose File or Drag & Drop'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reference PDFs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reference PDFs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Upload a PDF catalog to enable fallback price lookups when SKUs aren&apos;t found in the structured catalog.
            </p>
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleRefPdfUpload}
                disabled={uploadRefPdfMutation.isPending}
                className="hidden"
                id="ref-pdf-upload"
              />
              <label htmlFor="ref-pdf-upload">
                <Button
                  asChild
                  variant="outline"
                  className="cursor-pointer"
                  disabled={uploadRefPdfMutation.isPending}
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadRefPdfMutation.isPending ? 'Uploading & Indexing...' : 'Upload Reference PDF'}
                  </span>
                </Button>
              </label>
            </div>
            {referenceDocs && referenceDocs.length > 0 ? (
              <div className="space-y-2">
                {referenceDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.original_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 shrink-0"
                      onClick={() => handleDeleteRefDoc(doc.id)}
                      disabled={deleteRefDocMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : !refDocsLoading ? (
              <p className="text-xs text-muted-foreground italic">No reference PDFs uploaded yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by SKU, description, or brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Catalog Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Catalog Entries ({filteredEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No entries found</div>
          ) : (
            <DataTable columns={columns} data={filteredEntries} />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Catalog Entry
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The catalog entry will be removed from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Price Adjustment Dialog */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Batch Adjust Prices
            </DialogTitle>
            <DialogDescription>
              Adjust catalog prices by a percentage for all entries matching your criteria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Percentage Change (%)</label>
              <Input
                type="number"
                placeholder="10.5 for +10.5%, -5 for -5%"
                value={adjustPct}
                onChange={(e) => setAdjustPct(e.target.value)}
                step="0.1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Filter by Brand (optional)</label>
              <Input
                placeholder="Leave blank to apply to all brands"
                value={adjustBrand}
                onChange={(e) => setAdjustBrand(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchAdjustPrices}
              disabled={isAdjusting || !adjustPct}
            >
              {isAdjusting ? 'Adjusting...' : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
