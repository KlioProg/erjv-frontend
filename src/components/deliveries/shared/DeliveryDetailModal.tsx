import { formatProductUnit } from '@/lib/product-unit'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { getDeliveryActions, type DeliveryAction } from '@/features/logistics/delivery-workflow'
import { MovementDetailFields, MovementDetailHeader } from './MovementDetailLayout'

export interface DeliveryDetailModalProps {
  deliveryId: number | null
  open: boolean
  onClose: () => void
  canManage?: boolean
  onNextAction?: (deliveryId: number, action: DeliveryAction) => void
  onViewOrder?: (salesOrderId: number) => void
  onViewTrip?: (runId: number) => void
}

const nextActionLabels: Partial<Record<DeliveryAction, string>> = {
  ready: 'Edit Delivery',
  run: 'Add to Trip',
  reconcile: 'Record Results',
}

export function DeliveryDetailModal({
  deliveryId,
  open,
  onClose,
  canManage = false,
  onNextAction,
  onViewOrder,
  onViewTrip,
}: DeliveryDetailModalProps) {
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
      width: delivery?.status === 'RECONCILED' ? undefined : '70%',
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
              {formatProductUnit(product?.unit, 'Unit unavailable')}
            </p>
          </div>
        )
      },
    },
    {
      id: 'quantity',
      header: 'Loaded Quantity',
      width: delivery?.status === 'RECONCILED' ? undefined : '30%',
      align: 'right',
      cell: ({ row }) => (
        <p className="text-sm font-normal tabular-nums [overflow-wrap:anywhere]">
          {row.loadedQuantity ?? row.quantity}
        </p>
      ),
    },
    ...(delivery?.status === 'RECONCILED' ? ([
      ['deliveredQuantity', 'Delivered'],
      ['returnedSellableQuantity', 'Returned in Good Condition'],
      ['returnedDamagedQuantity', 'Returned Damaged'],
      ['missingQuantity', 'Missing'],
    ] as const).map(([field, header]): ColumnDef<OutgoingDeliveryItemRecord> => ({
      id: field, header, align: 'right', cell: ({ row }) => row[field] ?? 'Not recorded',
    })) : []),
  ]
  const nextAction = delivery && onNextAction
    ? getDeliveryActions({
        type: 'Outgoing',
        status: delivery.status,
        runId: delivery.runId,
        record: delivery,
      }).find(
        (action) =>
          action in nextActionLabels &&
          (canManage || (action === 'run' && delivery.runId != null)),
      )
    : undefined
  const nextActionLabel = nextAction
    ? nextAction === 'run' && delivery?.runId != null
      ? 'View Trip'
      : nextActionLabels[nextAction]
    : undefined
  const tripReference = delivery?.runId
    ? run?.runNumber ?? `Trip #${delivery.runId}`
    : null
  const detailFields = delivery
    ? [
        {
          label: 'Source warehouse',
          value: sourceWarehouseNames.join(', ') || 'Source warehouse unavailable',
        },
        {
          label: 'Destination',
          value: (
            <div className="flex flex-col gap-0.5">
              <span>
                {client?.name ||
                  (order
                    ? `Customer #${order.clientId}`
                    : ordersQuery.isLoading
                      ? 'Loading customer details...'
                      : 'Customer details unavailable')}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {order?.deliveryAddress || 'Delivery address unavailable'}
              </span>
            </div>
          ),
        },
        {
          label: 'Sales order',
          value: onViewOrder ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 font-medium"
              aria-label={`View sales order ${order?.orderNumber ?? `#${delivery.salesOrderId}`}`}
              onClick={() => onViewOrder(delivery.salesOrderId)}
            >
              {order?.orderNumber ?? `SO #${delivery.salesOrderId}`}
            </Button>
          ) : order?.orderNumber ?? `SO #${delivery.salesOrderId}`,
        },
        {
          label: 'Delivery trip',
          value: tripReference
            ? onViewTrip && nextAction !== 'run' ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  aria-label={`View delivery trip ${tripReference}`}
                  onClick={() => {
                    if (delivery.runId !== null) onViewTrip(delivery.runId)
                  }}
                >
                  {tripReference}
                </Button>
              ) : tripReference
            : 'Not assigned',
        },
        ...(delivery.runId
          ? [
              {
                label: 'Scheduled departure',
                value: run
                  ? DeliveryUtils.formatDateTime(run.scheduledDepartureAt)
                  : runQuery.isFetching
                    ? 'Loading trip details...'
                    : 'Trip details unavailable',
              },
              {
                label: 'Driver / logistics officer',
                value: driver
                  ? `${driver.firstName} ${driver.lastName}`
                  : run?.driverEmployeeId
                    ? `Employee #${run.driverEmployeeId}`
                    : run
                      ? 'Unassigned'
                      : 'Trip details unavailable',
                secondary: driver ? driver.phone || driver.email || 'No contact listed' : undefined,
              },
              {
                label: 'Vehicle',
                value: vehicle
                  ? `${vehicle.plateNumber} (${vehicle.vehicleType})`
                  : run?.deliveryVehicleId
                    ? `Vehicle #${run.deliveryVehicleId}`
                    : run
                      ? 'Unassigned'
                      : 'Trip details unavailable',
                secondary: vehicle
                  ? [
                      vehicle.model,
                      `Capacity: ${vehicle.capacityKg ? `${vehicle.capacityKg} kg` : 'Not recorded'}`,
                    ]
                      .filter(Boolean)
                      .join(' / ')
                  : undefined,
              },
            ]
          : []),
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11">
        <MovementDetailHeader
          title={delivery?.deliveryNumber || 'Delivery Details'}
          description="Outgoing delivery record"
          status={
            delivery && (
              <DeliveryStatusBadge
                status={delivery.status}
                runId={delivery.runId}
                className="mt-0.5 shrink-0"
                showDot={false}
              />
            )
          }
          className="px-5 py-5 pr-14 sm:pl-6"
        />

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

              <section aria-label="Movement details" className="border-t border-border pt-4">
                <MovementDetailFields fields={detailFields} />
              </section>

              <section
                aria-labelledby="delivery-cargo-heading"
                className="border-t border-border pt-4"
              >
                <h2 id="delivery-cargo-heading" className="mb-3 text-base font-semibold">
                  {delivery.status === 'RECONCILED' ? 'Delivery Results' : 'Cargo items'} ({delivery.items.length})
                </h2>
                <DataTable
                  data={delivery.items}
                  columns={columns}
                  getRowKey={(item) => item.id}
                  pagination={false}
                  appearance="subtle"
                  tableClassName={delivery.status === 'RECONCILED' ? 'min-w-[720px] w-full' : 'w-full table-fixed'}
                  emptyContent="No cargo items recorded."
                />
                {delivery.status === 'RECONCILED' && delivery.items.filter((item) => item.discrepancyReason).map((item) =>
                  <p key={item.id} className="mt-2 text-sm">{cargoProduct(item).product?.name ?? 'Product'}: {item.discrepancyReason}</p>,
                )}
              </section>

              <section aria-label="Delivery progress" className="border-t border-border pt-4">
                <p className="mb-3 text-xs text-muted-foreground">Times shown in Manila time (UTC+08:00).</p>
                <DeliveryTimeline delivery={delivery} run={run} />
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
          {nextAction && nextActionLabel && delivery && (
            <Button
              size="sm"
              className="pointer-coarse:min-h-11"
              aria-label={`${nextActionLabel} ${delivery.deliveryNumber}`}
              onClick={() => onNextAction?.(delivery.id, nextAction)}
            >
              {nextActionLabel}
            </Button>
          )}
          <Button variant="outline" size="sm" className="pointer-coarse:min-h-11" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
