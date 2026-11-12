import { formatContactPhone } from '@/lib/phone-utils'
import { useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { outgoingPreparationIssue } from '@/features/logistics/outgoing-issues'
import { DeliveryDetailFooter } from './DeliveryDetailFooter'
import { ProductTableLabel, ProductTableQuantity } from '@/components/common/ProductTableCells'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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
import type { OutgoingDeliveryItemRecord, OutgoingDeliveryPlanItemRecord } from '@/features/logistics/outgoing-deliveries.types'
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
  operationalFallback?: boolean
  onCancelDelivery?: () => void
  onReopenDraft?: () => void
}

export function DeliveryDetailModal({
  deliveryId,
  open,
  onClose,
  canManage = false,
  onNextAction,
  onViewOrder,
  onViewTrip,
  operationalFallback = false,
  onCancelDelivery,
  onReopenDraft,
}: DeliveryDetailModalProps) {
  const deliveryQuery = useOutgoingDeliveryById(deliveryId || undefined)
  const issueRef = useRef<HTMLDivElement>(null)
  const delivery = deliveryQuery.data
  const runQuery = useDeliveryRunById(delivery?.runId ?? undefined)
  const run = runQuery.data
  const warehousesQuery = useRecordsById<Warehouse>('/warehouses', [
    delivery?.warehouseId,
    ...(delivery?.items ?? []).map((item) => item.stockItem?.warehouseId),
  ])
  const vehiclesQuery = useRecordsById<DeliveryVehicle>('/delivery-vehicles', [
    run?.deliveryVehicleId,
  ])
  const employeesQuery = useRecordsById<Employee>('/employees', [run?.driverEmployeeId])
  const ordersQuery = useRecordsById<SalesOrderRecord>('/sales-orders', [delivery?.salesOrderId])
  const order = ordersQuery.data[0]
  const clientsQuery = useRecordsById<Client>('/clients', [order?.clientId])
  const productsQuery = useRecordsById<InventoryItemResponse>(
    '/inventory-items',
    (order?.items ?? []).map((item) => item.inventoryItemId),
  )
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

  const issue = delivery
    ? outgoingPreparationIssue(
        delivery,
        ordersQuery.isError ? undefined : order?.status,
        warehousesQuery.isError
          ? undefined
          : warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.isActive,
      )
    : null
  const issueIsBlocking = issue?.target === 'order' || issue?.target === 'refresh'
  const actionBlocked =
    deliveryQuery.isFetching ||
    deliveryQuery.isError ||
    ordersQuery.isError ||
    warehousesQuery.isError

  function cargoProduct(item: Pick<OutgoingDeliveryItemRecord, 'salesOrderItemId'>) {
    const orderItem = order?.items.find((line) => line.id === item.salesOrderItemId)
    return {
      orderItem,
      product: productsQuery.data?.find((product) => product.id === orderItem?.inventoryItemId),
    }
  }
  const sourceWarehouseNames = delivery?.warehouseId
    ? [
        warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ??
          `Warehouse #${delivery.warehouseId}`,
      ]
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

  const showsPlan = !!delivery && ['DRAFT', 'READY'].includes(delivery.status) && !delivery.items.length
  const displayedItems = showsPlan ? delivery.plannedItems : delivery?.items ?? []
  type DetailCargo = OutgoingDeliveryItemRecord | OutgoingDeliveryPlanItemRecord
  const columns: ColumnDef<DetailCargo>[] = [
    {
      id: 'product',
      header: showsPlan ? 'Product' : 'Item',
      width: delivery?.status === 'RECONCILED' ? undefined : '70%',
      cell: ({ row, index }) => {
        const { product, orderItem } = cargoProduct(row)
        return <ProductTableLabel product={product} fallback={orderItem ? `Product #${orderItem.inventoryItemId}` : `Product line #${index + 1}`} />
      },
    },
    {
      id: 'quantity',
      header: showsPlan ? 'Planned Quantity' : 'Loaded Quantity',
      width: delivery?.status === 'RECONCILED' ? undefined : '30%',
      align: 'right',
      cell: ({ row }) => <ProductTableQuantity value={'plannedQuantity' in row ? row.plannedQuantity : row.loadedQuantity ?? row.quantity} unit={cargoProduct(row).product?.unit} />,
    },
    ...(delivery?.status === 'RECONCILED' ? ([
      ['deliveredQuantity', 'Delivered'],
      ['returnedSellableQuantity', 'Returned in Good Condition'],
      ['returnedDamagedQuantity', 'Returned Damaged'],
      ['missingQuantity', 'Missing'],
    ] as const).map(([field, header]): ColumnDef<DetailCargo> => ({
      id: field, header, align: 'right', cell: ({ row }) => <ProductTableQuantity value={'stockItemId' in row ? row[field] : undefined} unit={cargoProduct(row).product?.unit} fallback="Not recorded" />,
    })) : []),
  ]
  const available = delivery && canManage && !deliveryQuery.isError ? getDeliveryActions({ type: 'Outgoing', status: delivery.status, record: delivery }) : []
  const tripReference = delivery?.runId ? (run?.runNumber ?? `Trip #${delivery.runId}`) : null
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
          ) : (
            (order?.orderNumber ?? `SO #${delivery.salesOrderId}`)
          ),
        },
        {
          label: 'Delivery trip',
          value: tripReference ? (
            onViewTrip ? (
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
            ) : (
              tripReference
            )
          ) : (
            'Not assigned'
          ),
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
                secondary: driver ? formatContactPhone(driver.phone) || driver.email || 'No contact listed' : undefined,
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
      <DialogContent
        onOpenAutoFocus={(event) => {
          if (issue) {
            event.preventDefault()
            issueRef.current?.focus()
          }
        }}
        className="flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11"
      >
        <MovementDetailHeader
          title={delivery?.deliveryNumber || 'Delivery Details'}
          description="Outgoing delivery record"
          status={
            delivery && (
              <DeliveryStatusBadge
                status={delivery.status}
                runId={delivery.runId}
                className="mt-0.5 shrink-0"
              />
            )
          }
          className="px-5 py-4 pr-14 sm:pl-6"
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
            <div className="flex flex-col gap-3">
              <DeliveryTimeline delivery={delivery} run={run} />
              {canManage && delivery.status === 'READY' && onReopenDraft && (
                <p className="text-xs text-muted-foreground">To correct this delivery's plan, <Button variant="link" size="sm" className="h-auto p-0" disabled={deliveryQuery.isFetching || deliveryQuery.isError} onClick={onReopenDraft}>Reopen Draft</Button>.</p>
              )}
              {delivery.status === 'READY' && canManage && onNextAction && delivery.runId == null && !issue && (
                <p className="text-xs text-muted-foreground">To change this saved plan, <Button variant="link" size="sm" className="h-auto p-0" disabled={actionBlocked} onClick={() => onNextAction(delivery.id, 'reopen')}>Reopen Draft</Button>.</p>
              )}
              {operationalFallback && canManage && onNextAction && !issue && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>This record is outside the current table. Continue here.</span>
                  {getDeliveryActions({ type: 'Outgoing', status: delivery.status, record: delivery }).filter((action) => ['ready', 'run', 'reconcile'].includes(action)).map((action) => (
                    <Button key={action} aria-label={`${action === 'ready' ? 'Edit Delivery' : action === 'reconcile' ? 'Record Results' : delivery.runId != null ? 'View Trip' : 'Add to Trip'} ${delivery.deliveryNumber}`} variant="outline" size="sm" disabled={actionBlocked} onClick={() => onNextAction(delivery.id, action)}>
                      {action === 'ready' ? 'Edit Delivery' : action === 'reconcile' ? 'Record Results' : delivery.runId != null ? 'View Trip' : 'Add to Trip'}
                    </Button>
                  ))}
                </div>
              )}
              {issue && (
                <Alert ref={issueRef} tabIndex={-1} aria-label="Delivery issue">
                  <AlertTitle>{issue.title}</AlertTitle>
                  <AlertDescription>
                    {issue.message}
                    {!canManage && (
                      <p>
                        Ask an administrator or manager to make corrections. Locked orders cannot be
                        edited.
                      </p>
                    )}
                    {canManage && onNextAction && !actionBlocked && issue.target === 'delivery' && (
                      delivery.status === 'DRAFT' ? <Button size="sm" variant="outline" onClick={() => onNextAction(delivery.id, 'ready')} aria-label={`Edit Delivery ${delivery.deliveryNumber}`}>Edit Delivery</Button>
                      : available.includes('reopen') ? <Button size="sm" variant="outline" onClick={() => onNextAction(delivery.id, 'reopen')}>Reopen Draft</Button> : null
                    )}
                    {issueIsBlocking && onViewOrder && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewOrder?.(delivery.salesOrderId)}
                      >
                        Review Sales Order
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="link"
                      disabled={deliveryQuery.isFetching}
                      onClick={() => {
                        void deliveryQuery.refetch()
                        void ordersQuery.refetch()
                        void warehousesQuery.refetch()
                      }}
                    >
                      Recheck Issue
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
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

              <section aria-label="Movement details" className="border-t border-border pt-3">
                <MovementDetailFields fields={detailFields} className="gap-y-2" />
              </section>

              <section
                aria-labelledby="delivery-cargo-heading"
                className="border-t border-border pt-3"
              >
                <h2 id="delivery-cargo-heading" className="mb-2 text-sm font-semibold">
                  {delivery.status === 'RECONCILED' ? 'Delivery Results' : showsPlan ? 'Planned Items' : 'Cargo items'} ({displayedItems.length})
                </h2>
                {showsPlan && <p className="mb-2 text-xs text-muted-foreground">Planned quantities. Loaded cargo is confirmed during trip departure preparation.</p>}
                <DataTable
                  density="compact"
                  data={displayedItems as DetailCargo[]}
                  columns={columns}
                  getRowKey={(item) => item.id}
                  pagination={false}
                  appearance="subtle"
                  tableClassName={delivery.status === 'RECONCILED' ? 'min-w-[720px] w-full' : 'w-full table-fixed'}
                  emptyContent="No cargo items recorded."
                />
                {delivery.status === 'RECONCILED' &&
                  delivery.items
                    .filter((item) => item.discrepancyReason)
                    .map((item) => (
                      <p key={item.id} className="mt-2 text-sm">
                        {cargoProduct(item).product?.name ?? 'Product'}: {item.discrepancyReason}
                      </p>
                    ))}
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
        <DeliveryDetailFooter onClose={onClose} busy={deliveryQuery.isFetching}
          onCancel={delivery && canManage && delivery.status === 'READY' && !deliveryQuery.isError && onCancelDelivery ? onCancelDelivery : delivery && onNextAction && available.includes('cancel')
            ? () => onNextAction(delivery.id, 'cancel') : undefined} />
      </DialogContent>
    </Dialog>
  )
}
