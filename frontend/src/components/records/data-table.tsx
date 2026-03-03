'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  pageSize?: number
  onRowClick?: (row: T) => void
  onSelectionChange?: (rows: T[]) => void
  enableRowSelection?: boolean
  rowClassName?: (row: T) => string
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 20,
  onRowClick,
  onSelectionChange,
  enableRowSelection = false,
  rowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(enableRowSelection && { rowSelection }) },
    onSortingChange: setSorting,
    ...(enableRowSelection && { onRowSelectionChange: setRowSelection }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize } },
    enableRowSelection: enableRowSelection,
  })

  // Call onSelectionChange when selection changes
  useEffect(() => {
    if (enableRowSelection && onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
      onSelectionChange(selectedRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, enableRowSelection, onSelectionChange])

  return (
    <div>
      <div className="rounded-lg border border-border overflow-x-auto overflow-y-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'text-xs font-medium text-muted-foreground',
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    rowClassName?.(row.original)
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              data.length
            )}{' '}
            of {data.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
