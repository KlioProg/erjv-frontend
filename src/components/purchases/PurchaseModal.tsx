import { useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, Minus, Plus, Trash2 } from 'lucide-react'
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
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'
import { getErrorMessage } from '@/lib/api-client'

export type PurchaseLine = {
  id: string
  inventoryItemId: number
  name: string
  variety?: string | null
  unit: string
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
    String(suppliers.find((supplier) => supplier.isActive)?.id || ''),
  )
  const [referenceNo, setReferenceNo] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')

  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [itemQty, setItemQty] = useState('1')

  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const total = lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)

  const handleAddItem = () => {
    const selectedProduct = products.find(
      (product) => String(product.id) === selectedInventoryItemId && product.isActive,
    )
    if (!selectedProduct) {
      setErrorMessage('Please select an active inventory item.')
      return
    }

    const qty = parseFloat(itemQty)
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Quantity must be greater than 0.')
      return
    }

    const cost = parseFloat(itemCost)
    if (isNaN(cost) || cost < 0) {
      setErrorMessage('Unit cost cannot be negative.')
      return
    }

    const lineId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setLines((current) => {
      const existing = current.find((line) => line.inventoryItemId === selectedProduct.id)
      if (existing) {
        return current.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: l.quantity + qty, unitCost: cost > 0 ? cost : l.unitCost }
            : l,
        )
      }

      return [
        ...current,
        {
          id: lineId,
          inventoryItemId: selectedProduct.id,
          name: selectedProduct.name,
          variety: selectedProduct.variety || null,
          unit: selectedProduct.unit || 'kg',
          unitCost: cost,
          quantity: qty,
        },
      ]
    })

    setSelectedInventoryItemId('')
    setItemCost('')
    setItemQty('1')
    setErrorMessage('')
  }

  const changeQuantity = (lineId: string, delta: number) => {
    setLines((current) =>
      current
        .map((l) => (l.id === lineId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  const updateCost = (lineId: string, cost: number) => {
    setLines((current) =>
      current.map((l) => (l.id === lineId ? { ...l, unitCost: Math.max(0, cost) } : l)),
    )
  }

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((l) => l.id !== lineId))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const supplierId = Number(selectedSupplierId)
    if (
      !supplierId ||
      !suppliers.some((supplier) => supplier.id === supplierId && supplier.isActive)
    ) {
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
        items: lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unitPrice: line.unitCost,
        })),
      })

      onClose()
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(900px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
            <ClipboardList className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Create Purchase Order
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Choose items already in your inventory, then enter the supplier&apos;s price and quantity.
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
              <Label htmlFor="po-supplier" className="text-xs font-semibold">
                Supplier <span className="text-primary">*</span>
              </Label>
              <SearchableDropdown
                id="po-supplier"
                options={suppliers.filter((supplier) => supplier.isActive)}
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                getOptionValue={(supplier) => String(supplier.id)}
                getOptionLabel={(supplier) => `${supplier.name} (${supplier.code})`}
                getOptionSearchText={(supplier) =>
                  [
                    supplier.name,
                    supplier.code,
                    supplier.contactPerson,
                    supplier.email,
                    supplier.phone,
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                placeholder="Search suppliers"
                searchPlaceholder="Search suppliers by name or contact..."
                emptyMessage="No active suppliers found."
                ariaLabel="Search and choose a supplier"
                className="h-10 sm:h-9"
              />
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

          {/* Purchased Items Builder */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="border-b border-border/70 p-3.5 bg-muted/20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Items to order
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Select an inventory item, then enter its order quantity and supplier price.
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-border/80 bg-background/90 p-3">
                <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-12">
                  <div className="flex flex-col gap-1 sm:col-span-6">
                    <Label htmlFor="po-inventory-item" className="text-[11px] font-semibold">
                      Inventory Item <span className="text-primary">*</span>
                    </Label>
                    <SearchableDropdown
                      id="po-inventory-item"
                      options={products.filter((product) => product.isActive)}
                      value={selectedInventoryItemId}
                      onValueChange={(value, product) => {
                        setSelectedInventoryItemId(value)
                        setItemCost(String(product.unitPrice || ''))
                        setErrorMessage('')
                      }}
                      getOptionValue={(product) => String(product.id)}
                      getOptionLabel={(product) =>
                        `${product.name}${product.variety ? ` (${product.variety})` : ''}`
                      }
                      getOptionSearchText={(product) =>
                        [product.name, product.variety, product.unit].filter(Boolean).join(' ')
                      }
                      renderOption={(product) => (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{product.name}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {[product.variety, `${formatCurrency(product.unitPrice)}/${product.unit || 'unit'}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      )}
                      placeholder="Search inventory items"
                      searchPlaceholder="Search by item or variety..."
                      emptyMessage="No active inventory items found."
                      ariaLabel="Search and choose an inventory item"
                      className="h-9"
                      side="bottom"
                      avoidCollisions={false}
                    />
                  </div>

                  <div className="flex flex-col gap-1 sm:col-span-3">
                    <Label className="text-[11px] font-semibold">Cost per Unit (₱) *</Label>
                    <Input
                      type="number"
                      aria-label="Cost per unit"
                      min="0"
                      step="0.01"
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label className="text-[11px] font-semibold">Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddItem}
                      disabled={!selectedInventoryItemId}
                      aria-label="Add selected item to purchase order"
                      className="h-8 w-full gap-1 text-xs font-semibold"
                    >
                      <Plus className="size-3.5" />
                      <span className="sm:sr-only">Add</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Added Lines Table */}
            {lines.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                No items added yet. Search for an inventory item above to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Inventory Item</th>
                      <th className="px-3 py-2.5 text-center">Unit</th>
                      <th className="px-3 py-2.5 text-right">Unit Cost (₱)</th>
                      <th className="px-3 py-2.5 text-center">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex flex-col">
                            <span>{line.name}</span>
                            {line.variety && (
                              <span className="font-normal text-muted-foreground text-[11px]">
                                {line.variety}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-muted-foreground font-mono">
                          {line.unit}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label={`Unit cost for ${line.name}`}
                            value={line.unitCost}
                            onChange={(e) => updateCost(line.id, parseFloat(e.target.value) || 0)}
                            className="h-7 w-20 text-right text-xs ml-auto font-mono"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="mx-auto flex w-fit items-center rounded-lg border border-border bg-background">
                            <button
                              type="button"
                              aria-label={`Decrease ${line.name} quantity`}
                              onClick={() => changeQuantity(line.id, -1)}
                              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase ${line.name} quantity`}
                              onClick={() => changeQuantity(line.id, 1)}
                              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground font-mono">
                          {formatCurrency(line.unitCost * line.quantity)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove item"
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

            <div className="border-t border-border/70 bg-background/60 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {lines.length} {lines.length === 1 ? 'item' : 'items'}
              </span>
              <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <span>Estimated Total:</span>
                <span className="font-mono text-primary">{formatCurrency(total)}</span>
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
              {isSubmitting ? 'Creating Purchase Order...' : 'Create Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
