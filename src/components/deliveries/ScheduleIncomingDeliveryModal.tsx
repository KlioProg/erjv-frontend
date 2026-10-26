import { useState, useMemo, useRef, type FormEvent } from 'react'
import { Calendar, Warehouse as WarehouseIcon } from 'lucide-react'
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
import { incomingOrderRemainingQuantity } from '@/features/logistics/incoming-order-balance'
import { purchaseReceivingProgress } from '@/features/logistics/purchase-orders.presentation'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { formatStockCents } from '@/features/logistics/stock-display'
import { isAxiosError } from 'axios'

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
  const [needsReview, setNeedsReview] = useState(false)
  const lock = useRef(false)

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const selectedPO = useMemo(() => {
    return eligiblePOs.find(({ po }) => String(po.id) === selectedPOId)?.po
  }, [eligiblePOs, selectedPOId])

  const lines = useMemo(
    () => (selectedPO ? purchaseReceivingProgress(selectedPO, allIncomingDeliveries) : []),
    [selectedPO, allIncomingDeliveries],
  )
  const columns: ColumnDef<(typeof lines)[number]>[] = [
    {
      id: 'product',
      header: 'Product',
      width: '40%',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue
            value={
              productMap.get(row.item.inventoryItemId)?.name ??
              'Product #' + row.item.inventoryItemId
            }
          />
          <OverflowValue
            value={productMap.get(row.item.inventoryItemId)?.unit ?? 'units'}
            className="text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    ...(
      [
        ['ordered', 'Ordered'],
        ['received', 'Previously accepted'],
        ['remaining', 'Outstanding'],
      ] as const
    ).map(([field, header]): ColumnDef<(typeof lines)[number]> => ({
      id: field,
      header,
      align: 'right',
      cell: ({ row }) => (
        <OverflowValue value={formatStockCents(row[field])} className="text-right tabular-nums" />
      ),
    })),
  ]
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
    setErrorMessage('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (lock.current || isSubmitting || unavailable || needsReview) return
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

    lock.current = true
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await onSubmit({
        purchaseOrderId: pId,
        warehouseId: wId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        supplierReference: supplierRef.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: unknown) {
      const uncertain = isAxiosError(err) && (!err.response || err.response.status >= 500)
      setNeedsReview(uncertain)
      setErrorMessage(
        uncertain
          ? getErrorMessage(err) +
              ' Review Incoming Deliveries before creating another shipment; the save may have succeeded.'
          : getErrorMessage(err),
      )
    } finally {
      lock.current = false
      setIsSubmitting(false)
    }
  }

  const selectedSupplierName = selectedPO
    ? selectedPO.supplierId == null
      ? 'No supplier'
      : supplierMap.get(selectedPO.supplierId)?.name || `Supplier #${selectedPO.supplierId}`
    : 'No supplier'

  return (
    <DeliveryFormDialog
      open={open}
      onClose={onClose}
      busy={isSubmitting}
      title="Schedule Incoming Delivery"
      description="Choose a purchase order and receiving warehouse. Actual counts are confirmed when goods arrive."
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

          <fieldset
            disabled={isSubmitting || unavailable || needsReview}
            className={deliveryFormStyles.fields}
          >
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
                        const sup =
                          po.supplierId == null ? undefined : supplierMap.get(po.supplierId)

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
            <section
              className="flex min-w-0 flex-col gap-3"
              aria-label="Purchase order receiving summary"
            >
              <p className={deliveryFormStyles.sectionTitle}>Purchase order summary</p>
              <p className="text-xs text-muted-foreground">
                Supplier: {selectedSupplierName}. This schedules the delivery only. Enter actual
                received and damaged counts in Receive Goods.
              </p>
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
                <DataTable
                  data={lines}
                  columns={columns}
                  getRowKey={(row) => row.item.id}
                  pagination={false}
                  tableClassName="min-w-[560px] w-full table-fixed"
                />
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
              needsReview ||
              lines.some((line) => line.remaining === null)
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
