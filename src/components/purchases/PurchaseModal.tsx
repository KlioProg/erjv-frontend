import { useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, Minus, Package, Plus, Trash2 } from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'

export type PurchaseLine = {
  inventoryItemId: number
  name: string
  variety?: string | null
  unit?: string
  unitCost: number
  quantity: number
}

type PurchaseModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreatePurchaseOrderPayload) => Promise<void>
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  processedBy: string
}

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export function PurchaseModal({
  open,
  onClose,
  onSubmit,
  suppliers,
  products,
  processedBy,
}: PurchaseModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0] ? String(suppliers[0].id) : '',
  )
  const [referenceNo, setReferenceNo] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('none')
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const total = lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)

  const handleAddProduct = () => {
    const product = products.find((p) => String(p.id) === selectedProductId)
    if (!product) return

    setLines((current) => {
      const existing = current.find((l) => l.inventoryItemId === product.id)
      if (existing) {
        return current.map((l) =>
          l.inventoryItemId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...current,
        {
          inventoryItemId: product.id,
          name: product.name,
          variety: product.variety,
          unit: product.unit,
          unitCost: product.unitPrice || 0,
          quantity: 1,
        },
      ]
    })
    setSelectedProductId('none')
    setErrorMessage('')
  }

  const changeQuantity = (inventoryItemId: number, delta: number) => {
    setLines((current) =>
      current
        .map((l) =>
          l.inventoryItemId === inventoryItemId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  const updateCost = (inventoryItemId: number, cost: number) => {
    setLines((current) =>
      current.map((l) =>
        l.inventoryItemId === inventoryItemId ? { ...l, unitCost: Math.max(0, cost) } : l,
      ),
    )
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const supplierId = Number(selectedSupplierId)
    if (!supplierId || supplierId <= 0) {
      setErrorMessage('Please select a supplier.')
      return
    }

    if (lines.length === 0) {
      setErrorMessage('Please add at least one material/inventory item.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await onSubmit({
        supplierId,
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        externalReference: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: l.quantity,
          unitPrice: l.unitCost,
        })),
      })
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to create purchase order.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(860px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
            <ClipboardList className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Create Purchase Order
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Order materials, raw goods, or merchandise from accredited suppliers.
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
                Supplier Vendor <span className="text-primary">*</span>
              </Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-ref" className="text-xs font-semibold">
                Supplier Invoice / External Ref
              </Label>
              <Input
                id="po-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. INV-9872"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-expected" className="text-xs font-semibold">
                Expected Delivery Date
              </Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="po-expected"
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Processed By</Label>
              <Input value={processedBy} readOnly className="h-9 bg-muted/40 text-xs" />
            </div>
          </div>

          {/* Item Selection */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Order Items
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Add inventory products and specify purchase cost.
                </p>
              </div>
              <div className="flex flex-wrap w-full gap-2 sm:w-auto">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 text-xs sm:w-64 sm:flex-none">
                    <SelectValue placeholder="Choose inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose inventory item</SelectItem>
                    {products
                      .filter((p) => p.isActive)
                      .map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          <span className="flex items-center gap-2">
                            <Package className="size-3.5 text-primary" />
                            {product.name} {product.variety ? `- ${product.variety}` : ''}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddProduct}
                  disabled={selectedProductId === 'none'}
                  className="h-9 shrink-0 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                No items added yet. Select a product above to add.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right">Unit Cost (₱)</th>
                      <th className="px-3 py-2.5 text-center">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => (
                      <tr key={line.inventoryItemId}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {line.name}
                          {line.variety && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              {line.variety}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost}
                            onChange={(e) =>
                              updateCost(line.inventoryItemId, parseFloat(e.target.value) || 0)
                            }
                            className="h-7 w-24 text-right text-xs ml-auto"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="mx-auto flex w-fit items-center rounded-lg border border-border bg-background">
                            <button
                              type="button"
                              onClick={() => changeQuantity(line.inventoryItemId, -1)}
                              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(line.inventoryItemId, 1)}
                              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatCurrency(line.unitCost * line.quantity)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setLines((cur) =>
                                cur.filter((l) => l.inventoryItemId !== line.inventoryItemId),
                              )
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-border/70 bg-background/60 px-4 py-3">
              <div className="ml-auto flex max-w-xs justify-between items-center text-sm font-extrabold text-foreground">
                <span>Estimated Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-notes" className="text-xs font-semibold">
              Special Instructions / Notes
            </Label>
            <Input
              id="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivery terms, payment terms, or remarks"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="font-semibold">
              <ClipboardList className="size-4 mr-1" />
              {isSubmitting ? 'Submitting...' : 'Post Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
