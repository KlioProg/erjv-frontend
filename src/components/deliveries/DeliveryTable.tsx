import { OverflowValue } from '@/components/ui/OverflowValue'
import type { ReactNode } from 'react'
import { CalendarCheck, Check, MoreHorizontal, PackageCheck, Send, X } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
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
        <div className="min-w-0 max-w-44 whitespace-normal break-words sm:max-w-none">
          <Button
            variant="link"
            className="h-auto min-h-8 justify-start whitespace-normal break-words p-0 text-left text-sm font-medium pointer-coarse:min-h-11"
            onClick={() => onView(row)}
            aria-label={`View delivery ${row.reference}`}
          >
            {row.reference}
          </Button>
          <span className="block text-xs text-muted-foreground sm:hidden">
            {row.party} · {row.relatedOrder}
          </span>
          <span className="block text-xs text-muted-foreground sm:hidden">
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
          ? 'Purchase Order / Warehouse'
          : view === 'outgoing'
            ? 'Sales Order / Warehouse'
            : 'Related Order'),
      className: headerFilters?.order ? undefined : 'hidden lg:table-cell',
      headerClassName: headerFilters?.order ? undefined : 'hidden lg:table-cell',
      accessorKey: 'relatedOrder',
      sortable: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <span className="font-medium">{row.relatedOrder}</span>
          <OverflowValue value={row.warehouse} className="max-w-48 text-xs text-muted-foreground" />
        </div>
      ),
    },
    {
      id: 'party',
      header:
        view === 'incoming' ? 'Supplier' : view === 'outgoing' ? 'Customer' : 'Customer / Supplier',
      accessorKey: 'party',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      sortable: false,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span>{row.party}</span>
        </div>
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
            ? 'Scheduled / Expected Date'
            : 'Delivery Trip'),
      className: headerFilters?.date ? undefined : 'hidden lg:table-cell',
      headerClassName: headerFilters?.date ? undefined : 'hidden lg:table-cell',
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
          <div title={schedule.title} className="flex items-center gap-2 whitespace-nowrap">
            <span>{schedule.date}</span>
            <span className="text-xs text-muted-foreground">
              {view === 'history' ? '' : schedule.time}
            </span>
          </div>
        )
      },
    },
    {
      id: 'status',
      header: headerFilters?.status ?? (view === 'history' ? 'Outcome' : 'Delivery Status'),
      className: headerFilters?.status ? undefined : 'hidden sm:table-cell',
      headerClassName: headerFilters?.status ? undefined : 'hidden sm:table-cell',
      accessorKey: 'status',
      sortable: false,
      cell: ({ row }) =>
        row.type === 'Incoming' ? (
          <IncomingDeliveryStatusBadge status={row.record.status} />
        ) : (
          <DeliveryStatusBadge status={row.record.status} runId={row.record.runId} />
        ),
    },
    {
      id: 'actions',
      header: view === 'history' ? 'Details' : 'Next Action',
      align: 'right',
      cell: ({ row }) => {
        const available = canManage && view !== 'history' ? getDeliveryActions(row) : []
        const primary = available.find((action) =>
          ['schedule', 'ready', 'receive', 'run', 'reconcile'].includes(action),
        )
        const label =
          primary === 'run' && row.type === 'Outgoing' && row.record.runId != null
            ? 'View Trip'
            : primary
              ? actions[primary].label
              : view === 'history' &&
                  row.type === 'Incoming' &&
                  row.status === 'COMPLETED'
                ? 'View Receipt'
                : 'View Details'
        return (
          <DataTableActions>
            <Button
              variant={primary ? 'outline' : 'ghost'}
              size="sm"
              disabled={pending}
              onClick={() => (primary ? onAction(row, primary) : onView(row))}
              aria-label={`${label} ${row.reference}`}
            >
              {label}
            </Button>
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
                  <DropdownMenuItem onSelect={() => onView(row)}>
                    View delivery details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onViewOrder(row)}>
                    View order {row.relatedOrder}
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
      tableClassName="w-full"
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
