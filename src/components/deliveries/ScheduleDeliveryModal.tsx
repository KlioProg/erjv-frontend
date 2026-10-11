import { useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { DeliveryFormDialog, DeliveryFormFooter } from './shared/DeliveryFormDialog'
import { deliveryFormStyles } from './shared/delivery-form.styles'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import {
  useCreateOutgoingDelivery,
  useScheduleOutgoingDelivery,
  useOutgoingDeliveries,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { deliveryQuantityError } from '@/features/logistics/delivery-quantities'
import {
  canPrepareOutgoing,
  outgoingOrderBalances,
  remainingOutgoingItemCount,
  outgoingSourceCapacity,
  outgoingLinesForQuantity,
  type OutgoingItemBalance,
} from '@/features/logistics/outgoing-order-balance'
import { parseOrderDecimal } from '@/lib/order-amounts'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'
import { DeliveryQuantityTable } from './DeliveryQuantityTable'

interface ScheduleDeliveryModalProps {
  open: boolean
  onClose: () => void
  preselectedOrderId?: number
}
function getInitialScheduledAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return DeliveryUtils.toDateTimeInput(date)
}
const formatQuantity = (value: string | null) => formatStockCents(parseStockCents(value))

export function ScheduleDeliveryModal({
  open,
  onClose,
  preselectedOrderId,
}: ScheduleDeliveryModalProps) {
  const ordersQuery = useSalesOrders()
  const clientsQuery = useClients()
  const warehousesQuery = useWarehouses()
  const vehiclesQuery = useDeliveryVehicles()
  const employeesQuery = useEmployees()
  const stocksQuery = useStockItems()
  const productsQuery = useProducts()
  const deliveriesQuery = useOutgoingDeliveries()
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])
  const clients = clientsQuery.data ?? []
  const warehouses = warehousesQuery.data ?? []
  const stocks = stocksQuery.data ?? []
  const deliveries = useMemo(() => deliveriesQuery.data ?? [], [deliveriesQuery.data])
  const vehicles = vehiclesQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const products = productsQuery.data ?? []
  const sourceQueries = [ordersQuery, warehousesQuery, stocksQuery, deliveriesQuery]
  const unavailable = sourceQueries.some((query) => query.isLoading || query.isError)
  const loadFailed = sourceQueries.some((query) => query.isError)
  const refresh = () =>
    Promise.all([
      ordersQuery.refetch(),
      warehousesQuery.refetch(),
      stocksQuery.refetch(),
      deliveriesQuery.refetch(),
    ] as const)
  const createDelivery = useCreateOutgoingDelivery({ notifySuccess: false })
  const scheduleDelivery = useScheduleOutgoingDelivery()
  const [selectedOrderId, setSelectedOrderId] = useState(
    preselectedOrderId ? String(preselectedOrderId) : '',
  )
  const [warehouseId, setWarehouseId] = useState('')
  const [vehicleId, setVehicleId] = useState('none')
  const [driverId, setDriverId] = useState('none')
  const [scheduledAt, setScheduledAt] = useState(getInitialScheduledAt)
  const [notes, setNotes] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [assignmentsOpen, setAssignmentsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [savedDraft, setSavedDraft] = useState<{
    id: number
    number: string
    balances: OutgoingItemBalance[]
    capacities: Record<number, string | null>
    warehouseName: string
  } | null>(null)
  const [completed, setCompleted] = useState<'DRAFT' | 'SCHEDULED' | null>(null)
  const [phase, setPhase] = useState<'checking' | 'creating' | 'scheduling' | null>(null)
  const lock = useRef(false)
  const busy = phase !== null || createDelivery.isPending || scheduleDelivery.isPending
  const dismiss = () => {
    if (!busy && !lock.current) onClose()
  }
  const readOnly = busy || unavailable || !!savedDraft
  const balancesByOrder = useMemo(
    () => new Map(orders.map((order) => [order.id, outgoingOrderBalances(order, deliveries)])),
    [orders, deliveries],
  )
  const eligibleOrders = orders.filter(
    (order) =>
      canPrepareOutgoing(order) &&
      remainingOutgoingItemCount(balancesByOrder.get(order.id) ?? []) > 0,
  )
  const selectedOrder = orders.find((order) => String(order.id) === selectedOrderId)
  const balances =
    savedDraft?.balances ?? (selectedOrder ? (balancesByOrder.get(selectedOrder.id) ?? []) : [])
  const remainingItems = balances.filter(
    (balance) =>
      balance.remaining === null ||
      (parseOrderDecimal(balance.remaining) ?? 0n) > 0n ||
      (parseOrderDecimal(quantities[balance.item.id] ?? '') ?? 0n) > 0n,
  )
  const selectedEligible =
    !!selectedOrder && eligibleOrders.some((order) => order.id === selectedOrder.id)
  const uncertainOrders = orders.some(
    (order) =>
      canPrepareOutgoing(order) &&
      (balancesByOrder.get(order.id) ?? []).some((balance) => balance.remaining === null),
  )
  const sourceWarehouses = warehouses.filter(
    (warehouse) =>
      warehouse.isActive &&
      balances.some(
        (balance) =>
          (parseOrderDecimal(
            outgoingSourceCapacity(balance, warehouse.id, stocks, warehouses) ?? '',
          ) ?? 0n) > 0n,
      ),
  )
  const quantityFor = (balance: OutgoingItemBalance, capacity: string | null) =>
    quantities[balance.item.id] ?? capacity ?? ''
  const orderLabel = (order: (typeof orders)[number]) =>
    `${order.orderNumber} · ${clients.find((client) => client.id === order.clientId)?.name || `Customer #${order.clientId}`}`
  const failField = (field: string, message: string) => {
    setErrors({ [field]: message })
    if (field === 'vehicle' || field === 'driver') setAssignmentsOpen(true)
    requestAnimationFrame(() => document.getElementById(`delivery-${field}`)?.focus())
  }

  const submit = async (intent: 'draft' | 'schedule') => {
    if (lock.current || completed || (!savedDraft && unavailable)) return
    lock.current = true
    setPhase(savedDraft ? 'scheduling' : 'checking')
    setErrors({})
    try {
      if (savedDraft) {
        const result = await scheduleDelivery.mutateAsync(savedDraft.id)
        if (result.id !== savedDraft.id || result.status !== 'SCHEDULED')
          throw new Error(
            'The server did not confirm scheduling this delivery. Review it in Outgoing Deliveries before retrying.',
          )
        setCompleted('SCHEDULED')
        await refresh()
        return
      }
      if (!selectedOrderId) {
        failField('sales-order', 'Choose a Sales Order to fulfill.')
        return
      }
      if (!warehouseId) {
        failField('warehouse', 'Choose the source warehouse for this delivery.')
        return
      }
      if (
        (intent === 'schedule' && !scheduledAt) ||
        (scheduledAt && !Number.isFinite(new Date(scheduledAt).getTime()))
      ) {
        failField('scheduled-at', 'Enter a valid scheduled date and time.')
        return
      }
      // Retain the displayed plan if the fresh balance changes during submission.
      setQuantities((previous) => ({
        ...Object.fromEntries(
          balances.map((balance) => [
            balance.item.id,
            quantityFor(
              balance,
              outgoingSourceCapacity(balance, Number(warehouseId), stocks, warehouses),
            ),
          ]),
        ),
        ...previous,
      }))
      // Check the complete current order/delivery/stock response immediately before POST.
      const [freshOrders, freshWarehouses, freshStocks, freshDeliveries] = await refresh()
      if (
        [freshOrders, freshWarehouses, freshStocks, freshDeliveries].some(
          (query) => query.isError || !query.data,
        )
      )
        throw new Error(
          'Current shipment balances could not be checked. Retry loading before saving.',
        )
      const order = freshOrders.data!.find((candidate) => String(candidate.id) === selectedOrderId)
      if (!order || !canPrepareOutgoing(order)) {
        failField(
          'sales-order',
          'This order is no longer available for scheduling. Choose another Sales Order.',
        )
        return
      }
      const freshBalances = outgoingOrderBalances(order, freshDeliveries.data!)
      if (freshBalances.some((balance) => balance.remaining === null)) {
        failField(
          'sales-order',
          'Some remaining quantities are unavailable. Reload the order before saving.',
        )
        return
      }
      if (remainingOutgoingItemCount(freshBalances) === 0) {
        failField(
          'sales-order',
          'All quantities have already been arranged. Review its deliveries or choose another Sales Order.',
        )
        return
      }
      const selectedWarehouse = Number(warehouseId)
      const items = []
      for (const balance of freshBalances) {
        const capacity = outgoingSourceCapacity(
          balance,
          selectedWarehouse,
          freshStocks.data!,
          freshWarehouses.data!,
        )
        // Use the quantities displayed before refresh; do not silently replace an employee's plan.
        const displayed = balances.find((candidate) => candidate.item.id === balance.item.id)
        const oldCapacity = displayed
          ? outgoingSourceCapacity(displayed, selectedWarehouse, stocks, warehouses)
          : '0'
        const quantity = quantities[balance.item.id] ?? oldCapacity ?? ''
        const issue = deliveryQuantityError(quantity, capacity)
        if (issue) {
          setErrors({
            warehouse:
              'Shipment balances changed or the quantity exceeds this source. Review the remaining quantities.',
            [`quantity-${balance.item.id}`]: issue,
          })
          requestAnimationFrame(() =>
            document.getElementById(`delivery-quantity-${balance.item.id}`)?.focus(),
          )
          return
        }
        items.push(
          ...outgoingLinesForQuantity(balance, selectedWarehouse, quantity, freshStocks.data!),
        )
      }
      if (!items.length) {
        failField(
          'warehouse',
          'Enter a positive shipment quantity from an eligible source warehouse.',
        )
        return
      }
      if (vehicleId !== 'none') {
        const query = await vehiclesQuery.refetch()
        const vehicle = query.data?.find((candidate) => candidate.id === Number(vehicleId))
        if (
          query.isError ||
          !vehicle ||
          !DeliveryUtils.getVehicleAvailability(vehicle, freshDeliveries.data!).isAvailable
        ) {
          failField(
            'vehicle',
            'This vehicle is unavailable. Choose another or assign later at dispatch.',
          )
          return
        }
      }
      if (driverId !== 'none') {
        const query = await employeesQuery.refetch()
        const driver = query.data?.find((candidate) => candidate.id === Number(driverId))
        if (
          query.isError ||
          !driver ||
          !DeliveryUtils.getDriverAvailability(driver, freshDeliveries.data!).isAvailable
        ) {
          failField(
            'driver',
            'This driver is unavailable. Choose another or assign later at dispatch.',
          )
          return
        }
      }
      setPhase('creating')
      const created = await createDelivery.mutateAsync({
        salesOrderId: order.id,
        warehouseId: selectedWarehouse,
        deliveryVehicleId: vehicleId === 'none' ? null : Number(vehicleId),
        driverEmployeeId: driverId === 'none' ? null : Number(driverId),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes: notes.trim() || null,
        items,
      })
      if (!Number.isInteger(created.id) || created.id <= 0)
        throw new Error(
          'The server did not return a saved delivery ID. Refresh Outgoing Deliveries before submitting again.',
        )
      setSavedDraft({
        id: created.id,
        number: created.deliveryNumber,
        balances: freshBalances,
        capacities: Object.fromEntries(
          freshBalances.map((balance) => [
            balance.item.id,
            outgoingSourceCapacity(
              balance,
              selectedWarehouse,
              freshStocks.data!,
              freshWarehouses.data!,
            ),
          ]),
        ),
        warehouseName:
          freshWarehouses.data!.find((warehouse) => warehouse.id === selectedWarehouse)?.name ??
          `Warehouse #${selectedWarehouse}`,
      })
      if (intent === 'schedule') {
        setPhase('scheduling')
        const result = await scheduleDelivery.mutateAsync(created.id)
        if (result.id !== created.id || result.status !== 'SCHEDULED')
          throw new Error(
            'The server did not confirm scheduling this delivery. Review it in Outgoing Deliveries before retrying.',
          )
        setCompleted('SCHEDULED')
      } else {
        if (created.status !== 'DRAFT')
          throw new Error(
            'The server returned an unexpected delivery status. Review the saved delivery in Outgoing Deliveries.',
          )
        toast.success(`Delivery draft "${created.deliveryNumber}" saved`)
        setCompleted('DRAFT')
      }
      await refresh()
    } catch (error) {
      setErrors({ request: getErrorMessage(error) })
      await refresh()
    } finally {
      setPhase(null)
      lock.current = false
    }
  }
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit('schedule')
  }
  const fieldError = (field: string) =>
    errors[field] ? (
      <p id={`delivery-${field}-error`} role="alert" className="text-xs text-destructive">
        {errors[field]}
      </p>
    ) : null
  const vehicleSummary =
    vehicleId === 'none'
      ? ''
      : vehicles.find((vehicle) => String(vehicle.id) === vehicleId)?.plateNumber ||
        'Selected vehicle'
  const selectedDriver = employees.find((employee) => String(employee.id) === driverId)
  const driverSummary =
    driverId === 'none'
      ? ''
      : selectedDriver
        ? `${selectedDriver.firstName} ${selectedDriver.lastName}`
        : 'Selected driver'

  return (
    <DeliveryFormDialog
      open={open}
      onClose={dismiss}
      busy={busy}
      title="Schedule Outgoing Delivery"
      description="Choose a sales order, review shipment quantities, and set the source and schedule."
    >
      {completed ? (
        <div className={deliveryFormStyles.form}>
          <div role="status" className={deliveryFormStyles.body}>
            <p className="font-semibold">
              {completed === 'SCHEDULED' ? 'Delivery scheduled' : 'Delivery draft saved'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {savedDraft?.number} is available in Outgoing Deliveries.{' '}
              {completed === 'SCHEDULED'
                ? 'Dispatch remains a separate action.'
                : 'Schedule it when you are ready.'}
            </p>
          </div>
          <DeliveryFormFooter>
            <Button
              variant="primary-contrast"
              onClick={dismiss}
              disabled={busy}
              className={deliveryFormStyles.button}
            >
              Done
            </Button>
          </DeliveryFormFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={deliveryFormStyles.form}>
          <div className={deliveryFormStyles.body}>
            {unavailable && (
              <div
                role={loadFailed ? 'alert' : 'status'}
                className={`${deliveryFormStyles.message} ${loadFailed ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {!loadFailed && <Spinner aria-hidden="true" className="mr-2 inline-block size-4" />}
                {loadFailed
                  ? 'Order quantities or source stock could not be loaded.'
                  : 'Loading orders and shipment balances...'}
                {loadFailed && (
                  <Button
                    variant="link"
                    type="button"
                    className={deliveryFormStyles.retry}
                    onClick={() => void refresh()}
                  >
                    Retry loading
                  </Button>
                )}
              </div>
            )}
            {errors.request && (
              <p role="alert" className={`${deliveryFormStyles.message} text-destructive`}>
                {errors.request}
              </p>
            )}
            {savedDraft && (
              <p role="status" className={`${deliveryFormStyles.message} text-muted-foreground`}>
                Draft {savedDraft.number} was saved. Retry Schedule uses this draft; closing leaves
                it in Outgoing Deliveries.
              </p>
            )}
            <fieldset disabled={readOnly} className={deliveryFormStyles.fields}>
              <div className={deliveryFormStyles.grid}>
                <div className={deliveryFormStyles.field}>
                  <Label htmlFor="delivery-sales-order" className={deliveryFormStyles.label}>
                    Sales Order to Fulfill <span className="text-primary">*</span>
                  </Label>
                  {savedDraft && selectedOrder ? (
                    <Input
                      id="delivery-sales-order"
                      value={orderLabel(selectedOrder)}
                      readOnly
                      className={deliveryFormStyles.control}
                    />
                  ) : (
                    <SearchableDropdown
                      id="delivery-sales-order"
                      ariaLabel="Sales Order to Fulfill"
                      options={unavailable ? [] : eligibleOrders}
                      value={selectedEligible ? selectedOrderId : ''}
                      onValueChange={(id) => {
                        setSelectedOrderId(id)
                        setWarehouseId('')
                        setQuantities({})
                        setErrors({})
                      }}
                      getOptionValue={(order) => String(order.id)}
                      getOptionLabel={orderLabel}
                      className={deliveryFormStyles.control}
                      renderOption={(order) => (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{orderLabel(order)}</span>
                          <span className="text-xs text-muted-foreground">
                            {remainingOutgoingItemCount(balancesByOrder.get(order.id) ?? [])}{' '}
                            {remainingOutgoingItemCount(balancesByOrder.get(order.id) ?? []) === 1
                              ? 'item'
                              : 'items'}{' '}
                            remaining
                          </span>
                        </div>
                      )}
                      placeholder="Choose a Sales Order"
                      searchPlaceholder="Search order or customer..."
                      emptyMessage="No Sales Orders awaiting scheduling."
                      contentClassName="w-[min(32rem,calc(100vw-2rem))]"
                    />
                  )}
                  {fieldError('sales-order')}
                  {!savedDraft && !unavailable && eligibleOrders.length === 0 && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      No Sales Orders awaiting scheduling. Confirmed orders with remaining
                      quantities will appear here.
                    </p>
                  )}
                  {!savedDraft && !unavailable && uncertainOrders && (
                    <p role="status" className="text-xs text-muted-foreground">
                      Some order balances are unavailable. Reload to check their scheduling
                      eligibility.{' '}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className={deliveryFormStyles.retry}
                        onClick={() => void refresh()}
                      >
                        Reload balances
                      </Button>
                    </p>
                  )}
                  {selectedOrder && !selectedEligible && !unavailable && !savedDraft && (
                    <p role="status" className="text-xs leading-5 text-muted-foreground">
                      {selectedOrder.orderNumber} has no available scheduling quantities or is no
                      longer eligible. Its existing deliveries remain available.
                    </p>
                  )}
                  {selectedOrder && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {selectedOrder.deliveryAddress}
                    </p>
                  )}
                </div>
                {selectedOrder && (selectedEligible || savedDraft) && (
                  <div className={deliveryFormStyles.field}>
                    <Label htmlFor="delivery-warehouse" className={deliveryFormStyles.label}>
                      Source Warehouse <span className="text-primary">*</span>
                    </Label>
                    {savedDraft ? (
                      <Input
                        id="delivery-warehouse"
                        readOnly
                        value={savedDraft.warehouseName}
                        className={deliveryFormStyles.control}
                      />
                    ) : (
                      <Select
                        value={warehouseId}
                        onValueChange={(id) => {
                          if (id) {
                            setWarehouseId(id)
                            setErrors({})
                          }
                        }}
                      >
                        <SelectTrigger
                          id="delivery-warehouse"
                          aria-invalid={!!errors.warehouse}
                          aria-describedby={
                            errors.warehouse ? 'delivery-warehouse-error' : undefined
                          }
                          className={deliveryFormStyles.control}
                        >
                          <SelectValue placeholder="Choose a source warehouse" />
                        </SelectTrigger>
                        <SelectContent className={deliveryFormStyles.popover}>
                          {sourceWarehouses.map((warehouse) => (
                            <SelectItem
                              key={warehouse.id}
                              value={String(warehouse.id)}
                              className={deliveryFormStyles.option}
                            >
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {fieldError('warehouse')}
                    {!savedDraft &&
                      (sourceWarehouses.length === 0 ? (
                        <p role="status" className="text-xs text-destructive">
                          No eligible source stock is available. Review the order's saved sources
                          and current warehouse stock.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          One warehouse per delivery. Choose from this order's available stock
                          sources.
                        </p>
                      ))}
                  </div>
                )}
              </div>
              {!selectedOrder && !unavailable && (
                <p role="status" className={deliveryFormStyles.empty}>
                  Select an order to view its remaining quantities.
                </p>
              )}
              {selectedOrder && (selectedEligible || savedDraft) && (
                <>
                  <section aria-label="Shipment quantities" className="flex min-w-0 flex-col gap-2">
                    <h2 className={deliveryFormStyles.sectionTitle}>Shipment quantities</h2>
                    <DeliveryQuantityTable
                      compact
                      direction="Outgoing"
                      disabled={readOnly}
                      rows={remainingItems.map((balance) => {
                        const product = products.find(
                          (candidate) => candidate.id === balance.item.inventoryItemId,
                        )
                        const capacity = savedDraft
                          ? savedDraft.capacities[balance.item.id]
                          : warehouseId
                            ? outgoingSourceCapacity(
                                balance,
                                Number(warehouseId),
                                stocks,
                                warehouses,
                              )
                            : balance.remaining
                        return {
                          id: balance.item.id,
                          name: product?.name || `Product #${balance.item.inventoryItemId}`,
                          variety: product?.variety,
                          unit: product?.unit || 'units',
                          ordered: balance.item.quantity,
                          committed: balance.committed ?? '',
                          remaining: balance.remaining,
                          quantityLimit: capacity,
                          quantity: quantityFor(balance, capacity),
                          detail: `Ordered ${formatQuantity(balance.item.quantity)} · Arranged ${formatQuantity(balance.committed)}${warehouseId ? ` · From this source: ${formatQuantity(capacity)}` : ''}`,
                        }
                      })}
                      onChange={(id, quantity) =>
                        setQuantities((previous) => ({ ...previous, [id]: quantity }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter 0 to skip a product. Quantities are limited by the selected source.
                    </p>
                  </section>
                  <div className={`${deliveryFormStyles.field} sm:max-w-sm`}>
                    <Label htmlFor="delivery-scheduled-at" className={deliveryFormStyles.label}>
                      Scheduled Date & Time
                    </Label>
                    <Input
                      id="delivery-scheduled-at"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      aria-invalid={!!errors['scheduled-at']}
                      aria-describedby={
                        errors['scheduled-at'] ? 'delivery-scheduled-at-error' : undefined
                      }
                      className={deliveryFormStyles.control}
                    />
                    {fieldError('scheduled-at')}
                  </div>
                  <div className="flex flex-col gap-4 border-t pt-4">
                    <details
                      open={assignmentsOpen || !!errors.vehicle || !!errors.driver}
                      onToggle={(event) => setAssignmentsOpen(event.currentTarget.open)}
                    >
                      <summary className={deliveryFormStyles.summary}>
                        Vehicle & Driver (Optional)
                      </summary>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[vehicleSummary, driverSummary].filter(Boolean).join(' · ') ||
                          'Assign later at dispatch'}
                      </p>
                      <div
                        hidden={!assignmentsOpen && !errors.vehicle && !errors.driver}
                        className={`mt-3 ${deliveryFormStyles.grid}`}
                      >
                        <div className={deliveryFormStyles.field}>
                          <Label htmlFor="delivery-vehicle" className={deliveryFormStyles.label}>
                            Assign Vehicle (Optional)
                          </Label>
                          <Select value={vehicleId} onValueChange={setVehicleId}>
                            <SelectTrigger
                              id="delivery-vehicle"
                              aria-invalid={!!errors.vehicle}
                              aria-describedby={
                                errors.vehicle ? 'delivery-vehicle-error' : undefined
                              }
                              className={deliveryFormStyles.control}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={deliveryFormStyles.popover}>
                              <SelectItem value="none">Assign Later at Dispatch</SelectItem>
                              {vehicles.map((vehicle) => (
                                <SelectItem
                                  key={vehicle.id}
                                  value={String(vehicle.id)}
                                  disabled={
                                    !DeliveryUtils.getVehicleAvailability(vehicle, deliveries)
                                      .isAvailable
                                  }
                                  className={deliveryFormStyles.option}
                                >
                                  {vehicle.plateNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldError('vehicle')}
                        </div>
                        <div className={deliveryFormStyles.field}>
                          <Label htmlFor="delivery-driver" className={deliveryFormStyles.label}>
                            Assign Driver (Optional)
                          </Label>
                          <Select value={driverId} onValueChange={setDriverId}>
                            <SelectTrigger
                              id="delivery-driver"
                              aria-invalid={!!errors.driver}
                              aria-describedby={errors.driver ? 'delivery-driver-error' : undefined}
                              className={deliveryFormStyles.control}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={deliveryFormStyles.popover}>
                              <SelectItem value="none">Assign Later at Dispatch</SelectItem>
                              {employees.map((employee) => (
                                <SelectItem
                                  key={employee.id}
                                  value={String(employee.id)}
                                  disabled={
                                    !DeliveryUtils.getDriverAvailability(employee, deliveries)
                                      .isAvailable
                                  }
                                  className={deliveryFormStyles.option}
                                >
                                  {employee.firstName} {employee.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldError('driver')}
                        </div>
                        {(vehiclesQuery.isError || employeesQuery.isError) && (
                          <p role="alert" className="text-xs text-destructive sm:col-span-2">
                            Vehicle or driver choices could not be loaded. Assign later, or{' '}
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className={deliveryFormStyles.retry}
                              onClick={() => {
                                void vehiclesQuery.refetch()
                                void employeesQuery.refetch()
                              }}
                            >
                              Retry choices
                            </Button>
                          </p>
                        )}
                      </div>
                    </details>
                    <details
                      open={notesOpen}
                      onToggle={(event) => setNotesOpen(event.currentTarget.open)}
                    >
                      <summary className={deliveryFormStyles.summary}>
                        Delivery instructions (Optional)
                      </summary>
                      <div hidden={!notesOpen} className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="delivery-notes" className={deliveryFormStyles.label}>
                          Delivery Notes / Instructions
                        </Label>
                        <Input
                          id="delivery-notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Loading instructions or gate code..."
                          className={deliveryFormStyles.control}
                        />
                      </div>
                      {!notesOpen && notes && (
                        <p className="mt-1 truncate text-xs text-muted-foreground" title={notes}>
                          {notes}
                        </p>
                      )}
                    </details>
                  </div>
                </>
              )}
            </fieldset>
          </div>
          <DeliveryFormFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={dismiss}
              className={deliveryFormStyles.button}
            >
              {savedDraft ? 'Close' : 'Cancel'}
            </Button>
            {!savedDraft && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || unavailable || !selectedEligible || !warehouseId}
                onClick={() => void submit('draft')}
                className={deliveryFormStyles.button}
              >
                Save Draft
              </Button>
            )}
            <Button
              type="submit"
              variant="primary-contrast"
              className={deliveryFormStyles.button}
              disabled={busy || (!savedDraft && (unavailable || !selectedEligible || !warehouseId))}
            >
              {phase === 'checking'
                ? 'Checking quantities...'
                : phase === 'creating'
                  ? 'Saving...'
                  : phase === 'scheduling'
                    ? 'Scheduling...'
                    : savedDraft
                      ? 'Retry Schedule'
                      : 'Schedule Delivery'}
            </Button>
          </DeliveryFormFooter>
        </form>
      )}
    </DeliveryFormDialog>
  )
}
