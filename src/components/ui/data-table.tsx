import { Fragment, useState, useMemo, type ReactNode } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

export type ColumnAlign = 'left' | 'center' | 'right'

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  key: string
  direction: SortDirection
}

export interface CellContext<T, V = unknown> {
  row: T
  value: V
  index: number
}

export interface HeaderContext<T> {
  column: ColumnDef<T>
  sortConfig?: SortConfig | null
  onSort?: () => void
}

export interface ColumnDef<T, V = unknown> {
  /** Unique column identifier. Auto-derived from accessorKey/accessorKeys if omitted. */
  id?: string

  /** Column header label or custom header renderer */
  header: ReactNode | ((context: HeaderContext<T>) => ReactNode)

  /** Single property key from row (e.g. 'unitPrice') */
  accessorKey?: keyof T

  /** Multiple property keys from row (e.g. ['name', 'variety']) */
  accessorKeys?: (keyof T)[]

  /** Functional extractor computing a derived/combined value from multiple fields */
  accessorFn?: (row: T) => V

  /** Custom cell renderer. Receives { row, value, index }. Defaults to stringified value or '—' */
  cell?: (context: CellContext<T, V>) => ReactNode

  /** Cell and header alignment: automatically synchronizes text-left, text-center, or text-right */
  align?: ColumnAlign

  /** Fixed or minimum width for column stability (e.g. '80px', '20%', 120) */
  width?: string | number

  /** Additional custom classNames for the table cell */
  className?: string

  /** Additional custom classNames for the table header */
  headerClassName?: string

  // --- Extensibility Hooks ---
  /** Whether the column can be clicked to sort */
  sortable?: boolean

  /** Custom sort value extractor if displayed content differs from sorting criteria */
  sortKey?: keyof T | ((row: T) => string | number | boolean | Date | null | undefined)

  /** Whether the column supports filtering */
  filterable?: boolean
}

export interface DataTableProps<T> {
  /** The data array to display */
  data: T[]

  /** Column definitions array */
  columns: ColumnDef<T>[]

  /** Unique key extractor for each row. Defaults to (row) => row.id ?? index */
  getRowKey?: (row: T, index: number) => string | number

  /** Optional function to compute custom classNames for a table row (e.g. archived opacity) */
  rowClassName?: (row: T, index: number) => string

  /** Click handler for an entire row */
  onRowClick?: (row: T, index: number) => void

  /** Optional content shown directly beneath a visible row. Return null when collapsed. */
  renderExpandedRow?: (row: T, index: number) => ReactNode

  // --- Loading & Empty State Props ---
  /** Indicates whether data is currently loading */
  isLoading?: boolean

  /** Custom message or spinner component during loading */
  loadingMessage?: ReactNode

  /** Custom empty state card or message when data is empty */
  emptyContent?: ReactNode

  // --- Sorting ---
  /** Optional controlled sort configuration */
  sortConfig?: SortConfig | null

  /** Callback fired when sorting changes */
  onSortChange?: (newSort: SortConfig | null) => void

  /** Default column sort on initial render */
  defaultSort?: SortConfig

  /** When true, client-side sorting in DataTable is disabled (useful for server-side sorting) */
  manualSorting?: boolean

  // --- Pagination (Site-wide Reusable) ---
  /** Whether pagination is enabled. Defaults to true */
  pagination?: boolean

  /** Controlled current page (1-indexed) */
  page?: number

  /** Callback fired when page changes */
  onPageChange?: (newPage: number) => void

  /** Page size (rows per page). Defaults to 10 */
  pageSize?: number

  /** Available page size options */
  pageSizeOptions?: number[]

  /** Callback fired when page size changes */
  onPageSizeChange?: (newPageSize: number) => void

  /** Total records count (required for server-side manualPagination) */
  totalCount?: number

  /** When true, client-side pagination slicing is bypassed for external/server pagination */
  manualPagination?: boolean

  // --- Container & Table Styling ---
  /** Opt-in lighter separators, roomier cells and clearer neutral row hover. */
  appearance?: 'default' | 'subtle'
  className?: string
  tableClassName?: string
}

