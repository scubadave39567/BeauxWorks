import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { DataTablePagination } from './data-table-pagination'
import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DataTable({
  columns,
  data,
  searchKey,
  searchValue,
  onRowClick,
  pageSize = 10,
  renderCard,
}) {
  const [sorting, setSorting] = useState([])
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      globalFilter: searchValue,
    },
    onGlobalFilterChange: () => {},
    globalFilterFn: searchKey
      ? (row, _columnId, filterValue) => {
          const val = row.getValue(searchKey)
          return String(val ?? '').toLowerCase().includes(String(filterValue).toLowerCase())
        }
      : undefined,
    initialState: {
      pagination: { pageSize },
    },
  })

  // Mobile card view
  if (!isDesktop && renderCard) {
    return (
      <div>
        <div className="space-y-3">
          {table.getRowModel().rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No results.</p>
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {renderCard(row.original)}
              </div>
            ))
          )}
        </div>
        <DataTablePagination table={table} />
      </div>
    )
  }

  // Desktop table view
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer select-none'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
