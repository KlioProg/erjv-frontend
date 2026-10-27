import { useRef, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import {
  useDispatchOutgoingDelivery,
  useOutgoingDeliveryById,
  useOutgoingDeliveries,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders, useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import {
  availableStockCents,
  parseStockCents,
  formatStockCents,
} from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { useAllProducts } from '@/features/products/products.hooks'

interface DispatchDeliveryModalProps {
  delivery: OutgoingDeliveryRecord | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function DispatchDeliveryModal({
  delivery: initialDelivery,
  open,
  onClose,
  onSuccess,
}: DispatchDeliveryModalProps) {
  const latest = useOutgoingDeliveryById(open ? initialDelivery?.id : undefined)
  const delivery = latest.data ?? initialDelivery
  const currentOrder = useSalesOrderById(open ? delivery?.salesOrderId : undefined)
  const stocks = useStockItems()
  const products = useAllProducts()
  const [loaded, setLoaded] = useState<Record<number, string>>({})
  const inFlight = useRef(false)
  const vehiclesQuery = useDeliveryVehicles()
  const { data: vehicles = [] } = vehiclesQuery
  const deliveriesQuery = useOutgoingDeliveries()
  const { data: deliveries = [] } = deliveriesQuery
  const employeesQuery = useEmployees({ includeInactive: 'false' })
  const { data: employees = [] } = employeesQuery
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: warehouses = [] } = useWarehouses()
  const dispatchMutation = useDispatchOutgoingDelivery()

  const order =
    currentOrder.data ?? (delivery ? salesOrders.find((o) => o.id === delivery.salesOrderId) : null)
  const client = order ? clients.find((c) => c.id === order.clientId) : null
  const originWarehouses = delivery?.warehouseId
    ? [warehouses.find((w) => w.id === delivery.warehouseId)?.name ?? 'Warehouse unavailable']
    : []
  const rows = (delivery?.plannedItems ?? []).map((plan) => {
    const line = order?.items.find((item) => item.id === plan.salesOrderItemId)
    const stock = stocks.data?.find(
      (stock) =>
        stock.inventoryItemId === line?.inventoryItemId &&
        stock.warehouseId === delivery?.warehouseId,
    )
    const planned = parseStockCents(plan.plannedQuantity)
    const available = stock ? availableStockCents(stock) : null
    const ordered = parseStockCents(line?.quantity)
    const otherLines = deliveries
      .filter((d) => d.id !== delivery?.id && d.status !== 'CANCELLED')
      .flatMap((d) => d.items.map((item) => ({ item, status: d.status })))
      .filter(
        ({ item, status }) =>
          item.salesOrderItemId === plan.salesOrderItemId &&
          (['DISPATCHED', 'DELIVERED'].includes(status) || item.legacyAllocation),
      )
    const committed = otherLines.map(({ item, status }) =>
      parseStockCents(
        status === 'DELIVERED'
          ? (item.deliveredQuantity ?? '0')
          : (item.loadedQuantity ?? item.quantity),
      ),
    )
    const remaining =
      ordered === null || committed.some((q) => q === null)
        ? null
        : ordered - committed.reduce<bigint>((sum, q) => sum + (q ?? 0n), 0n)
    const maximum =
      planned === null || available === null || remaining === null
        ? null
        : [planned, available, remaining].reduce((a, b) => (a < b ? a : b))
    return {
      id: plan.salesOrderItemId,
      planId: plan.id,
      stock,
      product: products.data?.find((product) => product.id === line?.inventoryItemId),
      available,
      planned: plan.plannedQuantity,
      maximum,
      quantity: loaded[plan.salesOrderItemId] ?? '',
    }
  })
  const unavailable =
    deliveriesQuery.isFetching ||
    deliveriesQuery.isError ||
    latest.isFetching ||
    latest.isError ||
    !latest.data ||
    currentOrder.isFetching ||
    currentOrder.isError ||
    !currentOrder.data ||
    stocks.isFetching ||
    stocks.isError ||
    products.isFetching ||
    products.isError ||
    vehiclesQuery.isFetching ||
    vehiclesQuery.isError ||
    employeesQuery.isFetching ||
    employeesQuery.isError ||
    rows.some((row) => !row.product?.name || !row.product.unit)

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() =>
    delivery?.deliveryVehicleId ? String(delivery.deliveryVehicleId) : '',
  )
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() =>
    delivery?.driverEmployeeId ? String(delivery.driverEmployeeId) : '',
  )
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [prevDeliveryId, setPrevDeliveryId] = useState<number | null>(delivery?.id ?? null)

  // Sync state during render when selected delivery changes
  if (delivery && delivery.id !== prevDeliveryId) {
    setPrevDeliveryId(delivery.id)
    setSelectedVehicleId(delivery.deliveryVehicleId ? String(delivery.deliveryVehicleId) : '')
    setSelectedDriverId(delivery.driverEmployeeId ? String(delivery.driverEmployeeId) : '')
    setErrorMessage('')
    setLoaded({})
  }

  const quantityError = (row: (typeof rows)[number]) => {
    if (!row.quantity.trim()) return ''
    const quantity = parseStockCents(row.quantity)
    if (quantity === null) return 'Use a nonnegative quantity with up to two decimals.'
    if (row.maximum === null || quantity > row.maximum)
      return `Loading limit: ${formatStockCents(row.maximum)} ${row.product?.unit ?? ''}. Review availability and the remaining order quantity.`
    return ''
  }
  const validQuantities =
    rows.length > 0 &&
    rows.some((row) => (parseStockCents(row.quantity) ?? 0n) > 0n) &&
    rows.every((row) => !quantityError(row))
  const assignmentAvailable =
    vehicles.some(
      (vehicle) =>
        String(vehicle.id) === selectedVehicleId &&
        DeliveryUtils.getVehicleAvailability(vehicle, deliveries, delivery?.id).isAvailable,
    ) &&
    employees.some(
      (employee) =>
        String(employee.id) === selectedDriverId &&
        DeliveryUtils.getDriverAvailability(employee, deliveries, delivery?.id).isAvailable,
    )

  const usePlannedQuantities = () => {
    const usedStock = new Map<number, bigint>()
    for (const row of rows) {
      const planned = parseStockCents(row.planned)
      const total = (usedStock.get(row.stock?.id ?? 0) ?? 0n) + (planned ?? 0n)
      if (
        planned === null ||
        row.maximum === null ||
        planned > row.maximum ||
        !row.stock ||
        total > (row.available ?? 0n)
      ) {
        setErrorMessage(
          `${row.product?.name ?? 'Product'}: planned quantities exceed the current loading limit or are unavailable. Review the quantities physically loaded and enter them individually.`,
        )
        return
      }
      usedStock.set(row.stock.id, total)
    }
    setLoaded(Object.fromEntries(rows.map((row) => [row.id, row.planned])))
    setErrorMessage('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (dispatchMutation.isPending || inFlight.current || unavailable) return
    setErrorMessage('')

    if (!delivery || delivery.status !== 'SCHEDULED') {
      setErrorMessage('Only a scheduled delivery can be dispatched.')
      return
    }

    const vehicleIdNum = parseInt(selectedVehicleId, 10)
    const driverIdNum = parseInt(selectedDriverId, 10)

    if (isNaN(vehicleIdNum) || vehicleIdNum <= 0) {
      setErrorMessage('Please assign an available delivery vehicle for transit.')
      return
    }

    if (isNaN(driverIdNum) || driverIdNum <= 0) {
      setErrorMessage('Please assign an active driver or logistics officer.')
      return
    }

    const vehicle = vehicles.find((vehicle) => vehicle.id === vehicleIdNum)
    if (
      !vehicle ||
      !DeliveryUtils.getVehicleAvailability(vehicle, deliveries, delivery.id).isAvailable
    ) {
      setErrorMessage('This vehicle is no longer available. Choose another vehicle.')
      return
    }
    const driver = employees.find((employee) => employee.id === driverIdNum)
    if (
      !driver ||
      !DeliveryUtils.getDriverAvailability(driver, deliveries, delivery.id).isAvailable
    ) {
      setErrorMessage('This driver is no longer available. Choose another driver.')
      return
    }

    try {
      if (!rows.length || new Set(rows.map((row) => row.id)).size !== rows.length)
        throw Error('Current scheduled plan is empty or duplicated.')
      const usedStock = new Map<number, bigint>()
      const items = rows.flatMap((row) => {
        const quantity = parseStockCents(row.quantity || '0')
        if (quantity === null)
          throw Error('Use nonnegative loaded quantities with up to two decimals.')
        if (quantity === 0n) return []
        if (
          row.maximum === null ||
          quantity > row.maximum ||
          !row.stock ||
          !Number.isSafeInteger(row.id) ||
          row.id <= 0
        )
          throw Error(
            'Confirm valid loaded quantities within the planned amount, order balance, and warehouse availability.',
          )
        const total = (usedStock.get(row.stock.id) ?? 0n) + quantity
        if (total > (availableStockCents(row.stock) ?? 0n))
          throw Error('Combined loaded quantities exceed stock availability.')
        usedStock.set(row.stock.id, total)
        return [
          {
            salesOrderItemId: row.id,
            stockItemId: row.stock.id,
            loadedQuantity: decimalString(quantity),
          },
        ]
      })
      if (!items.length) throw Error('Confirm at least one actual loaded item.')
      inFlight.current = true
      await dispatchMutation.mutateAsync({
        id: delivery.id,
        payload: {
          deliveryVehicleId: vehicleIdNum,
          driverEmployeeId: driverIdNum,
          items,
        },
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !dispatchMutation.isPending && onClose()}
    >
      <DialogContent
        closeDisabled={dispatchMutation.isPending}
        className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 px-6 pr-14 pt-6">
          <DialogTitle>Dispatch Delivery</DialogTitle>
          <DialogDescription>
            {delivery?.deliveryNumber} ·{' '}
            {delivery ? DeliveryUtils.getStatusConfig(delivery.status).label : 'Loading'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd>{client?.name || 'Customer unavailable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source warehouse</dt>
                <dd>{originWarehouses.join(', ') || 'Warehouse unavailable'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Destination</dt>
                <dd className="break-words">
                  {order?.deliveryAddress || 'Destination unavailable'}
                </dd>
              </div>
            </dl>
            <section
              className="flex min-w-0 flex-col gap-3"
              aria-labelledby="dispatch-loading-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="dispatch-loading-heading" className="text-sm font-medium">
                  Product loading
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    unavailable ||
                    dispatchMutation.isPending ||
                    !rows.length ||
                    delivery?.status !== 'SCHEDULED'
                  }
                  onClick={usePlannedQuantities}
                >
                  Use Planned Quantities
                </Button>
              </div>
              <DataTable
                data={rows}
                pagination={false}
                getRowKey={(row) => row.planId}
                className="min-w-0"
                tableClassName="max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-2 max-sm:[&_td]:block max-sm:[&_td]:min-w-0"
                columns={[
                  {
                    id: 'product',
                    header: 'Product',
                    className: 'max-sm:col-span-2 whitespace-normal',
                    cell: ({ row }) => (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium [overflow-wrap:anywhere]">
                          {row.product?.name ||
                            (products.isFetching ? 'Loading product...' : 'Product unavailable')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            row.stock?.warehouse?.name || originWarehouses[0],
                            row.product?.variety,
                            row.product?.unit,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'planned',
                    header: 'Planned',
                    cell: ({ row }) => (
                      <>
                        <span className="mb-1 block text-muted-foreground sm:hidden">Planned</span>
                        {formatStockCents(parseStockCents(row.planned))}
                      </>
                    ),
                  },
                  {
                    id: 'available',
                    header: 'Available',
                    cell: ({ row }) => (
                      <>
                        <span className="mb-1 block text-muted-foreground sm:hidden">
                          Available
                        </span>
                        {formatStockCents(row.available)}
                      </>
                    ),
                  },
                  {
                    id: 'loaded',
                    header: 'Quantity Loaded',
                    className: 'max-sm:col-span-2 sm:w-48',
                    cell: ({ row }) => (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`dispatch-loaded-${row.planId}`} className="sm:sr-only">
                          Quantity Loaded · {row.product?.name || 'Product unavailable'}
                        </Label>
                        <Input
                          id={`dispatch-loaded-${row.planId}`}
                          inputMode="decimal"
                          aria-label={`Quantity Loaded for ${row.product?.name || 'unavailable product'}`}
                          aria-invalid={!!quantityError(row)}
                          aria-describedby={
                            quantityError(row) ? `dispatch-error-${row.id}` : undefined
                          }
                          value={row.quantity}
                          disabled={dispatchMutation.isPending || unavailable}
                          onChange={(event) =>
                            setLoaded((current) => ({ ...current, [row.id]: event.target.value }))
                          }
                        />
                        {quantityError(row) && (
                          <p id={`dispatch-error-${row.id}`} className="text-xs text-destructive">
                            {quantityError(row)}
                          </p>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Confirm the quantities physically loaded. Partial loading is allowed; leave unloaded
                products blank or enter zero.
              </p>
            </section>
            {unavailable && (
              <Alert
                variant={
                  latest.isError ||
                  currentOrder.isError ||
                  stocks.isError ||
                  products.isError ||
                  deliveriesQuery.isError ||
                  vehiclesQuery.isError ||
                  employeesQuery.isError
                    ? 'destructive'
                    : 'default'
                }
              >
                <AlertDescription>
                  {latest.isFetching ||
                  currentOrder.isFetching ||
                  stocks.isFetching ||
                  products.isFetching ||
                  deliveriesQuery.isFetching ||
                  vehiclesQuery.isFetching ||
                  employeesQuery.isFetching
                    ? 'Loading current delivery, products, stock, and assignments...'
                    : 'Current delivery, product details, stock, or assignments are unavailable. Close and retry.'}
                </AlertDescription>
              </Alert>
            )}
            {delivery && delivery.status !== 'SCHEDULED' && (
              <Alert variant="destructive">
                <AlertDescription>
                  This delivery is no longer scheduled. Close and review its current status.
                </AlertDescription>
              </Alert>
            )}
            <fieldset
              disabled={dispatchMutation.isPending || unavailable}
              className="grid min-w-0 gap-4 sm:max-w-[560px] sm:grid-cols-2"
            >
              <legend className="sr-only">Vehicle and driver</legend>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dispatch-vehicle">Vehicle</Label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                  <SelectTrigger
                    id="dispatch-vehicle"
                    className="h-10 min-w-0 text-left pointer-coarse:min-h-10 [&_[data-assignment-status]]:hidden"
                  >
                    <SelectValue className="min-w-0" placeholder="Choose vehicle" />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[role=option]>span:last-child]:min-w-0">
                    {vehicles.length === 0 && (
                      <SelectItem value="none" disabled>
                        No vehicles available
                      </SelectItem>
                    )}
                    {vehicles.map((vehicle) => {
                      const availability = DeliveryUtils.getVehicleAvailability(
                        vehicle,
                        deliveries,
                        delivery?.id,
                      )
                      return (
                        <SelectItem
                          key={vehicle.id}
                          value={String(vehicle.id)}
                          disabled={!availability.isAvailable}
                        >
                          <span className="flex min-w-0 flex-col text-left">
                            <span
                              className="truncate"
                              title={[vehicle.plateNumber, vehicle.model || vehicle.vehicleType]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              {[vehicle.plateNumber, vehicle.model || vehicle.vehicleType]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            <span data-assignment-status className="text-xs text-muted-foreground">
                              {availability.isAvailable ? 'Available' : availability.reason}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dispatch-driver">Driver</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger
                    id="dispatch-driver"
                    className="h-10 min-w-0 text-left pointer-coarse:min-h-10 [&_[data-assignment-status]]:hidden"
                  >
                    <SelectValue className="min-w-0" placeholder="Choose driver" />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[role=option]>span:last-child]:min-w-0">
                    {employees.length === 0 && (
                      <SelectItem value="none" disabled>
                        No drivers available
                      </SelectItem>
                    )}
                    {employees.map((employee) => {
                      const availability = DeliveryUtils.getDriverAvailability(
                        employee,
                        deliveries,
                        delivery?.id,
                      )
                      return (
                        <SelectItem
                          key={employee.id}
                          value={String(employee.id)}
                          disabled={!availability.isAvailable}
                        >
                          <span className="flex min-w-0 flex-col text-left">
                            <span
                              className="truncate"
                              title={`${employee.firstName} ${employee.lastName}`}
                            >
                              {employee.firstName} {employee.lastName}
                            </span>
                            <span data-assignment-status className="text-xs text-muted-foreground">
                              {availability.isAvailable ? 'Available' : availability.reason}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">
              Confirm Dispatch sends this delivery into transit. Stock reservation and vehicle
              assignment are updated by the system.
            </p>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={dispatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                dispatchMutation.isPending ||
                unavailable ||
                !validQuantities ||
                !assignmentAvailable ||
                delivery?.status !== 'SCHEDULED'
              }
            >
              {dispatchMutation.isPending ? 'Dispatching...' : 'Confirm Dispatch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
