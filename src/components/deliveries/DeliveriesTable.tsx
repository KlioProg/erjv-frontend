import { useState } from 'react'
import { ChevronDown, MoreHorizontal, X, Truck } from 'lucide-react'
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
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import {
  deliveryPrimaryAction,
  deliveryCanCancel,
  type DeliverySection,
  type DeliveryRow,
} from '@/features/logistics/delivery-workflow'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
type Props = {
  rows: DeliveryRow[]
  section: DeliverySection
  canManage: boolean
  isLoading: boolean
  pending: boolean
  onView: (row: DeliveryRow) => void
  onSchedule: (row: DeliveryRow) => void
  onDispatch: (row: DeliveryRow) => void
  onComplete: (row: DeliveryRow) => void
  onCancel: (row: DeliveryRow) => void
}
export function DeliveriesTable({
  rows,
  section,
  canManage,
  isLoading,
  pending,
  onView,
  onSchedule,
  onDispatch,
  onComplete,
  onCancel,
}: Props) {
  const desktop = useMediaQuery('(min-width: 80rem)')
  const tablet = useMediaQuery('(min-width: 48rem)')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const labels = {
    schedule: 'Schedule',
    receive: 'Receive Products',
    dispatch: 'Dispatch',
    deliver: 'Mark Delivered',
  }
  const run = (row: DeliveryRow) => {
    const action = deliveryPrimaryAction(row, canManage)
    if (action === 'schedule') onSchedule(row)
    else if (action === 'dispatch') onDispatch(row)
    else if (action) onComplete(row)
  }
  const hasActions =
    section !== 'history' &&
    rows.some((row) => deliveryPrimaryAction(row, canManage) || deliveryCanCancel(row, canManage))
  const columns: ColumnDef<DeliveryRow>[] = [
    {
      id: 'reference',
      header: 'Delivery Number',
      accessorKey: 'reference',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue
            value={row.reference}
            href={`#delivery-${row.key}`}
            onActivate={() => onView(row)}
            className="text-sm font-semibold text-foreground"
          />
          {section === 'history' && (
            <span className="text-xs text-muted-foreground">{row.type}</span>
          )}
          {!desktop && (
            <OverflowValue value={row.party} className="text-xs text-muted-foreground" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 self-start px-0 text-xs text-muted-foreground"
            aria-label={`${expanded.has(row.key) ? 'Hide' : 'Show'} details for ${row.reference}`}
            aria-expanded={expanded.has(row.key)}
            aria-controls={`delivery-details-${row.key}`}
            onClick={() => toggle(row.key)}
          >
            {expanded.has(row.key) ? 'Less' : 'More'}
            <ChevronDown
              aria-hidden="true"
              className={expanded.has(row.key) ? 'size-3.5 rotate-180' : 'size-3.5'}
            />
          </Button>
        </div>
      ),
    },
    {
      id: 'order',
      header:
        section === 'incoming'
          ? 'Purchase Order'
          : section === 'outgoing'
            ? 'Sales Order'
            : 'Order',
      accessorKey: 'relatedOrder',
      sortable: true,
      cell: ({ row }) => <OverflowValue value={row.relatedOrder} className="text-sm" />,
    },
    {
      id: 'party',
      header:
        section === 'incoming' ? 'Supplier' : section === 'outgoing' ? 'Customer' : 'From / To',
      accessorKey: 'party',
      sortable: true,
      cell: ({ row }) => <OverflowValue value={row.party} className="text-sm" />,
    },
    {
      id: 'warehouse',
      header: section === 'incoming' ? 'Destination Warehouse' : 'Warehouse',
      accessorKey: 'warehouse',
      sortable: true,
      cell: ({ row }) => <OverflowValue value={row.warehouse} className="text-sm" />,
    },
    {
      id: 'date',
      header: 'Schedule',
      sortable: true,
      sortKey: (row) => (row.date ? new Date(row.date).getTime() : null),
      cell: ({ row }) => (
        <OverflowValue
          value={DeliveryUtils.formatDateTime(row.date)}
          className="text-sm text-muted-foreground"
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      className: 'px-2 sm:px-3.5',
      headerClassName: 'px-2 sm:px-3.5',
      cell: ({ row }) => <DeliveryStatusBadge status={row.status} showDot={false} />,
    },
    {
      id: 'actions',
      header: tablet ? 'Actions' : <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'px-1 sm:px-3.5',
      headerClassName: 'px-1 sm:px-3.5',
      cell: ({ row }) => {
        const primary = deliveryPrimaryAction(row, canManage)
        const cancel = deliveryCanCancel(row, canManage)
        if (!primary && !cancel) return null
        return (
          <DataTableActions>
            {desktop ? (
              <>
                {primary && (
                  <Button
                    size="sm"
                    disabled={pending}
                    aria-label={`${labels[primary]} ${row.reference}`}
                    onClick={() => run(row)}
                  >
                    {labels[primary]}
                  </Button>
                )}
                {cancel && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={pending}
                    aria-label={`Cancel ${row.reference}`}
                    onClick={() => onCancel(row)}
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
                    size="icon"
                    variant="ghost"
                    className="size-8 pointer-coarse:size-10"
                    disabled={pending}
                    aria-label={`Actions for ${row.reference}`}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {primary && (
                      <DropdownMenuItem onSelect={() => run(row)} disabled={pending}>
                        {labels[primary]}
                      </DropdownMenuItem>
                    )}
                    {cancel && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onCancel(row)}
                        disabled={pending}
                      >
                        Cancel Delivery
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
  const visible = columns.filter(
    (column) =>
      (column.id !== 'party' || desktop) &&
      (column.id !== 'date' || desktop) &&
      (!['order', 'warehouse'].includes(column.id!) || tablet) &&
      (column.id !== 'actions' || hasActions),
  )
  const weights: Record<string, number> = desktop
    ? { reference: 24, order: 19, party: 24, warehouse: 24, date: 24, status: 19, actions: 30 }
    : tablet
      ? { reference: 32, order: 24, warehouse: 30, status: 23, actions: 14 }
      : { reference: 90, status: 75, actions: 45 }
  const total = visible.reduce((sum, column) => sum + weights[column.id!], 0)
  return (
    <DataTable
      data={rows}
      columns={visible.map((column) => ({
        ...column,
        width: `${(100 * weights[column.id!]) / total}%`,
      }))}
      getRowKey={(row) => row.key}
      isLoading={isLoading}
      tableClassName="table-fixed w-full"
      appearance="subtle"
      pageSizeOptions={[10, 25, 50, 100]}
      renderExpandedRow={(row) =>
        expanded.has(row.key) ? (
          <div
            id={`delivery-details-${row.key}`}
            role="region"
            aria-label={`Details for ${row.reference}`}
            className="px-3.5 py-4"
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                [row.type === 'Incoming' ? 'Supplier' : 'Customer', row.party],
                ['Order', row.relatedOrder],
                ['Warehouse', row.warehouse],
                ['Schedule', DeliveryUtils.formatDateTime(row.date)],
                ...(row.type === 'Outgoing'
                  ? [
                      ['Vehicle', row.vehicle],
                      ['Driver', row.driver],
                    ]
                  : [['Supplier Reference', row.record.supplierReference ?? '—']]),
                [
                  'Completed',
                  DeliveryUtils.formatDateTime(
                    row.type === 'Incoming' ? row.record.completedAt : row.record.deliveredAt,
                  ),
                ],
                ['Notes', row.record.notes ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null
      }
      emptyContent={
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Truck aria-hidden="true" className="size-7 text-muted-foreground" />
          <p className="text-sm font-semibold">No deliveries found</p>
          <p className="text-sm text-muted-foreground">
            {section === 'history'
              ? 'Completed and cancelled deliveries appear here. Adjust filters to find a record.'
              : 'Adjust the filters or create a delivery for a confirmed order.'}
          </p>
        </div>
      }
    />
  )
}
