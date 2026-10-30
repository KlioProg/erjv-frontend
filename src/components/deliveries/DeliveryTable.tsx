import { CalendarCheck, Check, Eye, PackageCheck, Send, X } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { Button } from '@/components/ui/button'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { IncomingDeliveryStatusBadge } from './shared/IncomingDeliveryDetailModal'
import {
  formatDeliverySchedule,
  getDeliveryActions,
  type DeliveryAction,
  type DeliveryRow,
  type DeliveryView,
} from '@/features/logistics/delivery-workflow'

const actions = {
  schedule: { label: 'Schedule', Icon: CalendarCheck },
  ready: { label: 'Plan / Mark Ready', Icon: Check },
  reopen: { label: 'Reopen Draft', Icon: CalendarCheck },
  run: { label: 'Manage Run', Icon: Send },
  receive: { label: 'Receive Goods', Icon: PackageCheck },
  reconcile: { label: 'Reconcile Delivery', Icon: Check },
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
}) {
  const columns: ColumnDef<DeliveryRow>[] = [
    {
      id: 'reference',
      header: 'Delivery #',
      accessorKey: 'reference',
      sortable: true,
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto min-h-8 justify-start p-0 text-sm font-medium pointer-coarse:min-h-11"
          onClick={() => onView(row)}
          aria-label={`View delivery ${row.reference}`}
        >
          {row.reference}
        </Button>
      ),
    },
    {
      id: 'order',
      header: 'Related Order',
      accessorKey: 'relatedOrder',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 py-1">
          <span className="font-medium">{row.relatedOrder}</span>
          <span className="text-xs text-muted-foreground">{row.warehouse}</span>
        </div>
      ),
    },
    {
      id: 'party',
      header:
        view === 'incoming' ? 'Supplier' : view === 'outgoing' ? 'Customer' : 'Customer / Supplier',
      accessorKey: 'party',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 py-1">
          <span>{row.party}</span>
          {row.type === 'Outgoing' && (
            <span className="text-xs text-muted-foreground">
              {row.vehicle}
              {row.driver !== '—' ? ` · ${row.driver}` : ''}
            </span>
          )}
        </div>
      ),
    },
    ...(view === 'history'
      ? [{ id: 'type', header: 'Direction', accessorKey: 'type' as const, sortable: true }]
      : []),
    {
      id: 'date',
      header: 'Schedule',
      sortable: true,
      sortKey: (row) => (row.date ? new Date(row.date).getTime() || 0 : 0),
      cell: ({ row }) => {
        const schedule = formatDeliverySchedule(
          row.date,
          view === 'history',
          row.type === 'Incoming' && !!row.record.scheduledAt,
        )
        return (
          <div title={schedule.title} className="flex flex-col gap-1 whitespace-nowrap py-1">
            <span>{schedule.date}</span>
            <span className="text-xs text-muted-foreground">{schedule.time}</span>
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: ({ row }) =>
        row.type === 'Incoming' ? (
          <IncomingDeliveryStatusBadge status={row.record.status} />
        ) : (
          <DeliveryStatusBadge status={row.record.status} />
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ row }) => (
        <DataTableActions>
          {view === 'history' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 pointer-coarse:size-11"
              title={`View order ${row.relatedOrder}`}
              aria-label={`View order ${row.relatedOrder}`}
              onClick={() => onViewOrder(row)}
            >
              <Eye aria-hidden="true" />
            </Button>
          )}
          {canManage &&
            getDeliveryActions(row).map((action) => {
              const { label, Icon } = actions[action]
              return (
                <Button
                  key={action}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`size-8 shrink-0 pointer-coarse:size-11 ${action === 'cancel' ? 'text-destructive hover:text-destructive' : ''}`}
                  disabled={pending}
                  title={label}
                  aria-label={`${label} ${row.reference}`}
                  onClick={() => onAction(row, action)}
                >
                  <Icon aria-hidden="true" />
                </Button>
              )
            })}
        </DataTableActions>
      ),
    },
  ]
  return (
    <DataTable
      appearance="management"
      data={rows}
      columns={columns}
      getRowKey={(row) => row.key}
      isLoading={isLoading}
      tableClassName="min-w-[760px]"
      emptyContent={
        <div className="py-10 text-center">
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
