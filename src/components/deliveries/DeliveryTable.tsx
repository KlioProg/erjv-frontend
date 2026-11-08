import { incomingOrderSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import { OverflowValue } from '@/components/ui/OverflowValue'
import type { ReactNode } from 'react'
import { CalendarCheck, Check, MoreHorizontal, PackageCheck, Send, X } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { IncomingDeliveryStatusBadge } from './shared/IncomingDeliveryDetailModal'
import {
  formatDeliverySchedule,
  deliveryHistoryDate,
  outgoingStatusLabel,
  DELIVERY_STATUS_LABELS,
  getDeliveryActions,
  type DeliveryAction,
  type DeliveryRow,
  type DeliveryView,
} from '@/features/logistics/delivery-workflow'

const actions = {
  schedule: { label: 'Schedule Arrival', Icon: CalendarCheck },
  ready: { label: 'Edit Delivery', Icon: Check },
  reopen: { label: 'Reopen Draft', Icon: CalendarCheck },
  run: { label: 'Add to Trip', Icon: Send },
  receive: { label: 'Receive Goods', Icon: PackageCheck },
  reconcile: { label: 'Record Results', Icon: Check },
  cancel: { label: 'Cancel Delivery', Icon: X },
}

export function DeliveryTable({
  rows,
  view,
  isLoading,
  canManage,
  pending,
  onView,
  onViewOrder,
  onAction,
  hasFilters = false,
  className,
  headerFilters,
}: {
  rows: DeliveryRow[]
  view: DeliveryView
  isLoading: boolean
  canManage: boolean
  pending: boolean
  onView: (row: DeliveryRow) => void
  onViewOrder: (row: DeliveryRow) => void
  onAction: (row: DeliveryRow, action: DeliveryAction) => void
  hasFilters?: boolean
  className?: string
  headerFilters?: Partial<Record<'order' | 'date' | 'status', ReactNode>>
}) {
  const columns: ColumnDef<DeliveryRow>[] = [
    {
      id: 'reference',
      header: 'Delivery #',
      accessorKey: 'reference',
      sortable: false,
      cell: ({ row }) => (
        <div
          className={
            view === 'incoming'
              ? 'min-w-0'
              : 'min-w-0 max-w-44 whitespace-normal break-words sm:max-w-none'
          }
        >
          <OverflowValue value={row.reference} asChild>
            <Button
              variant="link"
              className={
                view === 'incoming'
                  ? 'h-auto min-h-8 max-w-44 justify-start p-0 text-left text-sm font-semibold text-foreground pointer-coarse:min-h-11'
                  : 'h-auto min-h-8 justify-start whitespace-normal break-words p-0 text-left text-sm font-medium pointer-coarse:min-h-11'
              }
              onClick={() => onView(row)}
              aria-label={`View delivery ${row.reference}`}
            >
              {view === 'incoming' ? (
                <span data-overflow-text className="truncate">
                  {row.reference}
                </span>
              ) : (
                row.reference
              )}
            </Button>
          </OverflowValue>
          <span
            className={
              view === 'incoming' ? 'hidden' : 'block text-xs text-muted-foreground sm:hidden'
            }
          >
            {row.party} · {row.relatedOrder}
          </span>
          <span
            className={
              view === 'incoming' ? 'hidden' : 'block text-xs text-muted-foreground sm:hidden'
            }
          >
            {row.type === 'Outgoing'
              ? outgoingStatusLabel(row.record.status)
              : DELIVERY_STATUS_LABELS[row.status]}{' '}
            · {row.warehouse}
          </span>
        </div>
      ),
    },
    {
      id: 'order',
      header:
        headerFilters?.order ??
        (view === 'incoming'
          ? 'Purchase Order'
          : view === 'outgoing'
            ? 'Sales Order / Warehouse'
            : 'Related Order'),
      className: view === 'incoming' || headerFilters?.order ? undefined : 'hidden lg:table-cell',
      headerClassName:
        view === 'incoming' || headerFilters?.order ? undefined : 'hidden lg:table-cell',
      accessorKey: 'relatedOrder',
      sortable: false,
      cell: ({ row }) => (
        <div
          className={
            view === 'incoming'
              ? 'flex min-w-0 flex-col gap-0.5'
              : 'flex min-w-0 items-center gap-2 whitespace-nowrap'
          }
        >
          <OverflowValue value={row.relatedOrder} className="max-w-48 font-medium" />
          <OverflowValue value={row.warehouse} className="max-w-48 text-xs text-muted-foreground" />
        </div>
      ),
    },
    {
      id: 'party',
      header:
        view === 'incoming' ? 'Supplier' : view === 'outgoing' ? 'Customer' : 'Customer / Supplier',
      accessorKey: 'party',
      className: view === 'incoming' ? undefined : 'hidden md:table-cell',
      headerClassName: view === 'incoming' ? undefined : 'hidden md:table-cell',
      sortable: false,
      cell: ({ row }) => (
        <OverflowValue value={row.party} className={view === 'incoming' ? 'max-w-48' : undefined} />
      ),
    },
    ...(view === 'history'
      ? [
          {
            id: 'type',
            header: 'Direction',
            accessorKey: 'type' as const,
            sortable: false,
          },
        ]
      : []),
    {
      id: 'date',
      header:
        headerFilters?.date ??
        (view === 'history'
          ? 'Recorded event'
          : view === 'incoming'
            ? 'Schedule'
            : 'Delivery Trip'),
      className: view === 'incoming' || headerFilters?.date ? undefined : 'hidden lg:table-cell',
      headerClassName:
        view === 'incoming' || headerFilters?.date ? undefined : 'hidden lg:table-cell',
      sortable: false,
      sortKey: (row) => (row.date ? new Date(row.date).getTime() || 0 : 0),
      cell: ({ row }) => {
        if (view === 'outgoing' && row.type === 'Outgoing')
          return row.record.runId != null ? (
            <Button variant="link" size="sm" onClick={() => onAction(row, 'run')}>
              Open Trip #{row.record.runId}
            </Button>
          ) : (
            'Unassigned'
          )
        const value = view === 'history' ? deliveryHistoryDate(row) : row.date
        if (view === 'history' && !value)
          return <span className="text-muted-foreground">Date not recorded</span>
        const schedule = formatDeliverySchedule(
          value,
          view === 'history',
          row.type === 'Incoming' && !!row.record.scheduledAt,
        )
        return (
          <div
            title={schedule.title}
            className={
              view === 'incoming'
                ? 'flex flex-col gap-0.5 whitespace-nowrap'
                : 'flex items-center gap-2 whitespace-nowrap'
            }
          >
            <span>{schedule.date}</span>
            {schedule.time && view !== 'history' && (
              <span className="text-xs text-muted-foreground">{schedule.time}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'status',
      header:
        headerFilters?.status ??
        (view === 'history' ? 'Outcome' : view === 'incoming' ? 'Status' : 'Delivery Status'),
      className: view === 'incoming' || headerFilters?.status ? undefined : 'hidden sm:table-cell',
      headerClassName:
        view === 'incoming' || headerFilters?.status ? undefined : 'hidden sm:table-cell',
      accessorKey: 'status',
      sortable: false,
      cell: ({ row }) =>
        view === 'incoming' && row.status === 'DRAFT' && row.purchaseOrderStatus === 'RECEIVED' ? (
          <StatusBadge label="Inactive draft" />
        ) : row.type === 'Incoming' ? (
          <IncomingDeliveryStatusBadge status={row.record.status} />
        ) : (
          <DeliveryStatusBadge status={row.record.status} runId={row.record.runId} />
        ),
    },
    ...(view === 'incoming'
      ? [
          {
            id: 'issue',
            header: 'Issue',
            sortable: false,
            cell: ({ row }: { row: DeliveryRow }) => {
              const issue =
                row.status === 'DRAFT'
                  ? (row.schedulingIssue ?? incomingOrderSchedulingIssue(row.purchaseOrderStatus))
                  : null
              return issue ? (
                <StatusBadge
                  label={
                    row.purchaseOrderStatus === 'RECEIVED' ? 'PO already received' : 'Needs review'
                  }
                  tone="warning"
                  appearance="emphasis"
                  showDot={false}
                  className="whitespace-nowrap"
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            },
          },
        ]
      : []),
    {
      id: 'actions',
      header: view === 'history' ? 'Details' : view === 'incoming' ? 'Actions' : 'Next Action',
      align: 'right',
      cell: ({ row }) => {
        const available = canManage && view !== 'history' ? getDeliveryActions(row) : []
        const primary = available.find((action) =>
          ['schedule', 'ready', 'receive', 'run', 'reconcile'].includes(action),
        )
        const showDetailsAction =
          view === 'incoming' &&
          !primary &&
          row.status === 'DRAFT' &&
          row.purchaseOrderStatus === 'RECEIVED'
        const label =
          primary === 'run' && row.type === 'Outgoing' && row.record.runId != null
            ? 'View Trip'
            : primary
              ? actions[primary].label
              : view === 'history' && row.type === 'Incoming' && row.status === 'COMPLETED'
                ? 'View Receipt'
                : 'View Details'
        return (
          <DataTableActions>
            {(view !== 'incoming' || primary || showDetailsAction) && (
              <Button
                variant={primary ? 'outline' : 'ghost'}
                size="sm"
                disabled={pending}
                onClick={() => (primary ? onAction(row, primary) : onView(row))}
                aria-label={`${label} ${row.reference}`}
              >
                {label}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 pointer-coarse:size-11"
                  aria-label={`More actions for ${row.reference}`}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {!showDetailsAction && (
                    <DropdownMenuItem onSelect={() => onView(row)}>
                      View delivery details
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onViewOrder(row)}>
                    {row.type === 'Incoming' ? 'View Purchase Order' : 'View order'}{' '}
                    {row.relatedOrder}
                  </DropdownMenuItem>
                  {available
                    .filter((action) => action !== primary)
                    .map((action) => {
                      const { label, Icon } = actions[action]
                      return (
                        <DropdownMenuItem
                          key={action}
                          className={
                            action === 'cancel' ? 'text-destructive focus:text-destructive' : ''
                          }
                          disabled={pending}
                          aria-label={`${label} ${row.reference}`}
                          onSelect={() => onAction(row, action)}
                        >
                          <Icon aria-hidden="true" />
                          {label}
                        </DropdownMenuItem>
                      )
                    })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </DataTableActions>
        )
      },
    },
  ]
  return (
    <DataTable
      pagination={false}
      className={className}
      manualSorting
      appearance="management"
      data={rows}
      columns={columns}
      getRowKey={(row) => row.key}
      isLoading={isLoading}
      retainHeaders
      tableClassName={view === 'incoming' ? 'w-full min-w-[1000px]' : 'w-full'}
      rowClassName={
        view === 'incoming'
          ? (row) =>
              row.status === 'DRAFT' && row.purchaseOrderStatus === 'RECEIVED' ? 'bg-muted/30' : ''
          : undefined
      }
      emptyContent={
        <div className="py-2 text-center">
          <p className="text-sm font-semibold">
            {view === 'outgoing'
              ? hasFilters
                ? 'No deliveries match the current filters.'
                : 'No outgoing deliveries yet.'
              : `No ${view === 'history' ? 'delivery history' : `${view} deliveries`} found`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view === 'history'
              ? 'Completed and cancelled deliveries appear here.'
              : 'Adjust the filters or arrange a delivery for a confirmed order.'}
          </p>
        </div>
      }
    />
  )
}
