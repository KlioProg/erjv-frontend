import { useState, useMemo, type FormEvent } from 'react'
import { Calendar, RotateCcw, Warehouse as WarehouseIcon } from 'lucide-react'
import { DeliveryFormDialog, DeliveryFormFooter } from './shared/DeliveryFormDialog'
import { deliveryFormStyles } from './shared/delivery-form.styles'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIncomingDeliveries } from '@/features/logistics/incoming-deliveries.hooks'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import { getErrorMessage } from '@/lib/api-client'
import {
  remainingDeliveryQuantity,
  deliveryQuantityError,
  sumDeliveryQuantities,
} from '@/features/logistics/delivery-quantities'
import { parseOrderDecimal } from '@/lib/order-amounts'
import { incomingOrderRemainingQuantity } from '@/features/logistics/incoming-order-balance'
import { DeliveryQuantityTable } from './DeliveryQuantityTable'

type ScheduleIncomingDeliveryModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateIncomingDeliveryPayload) => Promise<void>
  purchaseOrders: PurchaseOrderRecord[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  preselectedOrderId?: number
}

type DeliveryLineState = {
  purchaseOrderItemId: number
  inventoryItemId: number
  name: string
  unit?: string
  variety?: string | null
  orderedQty: string
  alreadyReceivedQty: string
  remainingQty: string | null
  receivedQty: string
}

