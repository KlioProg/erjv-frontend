import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, MoreHorizontal, X } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import { formatPurchaseMoney, storedPurchaseTotal } from '@/features/logistics/purchase-pricing'
import {
  purchaseMaterialsSummary,
  purchaseOrderActions,
  purchaseOrderDate,
} from '@/features/logistics/purchase-orders.presentation'
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge'

type Props = {
  orders: PurchaseOrderRecord[]
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  canManage: boolean
  pending: boolean
  isLoading: boolean
  emptyContent: ReactNode
  onView: (id: number) => void
  onConfirm: (id: number) => void
  onCancel: (id: number) => void
}

export function PurchaseOrdersTable({
  orders,
  suppliers,
  products,
  canManage,
  pending,
  isLoading,
  emptyContent,
  onView,
  onConfirm,
  onCancel,
}: Props) {
  const desktop = useMediaQuery('(min-width: 80rem)')
  const tablet = useMediaQuery('(min-width: 48rem)')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())
  const names = new Map(products.map((product) => [product.id, product.name]))
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  const rows = orders.map((order) => ({
    order,
    supplier: order.supplierId == null ? 'No supplier assigned' : supplierNames.get(order.supplierId) ?? `Supplier #${order.supplierId}`,
    materials: purchaseMaterialsSummary(order.items, names),
    total: formatPurchaseMoney(storedPurchaseTotal(order.items)),
    expected: purchaseOrderDate(order.expectedAt),
  }))
  const hasActions = orders.some((order) =>
    Object.values(purchaseOrderActions(order.status, canManage, order.items.length)).some(Boolean),
  )
  const toggle = (id: number) =>
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    {
      id: 'number',
      header: 'Order Number',
      className: 'min-w-0 text-sm',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue
            value={row.order.orderNumber}
            onActivate={() => onView(row.order.id)}
            className="h-auto justify-start p-0 text-left text-sm font-semibold text-foreground underline decoration-current/40 underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring"
          />
          {!tablet && (
            <OverflowValue value={row.supplier} className="text-xs text-muted-foreground" />
          )}
          {!desktop && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 justify-start gap-1 self-start px-0 text-xs text-muted-foreground"
              aria-label={`${expandedIds.has(row.order.id) ? 'Hide' : 'Show'} details for ${row.order.orderNumber}`}
              aria-expanded={expandedIds.has(row.order.id)}
              aria-controls={`po-summary-${row.order.id}`}
              onClick={() => toggle(row.order.id)}
            >
              {expandedIds.has(row.order.id) ? 'Less' : 'More'}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform',
                  expandedIds.has(row.order.id) && 'rotate-180',
                )}
              />
            </Button>
          )}
        </div>
      ),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue value={row.supplier} className="text-sm" />
          {row.order.externalReference && (
            <OverflowValue
              value={row.order.externalReference}
              className="text-xs text-muted-foreground"
            />
          )}
        </div>
      ),
    },
    {
      id: 'materials',
      header: 'Ordered Materials',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-1 text-sm">
          <OverflowValue value={row.materials.preview} />
          {row.materials.more > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              +{row.materials.more} more
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'expected',
      header: 'Expected Date',
      cell: ({ row }) => (
        <OverflowValue value={row.expected} className="text-sm text-muted-foreground" />
      ),
    },
    {
      id: 'total',
      header: 'Total Amount',
      align: 'right',
      cell: ({ row }) => (
        <OverflowValue
          value={row.total}
          className="text-right text-sm font-semibold tabular-nums"
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'px-2 sm:px-3.5',
      headerClassName: 'px-2 sm:px-3.5',
      cell: ({ row }) => <PurchaseOrderStatusBadge status={row.order.status} />,
    },
    {
      id: 'actions',
      header: tablet ? 'Actions' : <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'px-1 sm:px-3.5',
      headerClassName: 'px-1 sm:px-3.5',
      cell: ({ row }) => {
        const actions = purchaseOrderActions(row.order.status, canManage, row.order.items.length)
        if (!actions.confirm && !actions.cancel) return null
        return (
          <DataTableActions>
            {desktop ? (
              <>
                {actions.confirm && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    aria-label={`Confirm ${row.order.orderNumber}`}
                    onClick={() => onConfirm(row.order.id)}
                  >
                    Confirm
                  </Button>
                )}
                {actions.cancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Cancel ${row.order.orderNumber}`}
                    title="Cancel Purchase Order"
                    onClick={() => onCancel(row.order.id)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    className="size-8 pointer-coarse:size-10"
                    aria-label={`Actions for ${row.order.orderNumber}`}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {actions.confirm && (
                      <DropdownMenuItem disabled={pending} onSelect={() => onConfirm(row.order.id)}>
                        <Check aria-hidden="true" />
                        Confirm Purchase Order
                      </DropdownMenuItem>
                    )}
                    {actions.cancel && (
                      <DropdownMenuItem
                        disabled={pending}
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onCancel(row.order.id)}
                      >
                        <X aria-hidden="true" />
                        Cancel Purchase Order
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DataTableActions>
        )
      },
    },
  ]
  const weights: Record<string, number> = desktop
    ? { number: 22, supplier: 26, materials: 28, expected: 18, total: 20, status: 22, actions: 26 }
    : tablet
      ? { number: 32, supplier: 30, total: 22, status: 26, actions: 14 }
      : { number: 90, status: 75, actions: 40 }
  const visible = columns.filter(
    (column) =>
      (column.id !== 'supplier' || tablet) &&
      (!['materials', 'expected'].includes(column.id!) || desktop) &&
      (column.id !== 'total' || tablet) &&
      (column.id !== 'actions' || hasActions),
  )
  const totalWeight = visible.reduce((sum, column) => sum + weights[column.id!], 0)
  return (
    <DataTable
      data={rows}
      columns={visible.map((column) => ({
        ...column,
        width: `${(weights[column.id!] / totalWeight) * 100}%`,
      }))}
      getRowKey={(row) => row.order.id}
      pagination={false}
      appearance="subtle"
      isLoading={isLoading}
      loadingMessage="Loading purchase orders…"
      emptyContent={emptyContent}
      tableClassName="table-fixed w-full"
      renderExpandedRow={(row) =>
        !desktop && expandedIds.has(row.order.id) ? (
          <div
            id={`po-summary-${row.order.id}`}
            role="region"
            aria-label={`Summary for ${row.order.orderNumber}`}
            className="px-3.5 py-4"
          >
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ['Ordered Date', purchaseOrderDate(row.order.orderedAt)],
                ['Expected Date', row.expected],
                ['Total Amount', row.total],
                ['Supplier Reference', row.order.externalReference ?? 'Not set'],
                ['Ordered Materials', row.materials.full],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={label === 'Ordered Materials' ? 'sm:col-span-2' : undefined}
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null
      }
    />
  )
}