/**
 * Derives a unique column identifier based on id, accessorKey, or accessorKeys.
 */
function getColumnId<T>(column: ColumnDef<T>, index: number): string {
  if (column.id) return column.id
  if (column.accessorKey) return String(column.accessorKey)
  if (column.accessorKeys && column.accessorKeys.length > 0) {
    return column.accessorKeys.map(String).join('_')
  }
  return `col_${index}`
}

/**
 * Resolves cell value by prioritizing accessorFn, then accessorKey, then accessorKeys.
 */
function getCellValue<T, V = unknown>(row: T, column: ColumnDef<T, V>): V | undefined {
  if (column.accessorFn) {
    return column.accessorFn(row)
  }
  if (column.accessorKey) {
    return row[column.accessorKey] as unknown as V
  }
  if (column.accessorKeys && column.accessorKeys.length > 0) {
    return column.accessorKeys.reduce((acc, key) => {
      acc[key] = row[key]
      return acc
    }, {} as Partial<T>) as unknown as V
  }
  return undefined
}

/**
 * Resolves sortable value for comparator logic.
 */
function getSortValue<T>(row: T, column: ColumnDef<T>): unknown {
  if (typeof column.sortKey === 'function') {
    return column.sortKey(row)
  }
  if (column.sortKey) {
    return row[column.sortKey]
  }
  if (column.accessorFn) {
    return column.accessorFn(row)
  }
  if (column.accessorKey) {
    return row[column.accessorKey]
  }
  return undefined
}

function getAlignmentClass(align?: ColumnAlign): string {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    case 'left':
    default:
      return 'text-left'
  }
}

function getHeaderJustifyClass(align?: ColumnAlign): string {
  switch (align) {
    case 'center':
      return 'justify-center'
    case 'right':
      return 'justify-end'
    case 'left':
    default:
      return 'justify-start'
  }
}

/**
 * Helper to compute an array of visible page numbers with ellipsis (e.g. [1, 2, '...', 9, 10])
 */
