import { useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Client } from '@/features/crm/clients.types'
import {
  getVehicleAssignments,
  getVehicleCondition,
  getVehicleAvailabilityStatus,
  VEHICLE_CONDITION_LABELS as CONDITIONS,
  VEHICLE_AVAILABILITY_LABELS as STATUS_LABELS,
} from '@/features/logistics/vehicle-assignment'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'

export function VehicleDetailModal({
  viewVehicle,
  deliveries,
  salesOrders,
  clients,
  open,
  onClose,
  onViewDelivery,
}: {
  viewVehicle?: DeliveryVehicle
  deliveries: OutgoingDeliveryRecord[]
  salesOrders: SalesOrderRecord[]
  clients: Client[]
  open: boolean
  onClose: () => void
  onViewDelivery: (id: number) => void
}) {
  const [historyStatus, setHistoryStatus] = useState('ALL')
  const allTrips = deliveries.filter((delivery) => delivery.deliveryVehicleId === viewVehicle?.id)
  const trips = allTrips.filter(
    (delivery) => historyStatus === 'ALL' || delivery.status === historyStatus,
  )
  return (
    <Dialog open={open && !!viewVehicle} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{viewVehicle?.plateNumber || 'Vehicle'}</DialogTitle>
          <DialogDescription>Vehicle details and delivery history.</DialogDescription>
        </DialogHeader>
        {viewVehicle && (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Model / Make', viewVehicle.model || '—'],
                ['Vehicle Type', viewVehicle.vehicleType],
                ['Capacity', viewVehicle.capacity ? `${viewVehicle.capacity} kg` : '—'],
                ['Condition', CONDITIONS[getVehicleCondition(viewVehicle)]],
                [
                  'Availability / Status',
                  STATUS_LABELS[getVehicleAvailabilityStatus(viewVehicle, deliveries)],
                ],
                [
                  'Current Assignment',
                  getVehicleAssignments(viewVehicle.id, deliveries)
                    .map((delivery) => delivery.deliveryNumber)
                    .join(', ') || '—',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              {[
                ['Trips', allTrips.length],
                ['Completed', allTrips.filter((trip) => trip.status === 'DELIVERED').length],
                ['In Transit', allTrips.filter((trip) => trip.status === 'DISPATCHED').length],
                ['Cancelled', allTrips.filter((trip) => trip.status === 'CANCELLED').length],
              ].map(([label, count]) => (
                <div key={label} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono font-semibold">{count}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Delivery History</h2>
              <Select value={historyStatus} onValueChange={setHistoryStatus}>
                <SelectTrigger aria-label="Vehicle history status" className="h-9 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All Deliveries</SelectItem>
                    {['DRAFT', 'SCHEDULED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {
                          DeliveryUtils.getStatusConfig(
                            value as Parameters<typeof DeliveryUtils.getStatusConfig>[0],
                          ).label
                        }
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <DataTable
              data={trips}
              getRowKey={(delivery) => delivery.id}
              tableClassName="min-w-[640px]"
              columns={[
                {
                  id: 'reference',
                  header: 'Reference',
                  accessorKey: 'deliveryNumber',
                  sortable: true,
                },
                {
                  id: 'order',
                  header: 'Related Order / Customer',
                  cell: ({ row }) => {
                    const order = salesOrders.find((order) => order.id === row.salesOrderId)
                    const client = clients.find((client) => client.id === order?.clientId)
                    return (
                      <div className="flex flex-col gap-1">
                        <span>{order?.orderNumber || `SO #${row.salesOrderId}`}</span>
                        <span className="text-muted-foreground">{client?.name || '—'}</span>
                      </div>
                    )
                  },
                },
                {
                  id: 'date',
                  header: 'Date',
                  cell: ({ row }) => DeliveryUtils.formatDateTime(row.scheduledAt),
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: ({ row }) => <DeliveryStatusBadge status={row.status} />,
                },
                {
                  id: 'view',
                  header: 'Actions',
                  cell: ({ row }) => (
                    <Button variant="ghost" size="sm" onClick={() => onViewDelivery(row.id)}>
                      View Delivery
                    </Button>
                  ),
                },
              ]}
              emptyContent={
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No deliveries match this vehicle and status.
                </p>
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