export function ScheduleIncomingDeliveryModal({
  open,
  onClose,
  onSubmit,
  purchaseOrders,
  warehouses,
  suppliers,
  products,
  preselectedOrderId,
}: ScheduleIncomingDeliveryModalProps) {
  const incomingQuery = useIncomingDeliveries()
  const { data: allIncomingDeliveries = [] } = incomingQuery
  const unavailable = incomingQuery.isLoading || incomingQuery.isError

  // Hide fully arranged orders; unknown balances remain visible for recovery, never as zero.
  const eligiblePOs = useMemo(() => {
    if (unavailable) return []
    return purchaseOrders
      .filter((po) => ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status))
      .map((po) => ({ po, remaining: incomingOrderRemainingQuantity(po, allIncomingDeliveries) }))
      .filter(({ remaining }) => remaining !== '0.00')
  }, [purchaseOrders, allIncomingDeliveries, unavailable])

  const [selectedPOId, setSelectedPOId] = useState<string>(
    preselectedOrderId ? String(preselectedOrderId) : '',
  )
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    (() => {
      const linked = allIncomingDeliveries.filter(
        (delivery) =>
          delivery.purchaseOrderId === preselectedOrderId && delivery.status !== 'CANCELLED',
      )
      const knownWarehouseIds = [...new Set(linked.map((delivery) => delivery.warehouseId))]
      const knownWarehouse =
        knownWarehouseIds.length === 1
          ? warehouses.find(
              (warehouse) => warehouse.id === knownWarehouseIds[0] && warehouse.isActive,
            )
          : null
      return String(
        knownWarehouse?.id || warehouses.find((warehouse) => warehouse.isActive)?.id || '',
      )
    })(),
  )
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    DeliveryUtils.toDateTimeInput(
      purchaseOrders.find((order) => order.id === preselectedOrderId)?.expectedAt ||
        new Date(Date.now() + 24 * 60 * 60 * 1000),
    ),
  )
  const [supplierRef, setSupplierRef] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const selectedPO = useMemo(() => {
    return eligiblePOs.find(({ po }) => String(po.id) === selectedPOId)?.po
  }, [eligiblePOs, selectedPOId])

  const [customQuantities, setCustomQuantities] = useState<Record<number, string>>({})

  // Compute lines purely with useMemo based on selected PO, previous receipts, and any user quantity overrides
  const lines: DeliveryLineState[] = useMemo(() => {
    if (!selectedPO) return []

    // Deliveries already tied to this PO that are not cancelled
    const poDeliveries = allIncomingDeliveries.filter(
      (d) => d.purchaseOrderId === selectedPO.id && d.status !== 'CANCELLED',
    )

    return selectedPO.items.map((item) => {
      const product = productMap.get(item.inventoryItemId)
      const orderedQty = item.quantity

      // Sum already received from non-cancelled incoming deliveries
      const alreadyReceivedQty = poDeliveries
        .flatMap((d) => d.items)
        .filter((dItem) => dItem.purchaseOrderItemId === item.id)
        .map((dItem) => dItem.receivedQuantity)

      const remainingQty = remainingDeliveryQuantity(orderedQty, alreadyReceivedQty)
      const override = customQuantities[item.id]
      const receivedQty = override !== undefined ? override : (remainingQty ?? '')

      return {
        purchaseOrderItemId: item.id,
        inventoryItemId: item.inventoryItemId,
        name: product ? product.name : `Item #${item.inventoryItemId}`,
        variety: product?.variety,
        unit: product?.unit,
        orderedQty,
        alreadyReceivedQty: sumDeliveryQuantities(alreadyReceivedQty) ?? '',
        remainingQty,
        receivedQty,
      }
    })
  }, [selectedPO, allIncomingDeliveries, productMap, customQuantities])

  const handlePOChange = (newPOId: string) => {
    // Radix's form select can emit an empty value when async options change.
    if (!newPOId) return
    setSelectedPOId(newPOId)
    const linked = allIncomingDeliveries.filter(
      (delivery) => delivery.purchaseOrderId === Number(newPOId) && delivery.status !== 'CANCELLED',
    )
    const knownWarehouseIds = [...new Set(linked.map((delivery) => delivery.warehouseId))]
    if (
      knownWarehouseIds.length === 1 &&
      warehouses.some((warehouse) => warehouse.id === knownWarehouseIds[0] && warehouse.isActive)
    ) {
      setSelectedWarehouseId(String(knownWarehouseIds[0]))
    }
    const expectedAt = purchaseOrders.find((order) => order.id === Number(newPOId))?.expectedAt
    if (expectedAt) setScheduledAt(DeliveryUtils.toDateTimeInput(expectedAt))
    setCustomQuantities({})
    setErrorMessage('')
  }

  const handleQtyChange = (purchaseOrderItemId: number, qty: string) => {
    setCustomQuantities((previous) => ({ ...previous, [purchaseOrderItemId]: qty }))
    setErrorMessage('')
  }

  const handleResetToRemaining = () => {
    setCustomQuantities({})
    setErrorMessage('')
  }

  const totalRemainingAcrossPO = sumDeliveryQuantities(lines.map((line) => line.remainingQty ?? ''))
  const totalReceivingNow = sumDeliveryQuantities(lines.map((line) => line.receivedQty))

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || unavailable) return
    const pId = Number(selectedPOId)
    const wId = Number(selectedWarehouseId)

    if (!pId || !selectedPO) {
      setErrorMessage('Please select a purchase order.')
      return
    }
    if (!wId || !warehouses.some((warehouse) => warehouse.id === wId && warehouse.isActive)) {
      setErrorMessage('Please select a target intake warehouse.')
      return
    }

    for (const line of lines) {
      const issue = deliveryQuantityError(line.receivedQty, line.remainingQty)
      if (issue) {
        setErrorMessage(line.name + ': ' + issue)
        document.getElementById('delivery-quantity-' + line.purchaseOrderItemId)?.focus()
        return
      }
    }

    const itemsToReceive = lines
      .filter((l) => (parseOrderDecimal(l.receivedQty) ?? 0n) > 0n)
      .map((l) => ({
        purchaseOrderItemId: l.purchaseOrderItemId,
        receivedQuantity: l.receivedQty,
      }))

    if (itemsToReceive.length === 0) {
      setErrorMessage('At least one item must have a quantity to receive greater than 0.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await onSubmit({
        purchaseOrderId: pId,
        warehouseId: wId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        supplierReference: supplierRef.trim() || undefined,
        notes: notes.trim() || undefined,
        items: itemsToReceive,
      })
      onClose()
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedSupplierName = selectedPO
    ? supplierMap.get(selectedPO.supplierId)?.name || `Supplier #${selectedPO.supplierId}`
    : 'No supplier'

  return (
    <DeliveryFormDialog
      open={open}
      onClose={onClose}
      busy={isSubmitting}
      title="Schedule Incoming Delivery"
      description="Choose a purchase order, review quantities, and select the receiving location."
    >
      <form onSubmit={handleSubmit} className={deliveryFormStyles.form}>
        <div className={deliveryFormStyles.body}>
          {unavailable && (
            <div
              role={incomingQuery.isError ? 'alert' : 'status'}
              className={`${deliveryFormStyles.message} ${incomingQuery.isError ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {!incomingQuery.isError && (
                <Spinner aria-hidden="true" className="mr-2 inline-block size-4" />
              )}

              {incomingQuery.isError
                ? 'Incoming delivery balances could not be loaded.'
                : 'Loading incoming delivery balances...'}
              {incomingQuery.isError && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className={deliveryFormStyles.retry}
                  onClick={() => void incomingQuery.refetch()}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
          {errorMessage && (
            <p role="alert" className={`${deliveryFormStyles.message} text-destructive`}>
              {errorMessage}
            </p>
          )}

          <fieldset disabled={isSubmitting || unavailable} className={deliveryFormStyles.fields}>
            <div className={deliveryFormStyles.grid}>
              <div className={deliveryFormStyles.field}>
                <Label htmlFor="incoming-purchase-order" className={deliveryFormStyles.label}>
                  Purchase Order <span className="text-primary">*</span>
                </Label>
                <Select
                  value={selectedPO ? String(selectedPO.id) : ''}
                  onValueChange={handlePOChange}
                  disabled={isSubmitting || unavailable || eligiblePOs.length === 0}
                >
                  <SelectTrigger
                    id="incoming-purchase-order"
                    className={deliveryFormStyles.control}
                  >
                    <SelectValue placeholder="Select purchase order..." />
                  </SelectTrigger>
                  <SelectContent className={deliveryFormStyles.popover}>
                    <SelectGroup>
                      {eligiblePOs.map(({ po, remaining }) => {
                        const sup = supplierMap.get(po.supplierId)

                        return (
                          <SelectItem
                            key={po.id}
                            value={String(po.id)}
                            className={deliveryFormStyles.option}
                          >
                            <span className="flex min-w-0 items-center justify-between gap-3">
                              <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                                {po.orderNumber} — {sup ? sup.name : `Supplier #${po.supplierId}`}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {remaining === null
                                  ? 'Balance unavailable'
                                  : `${remaining} remaining`}
                              </span>
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className={deliveryFormStyles.field}>
                <Label htmlFor="incoming-warehouse" className={deliveryFormStyles.label}>
                  Target Warehouse <span className="text-primary">*</span>
                </Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger id="incoming-warehouse" className={deliveryFormStyles.control}>
                    <SelectValue placeholder="Select intake warehouse..." />
                  </SelectTrigger>
                  <SelectContent className={deliveryFormStyles.popover}>
                    {warehouses
                      .filter((w) => w.isActive)
                      .map((w) => (
                        <SelectItem
                          key={w.id}
                          value={String(w.id)}
                          className={deliveryFormStyles.option}
                        >
                          <span className="flex items-center gap-1.5">
                            <WarehouseIcon className="size-3.5 text-muted-foreground" />
                            {w.name}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={deliveryFormStyles.grid}>
              <div className={deliveryFormStyles.field}>
                <Label htmlFor="sched-date" className={deliveryFormStyles.label}>
                  Expected Arrival Date & Time
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sched-date"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={`${deliveryFormStyles.control} pl-9`}
                  />
                </div>
              </div>

              <div className={deliveryFormStyles.field}>
                <Label htmlFor="supplier-ref" className={deliveryFormStyles.label}>
                  Supplier Delivery Receipt / Waybill #
                </Label>
                <Input
                  id="supplier-ref"
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                  placeholder="e.g. DR-2026-9810"
                  className={deliveryFormStyles.control}
                />
              </div>
            </div>

            {/* PO Materials Intake Breakdown */}
            <section aria-label="Shipment quantities" className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={deliveryFormStyles.sectionTitle}>Shipment quantities</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Supplier:{' '}
                    <span className="font-semibold text-foreground">{selectedSupplierName}</span>
                  </p>
                </div>

                {(parseOrderDecimal(totalRemainingAcrossPO ?? '') ?? 0n) > 0n && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetToRemaining}
                    className="h-8 shrink-0 text-[13px] pointer-coarse:min-h-11"
                  >
                    <RotateCcw className="size-4" />
                    Auto-fill Remaining
                  </Button>
                )}
              </div>

              {lines.length === 0 ? (
                <div role="status" className={deliveryFormStyles.empty}>
                  {unavailable
                    ? 'Incoming delivery balances are unavailable.'
                    : eligiblePOs.length === 0
                      ? 'No purchase orders have remaining quantities to arrange. Review existing Incoming Deliveries.'
                      : selectedPOId
                        ? 'This purchase order is no longer available to arrange. Choose another purchase order.'
                        : 'Select an order to view its remaining quantities.'}
                </div>
              ) : (
                <DeliveryQuantityTable
                  direction="Incoming"
                  disabled={isSubmitting}
                  rows={lines.map((line) => ({
                    id: line.purchaseOrderItemId,
                    name: line.name,
                    variety: line.variety,
                    unit: line.unit,
                    ordered: line.orderedQty,
                    committed: line.alreadyReceivedQty,
                    remaining: line.remainingQty,
                    quantity: line.receivedQty,
                  }))}
                  onChange={handleQtyChange}
                />
              )}

              {(parseOrderDecimal(totalRemainingAcrossPO ?? '') ?? 0n) > 0n && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>
                      Choose quantities within the remaining order balance. Use 0 to skip an item.
                    </span>
                  </div>
                  <div className="font-semibold text-foreground">
                    Receiving Now:{' '}
                    <span className="tabular-nums text-primary-text">{totalReceivingNow}</span>{' '}
                    units
                  </div>
                </div>
              )}
            </section>

            <div className={deliveryFormStyles.field}>
              <Label htmlFor="intake-notes" className={deliveryFormStyles.label}>
                Dock Notes / Inspection Remarks
              </Label>
              <Input
                id="intake-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Inspect bags for tearing, check expiration codes, etc."
                className={deliveryFormStyles.control}
              />
            </div>
          </fieldset>
        </div>
        <DeliveryFormFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className={deliveryFormStyles.button}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary-contrast"
            size="sm"
            disabled={
              isSubmitting ||
              unavailable ||
              !selectedPO ||
              totalRemainingAcrossPO === null ||
              totalRemainingAcrossPO === '0.00' ||
              totalReceivingNow === '0.00'
            }
            className={deliveryFormStyles.button}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Incoming Delivery'}
          </Button>
        </DeliveryFormFooter>
      </form>
    </DeliveryFormDialog>
  )
}
