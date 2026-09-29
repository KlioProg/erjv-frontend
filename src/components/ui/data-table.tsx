import { useState, useMemo, type ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Package } from 'lucide-react'
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

  // --- Future Extensibility Hooks ---
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

  // --- Loading & Empty State Props (Matches InventoryItemCatalog UX) ---
  /** Indicates whether data is currently loading */
  isLoading?: boolean

  /** Custom message or spinner component during loading */
  loadingMessage?: ReactNode

  /** Custom empty state card or message when data is empty */
  emptyContent?: ReactNode

  // --- Sorting (Hybrid: built-in client sorting by default, controlled via props if provided) ---
  /** Optional controlled sort configuration */
  sortConfig?: SortConfig | null

  /** Callback fired when sorting changes */
  onSortChange?: (newSort: SortConfig | null) => void

  /** Default column sort on initial render */
  defaultSort?: SortConfig

  /** When true, client-side sorting in DataTable is disabled (useful for server-side sorting) */
  manualSorting?: boolean

  // --- Container & Table Styling ---
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
 * Generic, extensible DataTable component styled to match project design conventions.
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  rowClassName,
  onRowClick,
  isLoading,
  loadingMessage = 'Loading records...',
  emptyContent,
  sortConfig: controlledSort,
  onSortChange,
  defaultSort,
  manualSorting = false,
  className,
  tableClassName,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortConfig | null>(defaultSort ?? null)

  const activeSort = controlledSort !== undefined ? controlledSort : internalSort

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

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card',
        className,
      )}
    >
      <Table className={tableClassName}>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {resolvedColumns.map((column) => {
              const alignClass = getAlignmentClass(column.align)
              const justifyClass = getHeaderJustifyClass(column.align)
              const isSorted = activeSort?.key === column.resolvedId
              const widthStyle = column.width != null
                ? { width: typeof column.width === 'number' ? `${column.width}px` : column.width }
                : undefined

              return (
                <TableHead
                  key={column.resolvedId}
                  style={widthStyle}
                  className={cn(
                    'text-xs font-bold text-foreground select-none',
                    alignClass,
                    column.headerClassName,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortToggle(column)}
                      className={cn(
                        'inline-flex items-center gap-1.5 font-bold hover:text-foreground/80 cursor-pointer transition-colors focus:outline-hidden group',
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
          {sortedData.map((row, rowIndex) => {
            const rowKey = getRowKey
              ? getRowKey(row, rowIndex)
              : ((row as { id?: string | number })?.id ?? rowIndex)
            const computedRowClass = rowClassName?.(row, rowIndex)

            return (
              <TableRow
                key={rowKey}
                onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                className={cn(
                  'hover:bg-muted/20 transition-colors',
                  onRowClick && 'cursor-pointer',
                  computedRowClass,
                )}
              >
                {resolvedColumns.map((column) => {
                  const alignClass = getAlignmentClass(column.align)
                  const value = getCellValue(row, column)
                  const widthStyle = column.width != null
                    ? { width: typeof column.width === 'number' ? `${column.width}px` : column.width }
                    : undefined

                  return (
                    <TableCell
                      key={column.resolvedId}
                      style={widthStyle}
                      className={cn(alignClass, column.className)}
                    >
                      {column.cell ? (
                        column.cell({ row, value, index: rowIndex })
                      ) : (
                        <span className="text-xs text-foreground">
                          {value != null && typeof value !== 'object' ? String(value) : '—'}
                        </span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
