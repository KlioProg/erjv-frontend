import { useState, useMemo, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  Calendar,
  CheckCircle2,
  Info,
  Package,
  RotateCcw,
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
import { useIncomingDeliveries } from '@/features/logistics/incoming-deliveries.hooks'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import { getErrorMessage } from '@/lib/api-client'

type ScheduleIncomingDeliveryModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateIncomingDeliveryPayload) => Promise<void>
  purchaseOrders: PurchaseOrderRecord[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  products: InventoryItemResponse[]
}

type DeliveryLineState = {
  purchaseOrderItemId: number
  inventoryItemId: number
  name: string
  variety?: string | null
  orderedQty: number
  alreadyReceivedQty: number
  remainingQty: number
  receivedQty: number
}

export function ScheduleIncomingDeliveryModal({
  open,
  onClose,
  onSubmit,
  purchaseOrders,
  warehouses,
  suppliers,
  products,
}: ScheduleIncomingDeliveryModalProps) {
  const { data: allIncomingDeliveries = [] } = useIncomingDeliveries()

  // Eligible POs: Confirmed or Partially Received
  const eligiblePOs = useMemo(() => {
    return purchaseOrders.filter((po) => ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status))
  }, [purchaseOrders])

  const [selectedPOId, setSelectedPOId] = useState<string>(
    eligiblePOs[0] ? String(eligiblePOs[0].id) : '',
  )
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    warehouses[0] ? String(warehouses[0].id) : '',
  )
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  )
  const [supplierRef, setSupplierRef] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const selectedPO = useMemo(() => {
    return eligiblePOs.find((po) => String(po.id) === selectedPOId)
  }, [eligiblePOs, selectedPOId])

  const [customQuantities, setCustomQuantities] = useState<Record<number, number>>({})

  // Compute lines purely with useMemo based on selected PO, previous receipts, and any user quantity overrides
  const lines: DeliveryLineState[] = useMemo(() => {
    if (!selectedPO) return []

    // Deliveries already tied to this PO that are not cancelled
    const poDeliveries = allIncomingDeliveries.filter(
      (d) => d.purchaseOrderId === selectedPO.id && d.status !== 'CANCELLED',
    )

    return selectedPO.items.map((item) => {
      const product = productMap.get(item.inventoryItemId)
      const orderedQty = Number(item.quantity) || 0

      // Sum already received from non-cancelled incoming deliveries
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
        orderedQty,
        alreadyReceivedQty,
        remainingQty,
        receivedQty,
      }
    })
  }, [selectedPO, allIncomingDeliveries, productMap, customQuantities])

  const handlePOChange = (newPOId: string) => {
    setSelectedPOId(newPOId)
    setCustomQuantities({})
    setErrorMessage('')
  }

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

  const totalRemainingAcrossPO = lines.reduce((sum, l) => sum + l.remainingQty, 0)
  const totalReceivingNow = lines.reduce((sum, l) => sum + l.receivedQty, 0)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const pId = Number(selectedPOId)
    const wId = Number(selectedWarehouseId)

    if (!pId) {
      setErrorMessage('Please select a purchase order.')
      return
    }
    if (!wId) {
      setErrorMessage('Please select a target intake warehouse.')
      return
    }

    // Check if any line exceeds remaining
    for (const line of lines) {
      if (line.receivedQty > line.remainingQty) {
        setErrorMessage(
          `Received quantity for "${line.name}" (${line.receivedQty}) exceeds remaining order quantity (${line.remainingQty}).`,
        )
        return
      }
    }

    const itemsToReceive = lines
      .filter((l) => l.receivedQty > 0)
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(880px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <ArrowDownToLine className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Schedule Inbound Shipment Intake
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Record incoming supplier deliveries, verify material quantities against remaining order
            balances, and assign intake docks.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">
                Purchase Order <span className="text-primary">*</span>
              </Label>
              <Select value={selectedPOId} onValueChange={handlePOChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select confirmed PO..." />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePOs.map((po) => {
                    const sup = supplierMap.get(po.supplierId)
                    const poTotalOrdered = po.items.reduce((s, i) => s + Number(i.quantity || 0), 0)
                    const poAlreadyRecv = allIncomingDeliveries
                      .filter((d) => d.purchaseOrderId === po.id && d.status !== 'CANCELLED')
                      .flatMap((d) => d.items)
                      .reduce((s, i) => s + Number(i.receivedQuantity || 0), 0)
                    const poRemaining = Math.max(0, poTotalOrdered - poAlreadyRecv)

                    return (
                      <SelectItem key={po.id} value={String(po.id)}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>
                            {po.orderNumber} — {sup ? sup.name : `Supplier #${po.supplierId}`}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {poRemaining > 0 ? `${poRemaining} remaining` : 'Fully Received'}
                          </span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">
                Target Warehouse <span className="text-primary">*</span>
              </Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select intake warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-date" className="text-xs font-semibold">
                Expected Arrival Date & Time
              </Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sched-date"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-ref" className="text-xs font-semibold">
                Supplier Delivery Receipt / Waybill #
              </Label>
              <Input
                id="supplier-ref"
                value={supplierRef}
                onChange={(e) => setSupplierRef(e.target.value)}
                placeholder="e.g. DR-2026-9810"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* PO Materials Intake Breakdown */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="border-b border-border/70 p-3 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Expected Cargo & Balances
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Supplier:{' '}
                  <span className="font-semibold text-foreground">{selectedSupplierName}</span>
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
                Select a purchase order above to inspect cargo line items.
              </div>
            ) : totalRemainingAcrossPO === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-6 text-emerald-600 mb-1" />
                <span className="font-semibold text-foreground">
                  This purchase order is fully received!
                </span>
                <p className="text-[11px] mt-0.5">
                  All items have already been stocked across completed deliveries.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Product Item</th>
                      <th className="px-3 py-2.5 text-center">Ordered</th>
                      <th className="px-3 py-2.5 text-center">Already Recv.</th>
                      <th className="px-3 py-2.5 text-center">Remaining</th>
                      <th className="px-4 py-2.5 text-center">Qty to Receive</th>
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
                              <span>{line.name}</span>
                              {line.variety && (
                                <span className="text-muted-foreground font-normal text-[11px]">
                                  ({line.variety})
                                </span>
                              )}
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
                                  className="h-8 w-24 text-center font-mono text-xs"
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  / max {line.remainingQty}
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
                  <Info className="size-3.5 text-primary" />
                  <span>Quantities are capped at the remaining receivable order balance.</span>
                </div>
                <div className="font-semibold text-foreground">
                  Receiving Now: <span className="font-mono text-primary">{totalReceivingNow}</span>{' '}
                  units
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-notes" className="text-xs font-semibold">
              Dock Notes / Inspection Remarks
            </Label>
            <Input
              id="intake-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inspect bags for tearing, check expiration codes, etc."
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || totalRemainingAcrossPO === 0 || totalReceivingNow === 0}
              className="font-semibold"
            >
              <ArrowDownToLine className="size-4 mr-1" />
              {isSubmitting ? 'Scheduling...' : 'Schedule Incoming Delivery'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
