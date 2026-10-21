import { useMemo, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
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
import {
  canPrepareOutgoing,
  outgoingOrderBalances,
  remainingOutgoingItemCount,
  outgoingLinesForSources,
  type OutgoingItemBalance,
} from '@/features/logistics/outgoing-order-balance'
import type { OutgoingDeliveryLineCommand } from '@/features/logistics/outgoing-deliveries.types'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { getErrorMessage } from '@/lib/api-client'

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
function formatQuantity(value: string | null | undefined): string {
  const parsed = parseOrderDecimal(value ?? '')
  return parsed === null ? '—' : decimalString(parsed)
}
type DeliverySourceSelection = { key: number; stockItemId: string; quantity: string }

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
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])
  const stocks = useMemo(() => stocksQuery.data ?? [], [stocksQuery.data])
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
  const [vehicleId, setVehicleId] = useState('none')
  const [driverId, setDriverId] = useState('none')
  const [scheduledAt, setScheduledAt] = useState(getInitialScheduledAt)
  const [notes, setNotes] = useState('')
  const [sourceSelections, setSourceSelections] = useState<
    Record<number, DeliverySourceSelection[]>
  >({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [assignmentsOpen, setAssignmentsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [savedDraft, setSavedDraft] = useState<{
    id: number
    number: string
    balances: OutgoingItemBalance[]
    items: Array<{ salesOrderItemId: number; stockItemId: number; quantity: string }>
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
    () =>
      new Map(
        orders.map((order) => [
          order.id,
          outgoingOrderBalances(order, deliveries, stocks, warehouses),
        ]),
      ),
    [orders, deliveries, stocks, warehouses],
  )
  const eligibleOrders = orders.filter(
    (order) =>
      canPrepareOutgoing(order) &&
      remainingOutgoingItemCount(balancesByOrder.get(order.id) ?? []) > 0,
  )
  const selectedOrder = orders.find((order) => String(order.id) === selectedOrderId)
  const balances = savedDraft?.balances ?? (selectedOrder ? (balancesByOrder.get(selectedOrder.id) ?? []) : [])
  const remainingItems = balances.filter(
    (balance) =>
      balance.remaining === null || (parseOrderDecimal(balance.remaining) ?? 0n) > 0n,
  )
  const selectedEligible =
    !!selectedOrder && eligibleOrders.some((order) => order.id === selectedOrder.id)
  const uncertainOrders = orders.some(
    (order) =>
      canPrepareOutgoing(order) &&
      (balancesByOrder.get(order.id) ?? []).some((balance) => balance.remaining === null),
  )
  const initialSourceSelections = (balance: OutgoingItemBalance): DeliverySourceSelection[] => {
    const firstSource = balance.sources.find(
      (source) => source.remaining !== null && (parseOrderDecimal(source.remaining) ?? 0n) > 0n,
    )
    return firstSource
      ? [
          {
            key: firstSource.stock.id,
            stockItemId: String(firstSource.stock.id),
            quantity: firstSource.remaining ?? '',
          },
        ]
      : []
  }
  const getSelections = (balance: OutgoingItemBalance) => {
    if (savedDraft) {
      return savedDraft.items
        .filter((item) => item.salesOrderItemId === balance.item.id)
        .map((item, index) => ({
          key: index,
          stockItemId: String(item.stockItemId),
          quantity: item.quantity,
        }))
    }
    return sourceSelections[balance.item.id] ?? initialSourceSelections(balance)
  }
  const updateSourceSelection = (
    itemId: number,
    key: number,
    field: 'stockItemId' | 'quantity',
    value: string,
  ) => {
    const balance = balances.find((candidate) => candidate.item.id === itemId)
    setSourceSelections((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? (balance ? initialSourceSelections(balance) : [])).map((source) =>
        source.key === key ? { ...source, [field]: value } : source,
      ),
    }))
    setErrors({})
  }
  const addSourceSelection = (balance: OutgoingItemBalance) => {
    const current = sourceSelections[balance.item.id] ?? initialSourceSelections(balance)
    const selectedIds = new Set(current.map((source) => source.stockItemId))
    const next = balance.sources.find(
      (source) =>
        source.remaining !== null &&
        (parseOrderDecimal(source.remaining) ?? 0n) > 0n &&
        !selectedIds.has(String(source.stock.id)),
    )
    if (!next) return
    const key = next.stock.id
    setSourceSelections((existing) => ({
      ...existing,
      [balance.item.id]: [
        ...(existing[balance.item.id] ?? initialSourceSelections(balance)),
        {
          key,
          stockItemId: String(next.stock.id),
          quantity: next.remaining ?? '',
        },
      ],
    }))
  }
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
      if (
        (intent === 'schedule' && !scheduledAt) ||
        (scheduledAt && !Number.isFinite(new Date(scheduledAt).getTime()))
      ) {
        failField('scheduled-at', 'Enter a valid scheduled date and time.')
        return
      }
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
      const freshBalances = outgoingOrderBalances(
        order,
        freshDeliveries.data!,
        freshStocks.data!,
        freshWarehouses.data!,
      )
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
      const items: OutgoingDeliveryLineCommand[] = []
      for (const balance of freshBalances) {
        const selected = getSelections(balance)
        const quantities = selected.filter((source) => {
          const value = parseOrderDecimal(source.quantity)
          return value !== null && value > 0n
        })
        if (quantities.length !== selected.length) {
          const invalid = selected.find(
            (source) => parseOrderDecimal(source.quantity) === null,
          )
          if (invalid) {
            setErrors({
              [`quantity-${balance.item.id}-${invalid.key}`]:
                'Enter a quantity with up to two decimal places, or 0 to skip this source.',
            })
            requestAnimationFrame(() =>
              document
                .getElementById(`delivery-quantity-${balance.item.id}-${invalid.key}`)
                ?.focus(),
            )
            return
          }
        }
        if (!quantities.length) continue
        try {
          items.push(
            ...outgoingLinesForSources(
              balance,
              quantities.map((source) => ({
                stockItemId: Number(source.stockItemId),
                quantity: source.quantity,
              })),
            ),
          )
        } catch (cause) {
          setErrors({
            [`quantity-${balance.item.id}`]:
              cause instanceof Error
                ? cause.message
                : 'Shipment quantities changed. Review this item.',
          })
          return
        }
      }
      if (!items.length) {
        failField('sales-order', 'Enter a positive shipment quantity from an available source.')
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
        items,
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
  const fieldError = (field: string, message = errors[field]) =>
    message ? (
      <p id={`delivery-${field}-error`} role="alert" className="text-xs text-destructive">
        {message}
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
      description="Choose a sales order, select stock sources for each item, and set the schedule."
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
              </div>
              {!selectedOrder && !unavailable && (
                <p role="status" className={deliveryFormStyles.empty}>
                  Select an order to view its remaining quantities.
                </p>
              )}
              {selectedOrder && (selectedEligible || savedDraft) && (
                <>
                  <section aria-label="Shipment sources and quantities" className="flex min-w-0 flex-col gap-3">
                    <h2 className={deliveryFormStyles.sectionTitle}>Shipment sources and quantities</h2>
                    {remainingItems.map((balance) => {
                      const product = products.find(
                        (candidate) => candidate.id === balance.item.inventoryItemId,
                      )
                      const selections = getSelections(balance)
                      const availableSources = balance.sources.filter(
                        (source) =>
                          source.remaining !== null &&
                          (parseOrderDecimal(source.remaining) ?? 0n) > 0n,
                      )

                      return (
                        <div
                          key={balance.item.id}
                          className="rounded-lg border border-border/70 p-3"
                        >
                          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm font-medium">
                              {product?.name || `Product #${balance.item.inventoryItemId}`}
                              {product?.variety ? ` - ${product.variety}` : ''}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Ordered {formatQuantity(balance.item.quantity)} · Arranged{' '}
                              {formatQuantity(balance.committed)} · Remaining{' '}
                              {formatQuantity(balance.remaining)} {product?.unit || 'units'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {selections.map((selection) => {
                              const selectedSource = balance.sources.find(
                                (source) => String(source.stock.id) === selection.stockItemId,
                              )
                              const sourceError = errors[`source-${balance.item.id}-${selection.key}`]
                              const quantityError =
                                errors[`quantity-${balance.item.id}-${selection.key}`]

                              return (
                                <div
                                  key={selection.key}
                                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                                >
                                  <div className={deliveryFormStyles.field}>
                                    <Label
                                      htmlFor={`delivery-source-${balance.item.id}-${selection.key}`}
                                      className={deliveryFormStyles.label}
                                    >
                                      Stock source
                                    </Label>
                                    <Select
                                      value={selection.stockItemId}
                                      disabled={readOnly}
                                      onValueChange={(stockItemId) => {
                                        const source = balance.sources.find(
                                          (candidate) =>
                                            String(candidate.stock.id) === stockItemId,
                                        )
                                        setSourceSelections((current) => ({
                                          ...current,
                                          [balance.item.id]: (
                                            current[balance.item.id] ??
                                            initialSourceSelections(balance)
                                          ).map(
                                            (entry) =>
                                              entry.key === selection.key
                                                ? {
                                                    ...entry,
                                                    stockItemId,
                                                    quantity: source?.remaining ?? '',
                                                  }
                                                : entry,
                                          ),
                                        }))
                                        setErrors({})
                                      }}
                                    >
                                      <SelectTrigger
                                        id={`delivery-source-${balance.item.id}-${selection.key}`}
                                        aria-invalid={!!sourceError}
                                        aria-describedby={
                                          sourceError
                                            ? `delivery-source-${balance.item.id}-${selection.key}-error`
                                            : undefined
                                        }
                                        className={deliveryFormStyles.control}
                                      >
                                        <SelectValue placeholder="Choose stock source" />
                                      </SelectTrigger>
                                      <SelectContent className={deliveryFormStyles.popover}>
                                        {availableSources.map((source) => {
                                          const stockItemId = String(source.stock.id)
                                          const alreadySelected = selections.some(
                                            (entry) =>
                                              entry.key !== selection.key &&
                                              entry.stockItemId === stockItemId,
                                          )
                                          const warehouse = warehouses.find(
                                            (candidate) =>
                                              candidate.id === source.stock.warehouseId,
                                          )
                                          return (
                                            <SelectItem
                                              key={stockItemId}
                                              value={stockItemId}
                                              disabled={alreadySelected}
                                              className={deliveryFormStyles.option}
                                            >
                                              {warehouse?.name || `Warehouse #${source.stock.warehouseId}`}
                                              {' · Available '}
                                              {formatQuantity(source.remaining)}
                                            </SelectItem>
                                          )
                                        })}
                                      </SelectContent>
                                    </Select>
                                    {fieldError(
                                      `source-${balance.item.id}-${selection.key}`,
                                      sourceError,
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Available: {formatQuantity(selectedSource?.remaining)}
                                    </p>
                                  </div>
                                  <div className={deliveryFormStyles.field}>
                                    <Label
                                      htmlFor={`delivery-quantity-${balance.item.id}-${selection.key}`}
                                      className={deliveryFormStyles.label}
                                    >
                                      Quantity ({product?.unit || 'units'})
                                    </Label>
                                    <Input
                                      id={`delivery-quantity-${balance.item.id}-${selection.key}`}
                                      aria-label={`Quantity to ship for ${product?.name || 'product'}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      max={selectedSource?.remaining ?? undefined}
                                      value={selection.quantity}
                                      disabled={readOnly}
                                      onChange={(event) =>
                                        updateSourceSelection(
                                          balance.item.id,
                                          selection.key,
                                          'quantity',
                                          event.target.value,
                                        )
                                      }
                                      aria-invalid={!!quantityError}
                                      aria-describedby={
                                        quantityError
                                          ? `delivery-quantity-${balance.item.id}-${selection.key}-error`
                                          : undefined
                                      }
                                      className={deliveryFormStyles.control}
                                    />
                                    {fieldError(
                                      `quantity-${balance.item.id}-${selection.key}`,
                                      quantityError,
                                    )}
                                  </div>
                                  {fieldError(`quantity-${balance.item.id}`)}
                                  {!readOnly && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="self-end"
                                      aria-label={`Remove stock source for ${product?.name || 'product'}`}
                                      onClick={() => {
                                        setSourceSelections((current) => ({
                                          ...current,
                                          [balance.item.id]: (
                                            current[balance.item.id] ??
                                            initialSourceSelections(balance)
                                          ).filter((entry) => entry.key !== selection.key),
                                        }))
                                        setErrors({})
                                      }}
                                    >
                                      <X className="size-4" />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              disabled={
                                selections.length >= availableSources.length ||
                                availableSources.length === 0
                              }
                              onClick={() => addSourceSelection(balance)}
                            >
                              Add stock source
                            </Button>
                          )}
                          {availableSources.length === 0 && !readOnly && (
                            <p role="status" className="mt-2 text-xs text-destructive">
                              No available stock source can fulfill this item.
                            </p>
                          )}
                        </div>
                      )
                    })}
                    <p className="text-xs text-muted-foreground">
                      Each item can be fulfilled from multiple warehouses. The combined quantity
                      cannot exceed its remaining ordered quantity or the selected sources' current
                      availability.
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
                disabled={busy || unavailable || !selectedEligible}
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
              disabled={busy || (!savedDraft && (unavailable || !selectedEligible))}
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
