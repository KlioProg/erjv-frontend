import { formatProductUnit } from '@/lib/product-unit'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useDeliveryRunById } from '@/features/logistics/delivery-runs.hooks'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useRecordsById } from '@/lib/use-records-by-id'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { OutgoingDeliveryItemRecord } from '@/features/logistics/outgoing-deliveries.types'
import { getErrorMessage } from '@/lib/api-client'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { DeliveryTimeline } from './DeliveryTimeline'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface DeliveryDetailModalProps {
  deliveryId: number | null
  open: boolean
  onClose: () => void
}

export function DeliveryDetailModal({ deliveryId, open, onClose }: DeliveryDetailModalProps) {
  const deliveryQuery = useOutgoingDeliveryById(deliveryId || undefined)
  const delivery = deliveryQuery.data
  const runQuery = useDeliveryRunById(delivery?.runId ?? undefined)
  const run = runQuery.data
  const warehousesQuery = useRecordsById<Warehouse>('/warehouses', [delivery?.warehouseId, ...(delivery?.items ?? []).map(item => item.stockItem?.warehouseId)])
  const vehiclesQuery = useRecordsById<DeliveryVehicle>('/delivery-vehicles', [run?.deliveryVehicleId])
  const employeesQuery = useRecordsById<Employee>('/employees', [run?.driverEmployeeId])
  const ordersQuery = useRecordsById<SalesOrderRecord>('/sales-orders', [delivery?.salesOrderId])
  const order = ordersQuery.data[0]
  const clientsQuery = useRecordsById<Client>('/clients', [order?.clientId])
  const productsQuery = useRecordsById<InventoryItemResponse>('/inventory-items', (order?.items ?? []).map(item => item.inventoryItemId))
  const warehouses = warehousesQuery.data
  const vehicle = vehiclesQuery.data[0]
  const driver = employeesQuery.data[0]
  const client = clientsQuery.data[0]
  const referenceQueries = [
    warehousesQuery,
    vehiclesQuery,
    employeesQuery,
    ordersQuery,
    clientsQuery,
    productsQuery,
    ...(delivery?.runId ? [runQuery] : []),
  ]
  const referencesFailed = referenceQueries.some((query) => query.isError)

  function cargoProduct(item: OutgoingDeliveryItemRecord) {
    const orderItem = order?.items.find((line) => line.id === item.salesOrderItemId)
    return {
      orderItem,
      product: productsQuery.data?.find((product) => product.id === orderItem?.inventoryItemId),
    }
  }
  const sourceWarehouseNames = delivery?.warehouseId
    ? [warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ?? `Warehouse #${delivery.warehouseId}`]
    : [
    ...new Set(
      (delivery?.items ?? []).map((item) => {
        const id = item.stockItem?.warehouseId
        return id === undefined
          ? 'Warehouse unavailable'
          : (warehouses.find((candidate) => candidate.id === id)?.name ?? `Warehouse #${id}`)
      }),
    ),
  ]

  const columns: ColumnDef<OutgoingDeliveryItemRecord>[] = [
    {
      id: 'product',
      header: 'Item',
      width: '70%',
      cell: ({ row, index }) => {
        const { product, orderItem } = cargoProduct(row)
        return (
          <div className="flex min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]">
            <p className="text-sm font-medium text-foreground">
              {product?.name ||
                (orderItem
                  ? `Product #${orderItem.inventoryItemId}`
                  : `Product line #${index + 1}`)}
            </p>
            {product?.variety && <p className="text-xs text-muted-foreground">{product.variety}</p>}
            <p className="text-xs text-muted-foreground">
              Source:{' '}
              {row.stockItem?.warehouseId === undefined
                ? 'Warehouse unavailable'
                : warehouses.find(
                    (candidate) => candidate.id === row.stockItem?.warehouseId,
                  )?.name ?? `Warehouse #${row.stockItem.warehouseId}`}
            </p>
          </div>
        )
      },
    },
    {
      id: 'quantity',
      header: 'Loaded Quantity',
      width: '30%',
      align: 'right',
      cell: ({ row }) => (
        <div className="[overflow-wrap:anywhere]">
          <p className="text-sm font-normal tabular-nums">{row.loadedQuantity ?? row.quantity}</p>
          <p className="text-xs text-muted-foreground">
            {formatProductUnit(cargoProduct(row).product?.unit, 'Unit unavailable')}
          </p>
        </div>
      ),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11">
        <DialogHeader className="shrink-0 px-5 py-5 pr-14 text-left sm:pl-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold leading-6 [overflow-wrap:anywhere]">
                {delivery?.deliveryNumber || 'Delivery Details'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {delivery
                  ? `Sales Order ${order?.orderNumber || `#${delivery.salesOrderId}`}`
                  : 'Outgoing delivery record'}
              </DialogDescription>
            </div>
            {delivery && (
              <DeliveryStatusBadge
                status={delivery.status}
                className="mt-0.5 shrink-0"
                showDot={false}
              />
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {deliveryQuery.isLoading ? (
            <div
              role="status"
              className="flex min-h-64 items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <Spinner aria-hidden="true" className="size-5 text-primary-text" />
              Loading delivery details...
            </div>
          ) : deliveryQuery.isError || !delivery ? (
            <div
              role="alert"
              className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm"
            >
              <p className="font-medium text-destructive">Failed to load delivery record.</p>
              <p className="max-w-md text-xs text-muted-foreground">
                {deliveryQuery.error
                  ? getErrorMessage(deliveryQuery.error)
                  : 'The delivery record is unavailable.'}
              </p>
              {!!deliveryId && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deliveryQuery.isFetching}
                  onClick={() => void deliveryQuery.refetch()}
                >
                  Retry
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <section
                aria-label="Customer and order"
                className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]"
              >
                <h2 className="text-base font-semibold">
                  {client?.name ||
                    (order
                      ? `Customer #${order.clientId}`
                      : ordersQuery.isLoading
                        ? 'Loading customer details...'
                        : 'Customer details unavailable')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {order?.deliveryAddress || 'Delivery address unavailable'}
                </p>
              </section>

              {referencesFailed && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive"
                >
                  <p>Some linked details could not be loaded. Saved references remain visible.</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-[13px]"
                    onClick={() =>
                      referenceQueries.forEach((query) => {
                        if (query.isError) void query.refetch()
                      })
                    }
                  >
                    Retry linked details
                  </Button>
                </div>
              )}

              <section aria-label="Delivery progress" className="border-t border-border pt-4">
                <DeliveryTimeline delivery={delivery} run={run} />
              </section>

              <section
                aria-labelledby="delivery-details-heading"
                className="border-t border-border pt-4"
              >
                <h2 id="delivery-details-heading" className="mb-3 text-base font-semibold">
                  Delivery details
                </h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DeliveryDetailField
                    label="Source warehouses"
                    value={sourceWarehouseNames.join(', ') || 'No source records'}
                  />
                  <DeliveryDetailField
                    label="Run departure"
                    value={run ? DeliveryUtils.formatDateTime(run.scheduledDepartureAt) : delivery.runId ? (runQuery.isFetching ? 'Loading run...' : 'Run details unavailable') : 'No run assigned'}
                  />
                  <DeliveryDetailField
                    label="Driver / Logistics Officer"
                    value={
                      driver
                        ? `${driver.firstName} ${driver.lastName}`
                        : run?.driverEmployeeId
                          ? `Employee #${run?.driverEmployeeId}`
                          : delivery.runId && !run ? 'Run details unavailable' : 'Unassigned'
                    }
                    secondary={
                      driver ? driver.phone || driver.email || 'No contact listed' : undefined
                    }
                  />
                  <DeliveryDetailField
                    label="Vehicle"
                    value={
                      vehicle
                        ? `${vehicle.plateNumber} (${vehicle.vehicleType})`
                        : run?.deliveryVehicleId
                          ? `Vehicle #${run?.deliveryVehicleId}`
                          : delivery.runId && !run ? 'Run details unavailable' : 'Unassigned'
                    }
                    secondary={
                      vehicle
                        ? [vehicle.model, `Capacity: ${vehicle.capacityKg ? `${vehicle.capacityKg} kg` : 'Not recorded'}`]
                            .filter(Boolean)
                            .join(' / ')
                        : undefined
                    }
                  />
                </dl>
              </section>

              <section
                aria-labelledby="delivery-cargo-heading"
                className="border-t border-border pt-4"
              >
                <h2 id="delivery-cargo-heading" className="mb-3 text-base font-semibold">
                  Cargo items ({delivery.items.length})
                </h2>
                <DataTable
                  data={delivery.items}
                  columns={columns}
                  getRowKey={(item) => item.id}
                  pagination={false}
                  appearance="subtle"
                  tableClassName="w-full table-fixed"
                  emptyContent="No cargo items recorded."
                />
              </section>

              {delivery.notes && (
                <section aria-labelledby="delivery-notes-heading">
                  <h2
                    id="delivery-notes-heading"
                    className="mb-1 text-base font-semibold text-muted-foreground"
                  >
                    Delivery notes
                  </h2>
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                    {delivery.notes}
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-row justify-end border-t border-border px-5 py-3 sm:px-6">
          <Button variant="outline" size="sm" className="pointer-coarse:min-h-11" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeliveryDetailField({
  label,
  value,
  secondary,
}: {
  label: string
  value: ReactNode
  secondary?: string
}) {
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">
        {value}
        {secondary && (
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">{secondary}</p>
        )}
      </dd>
    </div>
  )
}
