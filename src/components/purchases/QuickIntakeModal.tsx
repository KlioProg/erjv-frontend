import { useState, useMemo, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  CheckCircle2,
  Package,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useIncomingDeliveries, INCOMING_DELIVERIES_QUERY_KEY } from '@/features/logistics/incoming-deliveries.hooks'
import {
  createIncomingDeliveryApi,
  scheduleIncomingDeliveryApi,
  completeIncomingDeliveryApi,
} from '@/features/logistics/incoming-deliveries.api'
import { PURCHASE_ORDERS_QUERY_KEY } from '@/features/logistics/purchase-orders.hooks'
import { STOCK_ITEMS_QUERY_KEY } from '@/features/logistics/stock-items.hooks'
import { productKeys } from '@/features/products/products.hooks'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'

export type QuickIntakeModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  purchaseOrder: PurchaseOrderRecord
  warehouses: Warehouse[]
  products: InventoryItemResponse[]
  supplierName?: string
}

type IntakeLineState = {
  purchaseOrderItemId: number
  inventoryItemId: number
  name: string
  variety?: string | null
  unit?: string
  orderedQty: number
  alreadyReceivedQty: number
  remainingQty: number
  receivedQty: number
}

export function QuickIntakeModal({
  open,
  onClose,
  onSuccess,
  purchaseOrder,
  warehouses,
  products,
  supplierName,
}: QuickIntakeModalProps) {
  const queryClient = useQueryClient()
  const { data: allIncomingDeliveries = [] } = useIncomingDeliveries()

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive),
    [warehouses],
  )

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    activeWarehouses[0] ? String(activeWarehouses[0].id) : '',
  )
  const [supplierRef, setSupplierRef] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customQuantities, setCustomQuantities] = useState<Record<number, number>>({})

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  )

  // Compute receivable lines for this PO
  const lines: IntakeLineState[] = useMemo(() => {
    if (!purchaseOrder) return []

    // Existing non-cancelled deliveries for this PO
    const poDeliveries = allIncomingDeliveries.filter(
      (d) => d.purchaseOrderId === purchaseOrder.id && d.status !== 'CANCELLED',
    )

    return purchaseOrder.items.map((item) => {
      const product = productMap.get(item.inventoryItemId)
      const orderedQty = Number(item.quantity) || 0

      const alreadyReceivedQty = poDeliveries
        .flatMap((d) => d.items)
        .filter((dItem) => dItem.purchaseOrderItemId === item.id)
        .reduce((sum, dItem) => sum + Number(dItem.receivedQuantity || 0), 0)

      const remainingQty = Math.max(0, orderedQty - alreadyReceivedQty)
      const override = customQuantities[item.id]
      const receivedQty = override !== undefined ? override : remainingQty

      return {
        purchaseOrderItemId: item.id,
        inventoryItemId: item.inventoryItemId,
        name: product ? product.name : `Item #${item.inventoryItemId}`,
        variety: product?.variety,
        unit: product?.unit || 'unit',
        orderedQty,
        alreadyReceivedQty,
        remainingQty,
        receivedQty,
      }
    })
  }, [purchaseOrder, allIncomingDeliveries, productMap, customQuantities])

  const totalRemainingAcrossPO = lines.reduce((sum, l) => sum + l.remainingQty, 0)
  const totalReceivingNow = lines.reduce((sum, l) => sum + l.receivedQty, 0)

  const handleQtyChange = (purchaseOrderItemId: number, qty: number) => {
    const target = lines.find((l) => l.purchaseOrderItemId === purchaseOrderItemId)
    const max = target ? target.remainingQty : 0
    const safeQty = Math.max(0, Math.min(max, qty))
    setCustomQuantities((prev) => ({ ...prev, [purchaseOrderItemId]: safeQty }))
    setErrorMessage('')
  }

  const handleResetToRemaining = () => {
    setCustomQuantities({})
    setErrorMessage('')
  }

  const selectedWarehouse = activeWarehouses.find(
    (w) => String(w.id) === selectedWarehouseId,
  )

  const handleIntakeSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')

    const warehouseId = Number(selectedWarehouseId)
    if (!warehouseId || warehouseId <= 0) {
      setErrorMessage('Please select a target warehouse to intake the stock.')
      return
    }

    const itemsToReceive = lines
      .filter((l) => l.receivedQty > 0)
      .map((l) => ({
        purchaseOrderItemId: l.purchaseOrderItemId,
        receivedQuantity: l.receivedQty,
      }))

    if (itemsToReceive.length === 0) {
      setErrorMessage('Please specify at least 1 item with quantity to receive.')
      return
    }

    // Check if any line exceeds remaining
    for (const line of lines) {
      if (line.receivedQty > line.remainingQty) {
        setErrorMessage(
          `Received quantity for "${line.name}" exceeds remaining order balance (${line.remainingQty}).`,
        )
        return
      }
    }

    try {
      setIsSubmitting(true)

      // Step 1: Create the incoming delivery record
      const delivery = await createIncomingDeliveryApi({
        purchaseOrderId: purchaseOrder.id,
        warehouseId,
        supplierReference: supplierRef.trim() || undefined,
        notes: notes.trim() || undefined,
        items: itemsToReceive,
      })

      // Step 2: Schedule the intake
      await scheduleIncomingDeliveryApi(delivery.id)

      // Step 3: Complete the intake (triggers backend stock increment / upsert and PO status update)
      await completeIncomingDeliveryApi(delivery.id)

      // Invalidate query caches so all views update immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
      ])

      const whName = selectedWarehouse?.name || `Warehouse #${warehouseId}`
      toast.success(
        `Received ${totalReceivingNow} items for PO ${purchaseOrder.orderNumber}! Stock placed into ${whName}.`,
      )

      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(880px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <ArrowDownToLine className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Receive Goods & Intake to Inventory
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Quickly intake delivered materials for{' '}
            <span className="font-semibold text-foreground font-mono">
              {purchaseOrder.orderNumber}
            </span>{' '}
            directly into warehouse stock without leaving the Purchases screen.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleIntakeSubmit} className="flex flex-col gap-4">
          {/* Quick Info Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground block">Purchase Order</span>
              <span className="font-mono font-bold text-foreground">
                {purchaseOrder.orderNumber}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Supplier Vendor</span>
              <span className="font-semibold text-foreground truncate block">
                {supplierName || `Supplier #${purchaseOrder.supplierId}`}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Receivable Balance</span>
              <span className="font-bold text-emerald-600 font-mono">
                {totalRemainingAcrossPO} remaining items
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <WarehouseIcon className="size-3.5 text-emerald-600" />
                Target Storage Warehouse <span className="text-primary">*</span>
              </Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select intake warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {activeWarehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      <span className="flex items-center gap-1.5">
                        <WarehouseIcon className="size-3.5 text-muted-foreground" />
                        {w.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Delivered quantities will be immediately placed into physical inventory here.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-ref" className="text-xs font-semibold">
                Delivery Receipt / DR # (Optional)
              </Label>
              <Input
                id="quick-ref"
                value={supplierRef}
                onChange={(e) => setSupplierRef(e.target.value)}
                placeholder="e.g. DR-2026-9810"
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Supplier delivery receipt or invoice number from the delivery driver.
              </p>
            </div>
          </div>

          {/* Cargo Breakdown Table */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="border-b border-border/70 p-3 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Purchased Items to Receive
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Verify the physical count delivered against the purchase order.
                </p>
              </div>

              {totalRemainingAcrossPO > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToRemaining}
                  className="h-7 text-[11px] gap-1 shrink-0"
                >
                  <RotateCcw className="size-3" />
                  Auto-fill Remaining
                </Button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center p-4 text-xs text-muted-foreground">
                No items found on this purchase order.
              </div>
            ) : totalRemainingAcrossPO === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-6 text-emerald-600 mb-1" />
                <span className="font-semibold text-foreground">
                  This purchase order is already fully received!
                </span>
                <p className="text-[11px] mt-0.5">
                  All items are already in stock across your warehouses.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Item & Description</th>
                      <th className="px-3 py-2.5 text-center">Ordered</th>
                      <th className="px-3 py-2.5 text-center">Prior Recv.</th>
                      <th className="px-3 py-2.5 text-center">Remaining</th>
                      <th className="px-4 py-2.5 text-center">Receiving Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => {
                      const isComplete = line.remainingQty === 0

                      return (
                        <tr
                          key={line.purchaseOrderItemId}
                          className={isComplete ? 'bg-muted/30 opacity-60' : ''}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <Package className="size-3.5 text-primary shrink-0" />
                              <div>
                                <span>{line.name}</span>
                                {line.variety && (
                                  <span className="ml-1 text-muted-foreground font-normal text-[11px]">
                                    ({line.variety})
                                  </span>
                                )}
                                <span className="ml-1.5 text-[10px] font-mono text-muted-foreground font-normal">
                                  [{line.unit}]
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-center font-mono font-medium text-muted-foreground">
                            {line.orderedQty}
                          </td>

                          <td className="px-3 py-3 text-center font-mono">
                            {line.alreadyReceivedQty > 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] px-1.5 py-0"
                              >
                                {line.alreadyReceivedQty}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center font-mono font-bold text-foreground">
                            {line.remainingQty}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {isComplete ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                              >
                                Fully Received
                              </Badge>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <Input
                                  type="number"
                                  min="0"
                                  max={line.remainingQty}
                                  value={line.receivedQty}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      line.purchaseOrderItemId,
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 w-20 text-center font-mono text-xs"
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  / {line.remainingQty}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalRemainingAcrossPO > 0 && (
              <div className="border-t border-border/70 bg-background/60 px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-3.5 text-emerald-600" />
                  <span>Items received will automatically update warehouse stock counts.</span>
                </div>
                <div className="font-semibold text-foreground">
                  Receiving Now:{' '}
                  <span className="font-mono text-emerald-600 font-bold">
                    {totalReceivingNow}
                  </span>{' '}
                  units
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-notes" className="text-xs font-semibold text-muted-foreground">
              Dock Inspection Notes (Optional)
            </Label>
            <Input
              id="quick-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Good condition, inspected on arrival"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || totalRemainingAcrossPO === 0 || totalReceivingNow === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isSubmitting ? (
                'Intaking...'
              ) : (
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="size-4" />
                  Confirm Intake & Stock Inventory
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