function getVisiblePages(totalPages: number, currentPage: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

/**
 * Generic, extensible DataTable component styled to match project design conventions
 * with built-in client/server sorting and pagination.
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  rowClassName,
  onRowClick,
  renderExpandedRow,
  isLoading,
  loadingMessage = 'Loading records...',
  emptyContent,
  sortConfig: controlledSort,
  onSortChange,
  defaultSort,
  manualSorting = false,
  pagination = true,
  page: controlledPage,
  onPageChange,
  pageSize: controlledPageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  totalCount,
  manualPagination = false,
  appearance = 'default',
  className,
  tableClassName,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortConfig | null>(defaultSort ?? null)
  const [internalPage, setInternalPage] = useState<number>(1)
  const [internalPageSize, setInternalPageSize] = useState<number>(controlledPageSize ?? 10)

  const activeSort = controlledSort !== undefined ? controlledSort : internalSort
  const activePage = controlledPage !== undefined ? controlledPage : internalPage
  const activePageSize = controlledPageSize !== undefined ? controlledPageSize : internalPageSize

  // Map columns with deterministic IDs
  const resolvedColumns = useMemo(() => {
    return columns.map((col, index) => ({
      ...col,
      resolvedId: getColumnId(col, index),
    }))
  }, [columns])

  const handleSortToggle = (column: (typeof resolvedColumns)[number]) => {
    if (!column.sortable) return

    let nextSort: SortConfig | null

    if (activeSort?.key === column.resolvedId) {
      if (activeSort.direction === 'asc') {
        nextSort = { key: column.resolvedId, direction: 'desc' }
      } else {
        nextSort = null // tri-state toggle: asc -> desc -> none
      }
    } else {
      nextSort = { key: column.resolvedId, direction: 'asc' }
    }

    if (controlledSort === undefined) {
      setInternalSort(nextSort)
    }
    onSortChange?.(nextSort)
  }

  // Client-side sorting logic if active and not manually sorted
  const sortedData = useMemo(() => {
    if (manualSorting || !activeSort) {
      return data
    }

    const targetColumn = resolvedColumns.find((col) => col.resolvedId === activeSort.key)
    if (!targetColumn) {
      return data
    }

    return [...data].sort((a, b) => {
      const valA = getSortValue(a, targetColumn)
      const valB = getSortValue(b, targetColumn)

      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      let comparison: number

      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB
      } else if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime()
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = (valA ? 1 : 0) - (valB ? 1 : 0)
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      }

      return activeSort.direction === 'desc' ? -comparison : comparison
    })
  }, [data, activeSort, manualSorting, resolvedColumns])

  // Pagination metrics
  const totalRows = manualPagination ? (totalCount ?? data.length) : sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalRows / activePageSize))
  const safeCurrentPage = Math.min(Math.max(1, activePage), totalPages)

  const handlePageSelect = (newPage: number) => {
    const clamped = Math.min(Math.max(1, newPage), totalPages)
    if (controlledPage === undefined) {
      setInternalPage(clamped)
    }
    onPageChange?.(clamped)
  }

  const handlePageSizeSelect = (newSize: number) => {
    if (controlledPageSize === undefined) {
      setInternalPageSize(newSize)
    }
    onPageSizeChange?.(newSize)
    handlePageSelect(1)
  }

  // Paginated records to render
  const startIndex = (safeCurrentPage - 1) * activePageSize
  const endIndex = Math.min(startIndex + activePageSize, totalRows)
  const displayRows = useMemo(() => {
    if (manualPagination || !pagination) {
      return sortedData
    }
    return sortedData.slice(startIndex, endIndex)
  }, [manualPagination, pagination, sortedData, startIndex, endIndex])

  // Loading View
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Spinner className="mr-2 size-5" />
        <span className="text-xs">{loadingMessage}</span>
      </div>
    )
  }

  // Empty View
  if (sortedData.length === 0) {
    if (emptyContent) {
      return <>{emptyContent}</>
    }

    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="size-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No records found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            There are currently no items to display.
          </p>
        </CardContent>
      </Card>
    )
  }

  const visiblePages = getVisiblePages(totalPages, safeCurrentPage)

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 overflow-hidden shadow-xs bg-card flex flex-col',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <Table
          className={cn(
            '[&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-3 [&_th:first-child]:pl-3 [&_td:last-child]:pr-3 [&_th:last-child]:pr-3',
            // Keep controls compact even when feature renderers supply custom typography.
            '[&_tbody_td_button]:text-xs [&_tbody_td_button]:font-medium [&_tbody_td_button]:leading-4 [&_tbody_[data-slot=badge]]:text-xs [&_tbody_[data-slot=badge]]:font-semibold [&_tbody_[data-slot=badge]]:leading-4 [&_tbody_[data-slot=badge]]:px-2 [&_tbody_[data-slot=badge]]:py-0.5',
            tableClassName,
          )}
        >
          <TableHeader className="bg-muted/40">
            <TableRow>
              {resolvedColumns.map((column) => {
                const alignClass = getAlignmentClass(column.align)
                const justifyClass = getHeaderJustifyClass(column.align)
                const isSorted = activeSort?.key === column.resolvedId
                const widthStyle =
                  column.width != null
                    ? {
                        width:
                          typeof column.width === 'number' ? `${column.width}px` : column.width,
                      }
                    : undefined

                return (
                  <TableHead
                    key={column.resolvedId}
                    style={widthStyle}
                    className={cn(
                      'text-xs font-semibold text-foreground select-none',
                      appearance === 'subtle' && 'text-muted-foreground',
                      alignClass,
                      column.headerClassName,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortToggle(column)}
                        className={cn(
                          'inline-flex items-center gap-1.5 hover:text-foreground/80 cursor-pointer transition-colors focus:outline-hidden group',
                          justifyClass,
                          column.align === 'right' && 'w-full',
                        )}
                      >
                        {typeof column.header === 'function'
                          ? column.header({
                              column,
                              sortConfig: activeSort,
                              onSort: () => handleSortToggle(column),
                            })
                          : column.header}

                        <span className="shrink-0">
                          {isSorted && activeSort.direction === 'asc' ? (
                            <ArrowUp className="size-3.5 text-primary" />
                          ) : isSorted && activeSort.direction === 'desc' ? (
                            <ArrowDown className="size-3.5 text-primary" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-30 group-hover:opacity-70 transition-opacity" />
                          )}
                        </span>
                      </button>
                    ) : typeof column.header === 'function' ? (
                      column.header({ column, sortConfig: activeSort })
                    ) : (
                      column.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {displayRows.map((row, rowIndex) => {
              const rowKey = getRowKey
                ? getRowKey(row, rowIndex)
                : ((row as { id?: string | number })?.id ?? rowIndex)
              const computedRowClass = rowClassName?.(row, rowIndex)
              const expandedContent = renderExpandedRow?.(row, rowIndex)

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      // The unlayered global border rule otherwise overrides Tailwind colors.
                      appearance === 'subtle' && 'border-border/60! hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                      computedRowClass,
                    )}
                  >
                    {resolvedColumns.map((column) => {
                      const alignClass = getAlignmentClass(column.align)
                      const value = getCellValue(row, column)
                      const widthStyle =
                        column.width != null
                          ? {
                              width:
                                typeof column.width === 'number'
                                  ? `${column.width}px`
                                  : column.width,
                            }
                          : undefined

                      return (
                        <TableCell
                          key={column.resolvedId}
                          style={widthStyle}
                          className={cn(
                            'text-xs text-foreground',
                            appearance === 'subtle' && 'py-4',
                            alignClass,
                            column.className,
                          )}
                        >
                          {column.cell ? (
                            column.cell({ row, value, index: rowIndex })
                          ) : (
                            <span>
                              {value != null && typeof value !== 'object' ? String(value) : '—'}
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  {expandedContent && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={resolvedColumns.length} className="p-0 align-top">
                        {expandedContent}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {pagination && totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/70 bg-muted/25 px-4 py-3 text-xs">
          <div className="flex items-center gap-4 text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
            <span>
              Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-foreground">{endIndex}</span> of{' '}
              <span className="font-bold text-foreground">{totalRows}</span> entries
            </span>

            {pageSizeOptions.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Rows:</span>
                <select
                  aria-label="Rows per page"
                  value={activePageSize}
                  onChange={(e) => handlePageSizeSelect(Number(e.target.value))}
                  className="h-7 rounded-md border border-border/80 bg-background px-2 text-[11px] font-semibold text-foreground focus:outline-hidden cursor-pointer"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 self-center sm:self-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageSelect(1)}
                disabled={safeCurrentPage === 1}
                className="size-7.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="First Page"
              >
                <ChevronsLeft className="size-3.5" />
                <span className="sr-only">First Page</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageSelect(safeCurrentPage - 1)}
                disabled={safeCurrentPage === 1}
                className="size-7.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="Previous Page"
              >
                <ChevronLeft className="size-3.5" />
                <span className="sr-only">Previous Page</span>
              </Button>

              <div className="flex items-center gap-1 mx-1">
                {visiblePages.map((pageNum, idx) => {
                  if (pageNum === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1.5 text-xs text-muted-foreground select-none"
                      >
                        …
                      </span>
                    )
                  }

                  const isCurrent = pageNum === safeCurrentPage
                  return (
                    <Button
                      key={pageNum}
                      variant={isCurrent ? 'primary-contrast' : 'ghost'}
                      size="sm"
                      onClick={() => handlePageSelect(pageNum as number)}
                      className={cn(
                        'size-7.5 p-0 text-xs font-bold rounded-md cursor-pointer transition-all',
                        isCurrent
                          ? 'shadow-2xs font-extrabold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageSelect(safeCurrentPage + 1)}
                disabled={safeCurrentPage === totalPages}
                className="size-7.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="Next Page"
              >
                <ChevronRight className="size-3.5" />
                <span className="sr-only">Next Page</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageSelect(totalPages)}
                disabled={safeCurrentPage === totalPages}
                className="size-7.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="Last Page"
              >
                <ChevronsRight className="size-3.5" />
                <span className="sr-only">Last Page</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
