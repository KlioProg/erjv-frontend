import { incomingOrderSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import { OverflowValue } from '@/components/ui/OverflowValue'
import type { ReactNode } from 'react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
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

export function DeliveryTable({
  rows,
  view,
  isLoading,
  onView,
  onViewOrder,
  onViewTrip,
  onAction,
  canManage = false,
  busy = false,
  hasFilters = false,
  className,
  headerFilters,
}: {
  rows: DeliveryRow[]
  view: DeliveryView
  isLoading: boolean
  onView: (row: DeliveryRow) => void
  onViewOrder: (row: DeliveryRow) => void
  onViewTrip: (runId: number) => void
  onAction?: (row: DeliveryRow, action: DeliveryAction) => void
  canManage?: boolean
  busy?: boolean
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
          className="flex min-w-0 flex-col gap-0.5"
        >
          <OverflowValue value={row.relatedOrder} asChild>
            <Button
              variant="link"
              size="sm"
              className="h-auto max-w-48 justify-start p-0 font-medium"
              aria-label={`View ${row.type === 'Incoming' ? 'purchase' : 'sales'} order ${row.relatedOrder}`}
              onClick={() => onViewOrder(row)}
            >
              {row.relatedOrder}
            </Button>
          </OverflowValue>
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
            <Button
              variant="link"
              size="sm"
              onClick={() => row.record.runId != null && onViewTrip(row.record.runId)}
            >
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
      header: headerFilters?.status ?? (view === 'history' ? 'Outcome' : 'Delivery Status'),
      className: view === 'incoming' || headerFilters?.status ? undefined : 'hidden sm:table-cell',
      headerClassName:
        view === 'incoming' || headerFilters?.status ? undefined : 'hidden sm:table-cell',
      accessorKey: 'status',
      sortable: false,
      cell: ({ row }) =>
        row.type === 'Incoming' ? (
          <IncomingDeliveryStatusBadge status={row.record.status} />
        ) : (
          <DeliveryStatusBadge status={row.record.status} runId={row.record.runId} />
        ),
    },
    ...(view !== 'history' &&
    rows.some(
      (row) =>
        ['DRAFT', 'READY'].includes(row.status) &&
        (row.schedulingIssue ??
          (row.type === 'Incoming' ? incomingOrderSchedulingIssue(row.purchaseOrderStatus) : null)),
    )
      ? [
          {
            id: 'issue',
            header: 'Issue',
            sortable: false,
            cell: ({ row }: { row: DeliveryRow }) => {
              const issue =
                ['DRAFT', 'READY'].includes(row.status)
                  ? (row.schedulingIssue ??
                    (row.type === 'Incoming'
                      ? incomingOrderSchedulingIssue(row.purchaseOrderStatus)
                      : null))
                  : null
              return issue ? (
                <StatusBadge
                  label={
                    row.purchaseOrderStatus === 'RECEIVED' ? 'PO already received' : 'Needs review'
                  }
                  title={issue.message}
                  tone="warning"
                  className="whitespace-nowrap"
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            },
          },
        ]
      : []),
    ...(view !== 'history' ? [{
      id: 'next-action', header: 'Next Action', align: 'right' as const,
      cell: ({ row }: { row: DeliveryRow }) => {
        const issue = row.schedulingIssue ?? (row.type === 'Incoming' && row.status === 'DRAFT'
          ? incomingOrderSchedulingIssue(row.purchaseOrderStatus) : null)
        if (issue && !(row.type === 'Outgoing' && row.status === 'DRAFT' && issue.target === 'delivery')) return <Button variant="outline" size="sm" onClick={() => onView(row)}>Review Issue</Button>
        const actions = getDeliveryActions(row)
        const action = actions.find((candidate) => ['schedule', 'receive', 'ready', 'run', 'reconcile'].includes(candidate))
        if (!action || (!canManage && !(action === 'run' && row.type === 'Outgoing' && row.record.runId != null))) return <span className="text-muted-foreground">—</span>
        const label = action === 'schedule' ? 'Schedule Arrival' : action === 'receive' ? 'Receive Goods' : action === 'ready' ? 'Edit Delivery'
          : action === 'reconcile' ? 'Record Results' : row.type === 'Outgoing' && row.record.runId != null ? 'View Trip' : 'Add to Trip'
        return <Button variant="outline" size="sm" aria-label={`${label} ${row.reference}`} disabled={busy || !onAction} onClick={() => onAction?.(row, action)}>{label}</Button>
      },
    }] : []),
    ...(view === 'history'
      ? [
          {
            id: 'details',
            header: 'Details',
            align: 'right' as const,
            cell: ({ row }: { row: DeliveryRow }) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(row)}
                aria-label={`${row.type === 'Incoming' && row.status === 'COMPLETED' ? 'View Receipt' : 'View Details'} ${row.reference}`}
              >
                {row.type === 'Incoming' && row.status === 'COMPLETED'
                  ? 'View Receipt'
                  : 'View Details'}
              </Button>
            ),
          },
        ]
      : []),
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
      onRowClick={onView}
      isLoading={isLoading}
      retainHeaders
      tableClassName={view === 'incoming' ? 'w-full min-w-[880px]' : 'w-full'}
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
