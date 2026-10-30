import { useState, useMemo, useRef, type FormEvent } from 'react'
import { Calendar } from 'lucide-react'
import { DeliveryFormDialog, DeliveryFormFooter } from './shared/DeliveryFormDialog'
import { deliveryFormStyles } from './shared/delivery-form.styles'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { usePurchaseOrderById } from '@/features/logistics/purchase-orders.hooks'
import { useWarehouse } from '@/features/logistics/warehouses.hooks'
import { useSupplierById } from '@/features/logistics/suppliers.hooks'
import { useQueries } from '@tanstack/react-query'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { productKeys } from '@/features/products/products.hooks'
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
  const [selectedPOId, setSelectedPOId] = useState(preselectedOrderId ? String(preselectedOrderId) : '')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(String(warehouses.find((warehouse) => warehouse.isActive)?.id ?? ''))
  const [search, setSearch] = useState('')
  const purchaseLookup = useCursorLookup<PurchaseOrderRecord>('/purchase-orders', {
    statuses: ['CONFIRMED', 'PARTIALLY_RECEIVED'], ...(search.trim() ? { q: search.trim() } : {}),
  })
  const selectedQuery = usePurchaseOrderById(Number(selectedPOId) || undefined)
  const warehouseQuery = useWarehouse(Number(selectedWarehouseId) || undefined)
  const incomingQuery = useIncomingDeliveries({ purchaseOrderId: Number(selectedPOId) || undefined, status: 'COMPLETED' }, !!selectedPOId)
  const { data: allIncomingDeliveries = [] } = incomingQuery
  const selectedRecord = selectedQuery.data?.id === Number(selectedPOId) ? selectedQuery.data : undefined
  const selectedRemaining = selectedRecord ? incomingOrderRemainingQuantity(selectedRecord, allIncomingDeliveries) : null
  const selectedPO = selectedRecord && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(selectedRecord.status) && selectedRemaining !== '0.00' ? selectedRecord : undefined
  const unavailable = !!selectedPOId && (selectedQuery.isFetching || selectedQuery.isError || incomingQuery.isFetching || incomingQuery.isError)
  const selectionFailed = !!selectedPOId && (selectedQuery.isError || (!selectedRecord && !selectedQuery.isPending))
  const balanceFailed = selectionFailed || incomingQuery.isError
  const eligiblePOs = purchaseLookup.items.filter((po) => ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status) && !(po.id === selectedRecord?.id && !unavailable && selectedRemaining === '0.00'))
  const [defaultArrival] = useState(() => DeliveryUtils.toDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  const [arrival, setArrival] = useState<{ orderId: string; value: string } | null>(null)
  const expectedArrival = selectedRecord?.expectedAt ?? purchaseOrders.find((order) => String(order.id) === selectedPOId)?.expectedAt
  const scheduledAt = arrival?.orderId === selectedPOId ? arrival.value : expectedArrival ? DeliveryUtils.toDateTimeInput(expectedArrival) : defaultArrival
  const [supplierRef, setSupplierRef] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsReview, setNeedsReview] = useState(false)
  const lock = useRef(false)

  const supplierQuery = useSupplierById(selectedPO?.supplierId ?? undefined)
  const supplierMap = useMemo(() => new Map([...suppliers, ...(supplierQuery.data ? [supplierQuery.data] : [])].map((supplier) => [supplier.id, supplier])), [suppliers, supplierQuery.data])
  const productQueries = useQueries({ queries: [...new Set((selectedPO?.items ?? []).map((item) => item.inventoryItemId))].map((id) => ({
    queryKey: productKeys.detail(id), queryFn: () => fetchProductByIdApi(id),
  })) })
  const productMap = new Map([...products, ...productQueries.flatMap((query) => query.data ? [query.data] : [])].map((product) => [product.id, product]))
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
    if (newPOId === selectedPOId) return
    setSelectedPOId(newPOId)
    setArrival(null)
    setSupplierRef('')
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
    if (!wId || warehouseQuery.data?.id !== wId || !warehouseQuery.data.isActive) {
      setErrorMessage('Please select a target intake warehouse.')
      return
    }

    lock.current = true
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      const [freshOrder, freshWarehouse, freshReceipts] = await Promise.all([selectedQuery.refetch(), warehouseQuery.refetch(), incomingQuery.refetch()])
      if (freshOrder.isError || freshWarehouse.isError || freshReceipts.isError || !freshOrder.data || !freshWarehouse.data || !freshReceipts.data) throw Error('Current purchase order, warehouse or receiving balance could not be checked. Retry before scheduling.')
      const remaining = incomingOrderRemainingQuantity(freshOrder.data, freshReceipts.data)
      if (freshOrder.data.id !== pId || !['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(freshOrder.data.status) || remaining === null || remaining === '0.00') throw Error('This purchase order is no longer available to arrange. Choose another purchase order.')
      if (freshWarehouse.data.id !== wId || !freshWarehouse.data.isActive) throw Error('Please select an active target intake warehouse.')
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
          {(unavailable || selectionFailed) && (
            <div
              role={balanceFailed ? 'alert' : 'status'}
              className={`${deliveryFormStyles.message} ${balanceFailed ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {!balanceFailed && (
                <Spinner aria-hidden="true" className="mr-2 inline-block size-4" />
              )}

              {balanceFailed
                ? 'The selected purchase order or incoming delivery balances could not be loaded.'
                : 'Loading incoming delivery balances...'}
              {balanceFailed && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className={deliveryFormStyles.retry}
                  onClick={() => { void selectedQuery.refetch(); void incomingQuery.refetch() }}
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
            disabled={isSubmitting || needsReview}
            className={deliveryFormStyles.fields}
          >
            <div className={deliveryFormStyles.grid}>
              <div className={deliveryFormStyles.field}>
                <Label htmlFor="incoming-purchase-order" className={deliveryFormStyles.label}>
                  Purchase Order <span className="text-primary">*</span>
                </Label>
                <SearchableDropdown<PurchaseOrderRecord>
                  id="incoming-purchase-order" ariaLabel="Purchase Order"
                  options={eligiblePOs} value={selectedPOId} onValueChange={handlePOChange}
                  getOptionValue={(order) => String(order.id)}
                  getOptionLabel={(order) => `${order.orderNumber} / ${order.supplierId ? `Supplier #${order.supplierId}` : 'No supplier'}`}
                  selectedLabel={selectedRecord?.orderNumber ?? (selectedPOId ? `Purchase Order #${selectedPOId}` : undefined)}
                  placeholder="Select purchase order..." searchPlaceholder="Search purchase orders"
                  emptyMessage={purchaseLookup.isPending ? 'Loading purchase orders...' : 'No eligible purchase orders found.'}
                  onSearchChange={setSearch} disabled={isSubmitting || needsReview}
                  className={deliveryFormStyles.control}
                  footer={<div className="flex flex-wrap gap-2 border-t pt-2">
                    {purchaseLookup.isError && <p role="alert" className="text-xs text-destructive">{getErrorMessage(purchaseLookup.error)}</p>}
                    {purchaseLookup.isError && <Button type="button" variant="outline" size="sm" onClick={() => void purchaseLookup.reload()}>Reload purchase orders</Button>}
                    {purchaseLookup.hasNextPage && <Button type="button" variant="outline" size="sm" disabled={purchaseLookup.isFetching} onClick={() => void purchaseLookup.fetchNextPage()}>Load more purchase orders</Button>}
                  </div>}
                />
              </div>

              <div className={deliveryFormStyles.field}>
                <Label htmlFor="incoming-warehouse" className={deliveryFormStyles.label}>
                  Destination Warehouse <span className="text-primary">*</span>
                </Label>
                <CursorLookup<Warehouse>
                  id="incoming-warehouse" path="/warehouses" filter={{ includeInactive: 'false' }}
                  label="warehouse" ariaLabel="Destination Warehouse" value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId} getLabel={(warehouse) => warehouse.name}
                  selectedLabel={warehouseQuery.data?.name} accept={(warehouse) => warehouse.isActive}
                  disabled={isSubmitting || needsReview} className={deliveryFormStyles.control}
                />
                {selectedWarehouseId && !warehouseQuery.isFetching && (warehouseQuery.isError || warehouseQuery.data?.id !== Number(selectedWarehouseId) || !warehouseQuery.data?.isActive) && <p role="alert" className="text-xs text-destructive">
                  The selected warehouse is unavailable or inactive. Choose another warehouse or <Button type="button" variant="link" size="sm" onClick={() => void warehouseQuery.refetch()}>Reload selected warehouse</Button>.
                </p>}
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
                    onChange={(e) => setArrival({ orderId: selectedPOId, value: e.target.value })}
                    className={`${deliveryFormStyles.control} pl-9`}
                  />
                </div>
              </div>

              <div className={deliveryFormStyles.field}>
                <Label htmlFor="supplier-ref" className={deliveryFormStyles.label}>
                  Supplier Reference (optional)
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
                    : eligiblePOs.length === 0 && !purchaseLookup.hasNextPage
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
                Notes (optional)
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
              warehouseQuery.data?.id !== Number(selectedWarehouseId) ||
              warehouseQuery.isFetching || warehouseQuery.isError || !warehouseQuery.data?.isActive ||
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
