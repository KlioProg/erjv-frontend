import { useState, type FormEvent } from 'react'
import {
  CalendarDays,
  ClipboardList,
  Minus,
  Package,
  Plus,
  Sparkles,
  Trash2,
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQueryClient } from '@tanstack/react-query'
import { productKeys } from '@/features/products/products.hooks'
import { createProductApi } from '@/features/products/products.api'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'
import { getErrorMessage } from '@/lib/api-client'

export type PurchaseLine = {
  id: string
  inventoryItemId?: number
  name: string
  variety?: string | null
  unit: string
  unitCost: number
  quantity: number
  isNewCatalogItem?: boolean
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
  const queryClient = useQueryClient()
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0] ? String(suppliers[0].id) : '',
  )
  const [referenceNo, setReferenceNo] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')

  // New item inputs
  const [itemName, setItemName] = useState('')
  const [itemVariety, setItemVariety] = useState('')
  const [itemUnit, setItemUnit] = useState('kg')
  const [itemCost, setItemCost] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState('none')

  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const total = lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)

  const handleAddItem = () => {
    const trimmedName = itemName.trim()
    if (!trimmedName) {
      setErrorMessage('Please provide an item or material name.')
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

    // Check if this item matches an existing product in the catalog
    let matchedProduct = products.find(
      (p) => String(p.id) === selectedCatalogProductId && p.isActive,
    )

    if (!matchedProduct) {
      matchedProduct = products.find(
        (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase() && p.isActive,
      )
    }

    const lineId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setLines((current) => {
      // If line with identical name already added, increment its quantity
      const existing = current.find(
        (l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      )
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
          inventoryItemId: matchedProduct ? matchedProduct.id : undefined,
          name: trimmedName,
          variety: itemVariety.trim() || matchedProduct?.variety || null,
          unit: itemUnit.trim() || matchedProduct?.unit || 'kg',
          unitCost: cost,
          quantity: qty,
          isNewCatalogItem: !matchedProduct,
        },
      ]
    })

    // Clear inputs for the next item
    setItemName('')
    setItemVariety('')
    setItemCost('')
    setItemQty('1')
    setSelectedCatalogProductId('none')
    setErrorMessage('')
  }

  const changeQuantity = (lineId: string, delta: number) => {
    setLines((current) =>
      current
        .map((l) =>
          l.id === lineId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  const updateCost = (lineId: string, cost: number) => {
    setLines((current) =>
      current.map((l) =>
        l.id === lineId ? { ...l, unitCost: Math.max(0, cost) } : l,
      ),
    )
  }

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((l) => l.id !== lineId))
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

      // Resolve each line to an inventoryItemId
      // If the line is a new item not yet in the inventory, provision it in the catalog first
      const resolvedItems: Array<{ inventoryItemId: number; quantity: number; unitPrice: number }> = []

      for (const line of lines) {
        let itemId = line.inventoryItemId

        if (!itemId) {
          // Double check if a product with this name already exists in products
          const existing = products.find(
            (p) => p.name.trim().toLowerCase() === line.name.trim().toLowerCase(),
          )
          if (existing) {
            itemId = existing.id
          } else {
            // Automatically register new product in catalog
            const created = await createProductApi({
              name: line.name.trim(),
              variety: line.variety?.trim() || undefined,
              unit: line.unit.trim() || 'kg',
              unitPrice: line.unitCost,
            })
            itemId = created.id
          }
        }

        resolvedItems.push({
          inventoryItemId: itemId,
          quantity: line.quantity,
          unitPrice: line.unitCost,
        })
      }

      await onSubmit({
        supplierId,
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        externalReference: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        items: resolvedItems,
      })

      // Invalidate product cache so new items immediately appear in inventory catalog
      void queryClient.invalidateQueries({ queryKey: productKeys.all })

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
            Record supplier orders for raw materials, produce, or merchandise. Enter any items purchased—new items will be automatically placed into your inventory catalog.
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

          {/* Purchased Items Builder */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="border-b border-border/70 p-3.5 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Purchased Goods & Materials
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Type any purchased item, or auto-fill from existing inventory.
                  </p>
                </div>

                {products.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Package className="size-3.5 text-primary shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline shrink-0">
                      Restock:
                    </span>
                    <Select
                      value={selectedCatalogProductId}
                      onValueChange={(val) => {
                        if (val === 'none') return
                        setSelectedCatalogProductId(val)
                        const p = products.find((prod) => String(prod.id) === val)
                        if (p) {
                          setItemName(p.name)
                          setItemVariety(p.variety || '')
                          setItemUnit(p.unit || 'kg')
                          setItemCost(String(p.unitPrice || ''))
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-44 sm:w-60 text-xs bg-background/90 [&>span]:truncate [&>span]:block">
                        <SelectValue placeholder="Quick fill from catalog..." />
                      </SelectTrigger>
                      <SelectContent className="max-w-[280px] sm:max-w-[340px]">
                        <SelectItem value="none">
                          <span className="text-muted-foreground text-xs">-- Select catalog item --</span>
                        </SelectItem>
                        {products
                          .filter((p) => p.isActive)
                          .map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              <span className="truncate block font-medium">
                                {p.name} {p.variety ? `(${p.variety})` : ''} • ₱{p.unitPrice}/{p.unit}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Input Form */}
              <div className="mt-3 rounded-lg border border-border/80 bg-background/90 p-3 flex flex-col gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <Label className="text-[11px] font-semibold">
                      Item Name <span className="text-primary">*</span>
                    </Label>
                    <Input
                      value={itemName}
                      onChange={(e) => {
                        setItemName(e.target.value)
                        setSelectedCatalogProductId('none')
                      }}
                      placeholder="e.g. Jasmine Rice 50kg"
                      className="h-8 text-xs"
                      list="catalog-datalist"
                    />
                    <datalist id="catalog-datalist">
                      {products
                        .filter((p) => p.isActive)
                        .map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.variety ? `${p.variety} • ` : ''}₱{p.unitPrice}/{p.unit}
                          </option>
                        ))}
                    </datalist>
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <Label className="text-[11px] font-semibold">Variety / Brand</Label>
                    <Input
                      value={itemVariety}
                      onChange={(e) => setItemVariety(e.target.value)}
                      placeholder="e.g. Grade A"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <Label className="text-[11px] font-semibold">Unit</Label>
                    <Select value={itemUnit} onValueChange={setItemUnit}>
                      <SelectTrigger className="h-8 text-xs [&>span]:truncate [&>span]:block">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg (Kilogram)</SelectItem>
                        <SelectItem value="sack">sack (Sack)</SelectItem>
                        <SelectItem value="box">box (Box)</SelectItem>
                        <SelectItem value="pcs">pcs (Pieces)</SelectItem>
                        <SelectItem value="bag">bag (Bag)</SelectItem>
                        <SelectItem value="pack">pack (Pack)</SelectItem>
                        <SelectItem value="tin">tin (Tin)</SelectItem>
                        <SelectItem value="liter">liter (Liter)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <Label className="text-[11px] font-semibold">Cost per Unit (₱) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <Label className="text-[11px] font-semibold">Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddItem}
                      disabled={!itemName.trim()}
                      className="h-8 w-full gap-1 text-xs font-semibold"
                    >
                      <Plus className="size-3.5" /> Add Item to Order
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Added Lines Table */}
            {lines.length === 0 ? (
              <div className="flex min-h-20 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                No items added to this purchase order yet. Type an item above and click Add.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Item & Catalog Status</th>
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{line.name}</span>
                            {line.variety && (
                              <span className="font-normal text-muted-foreground text-[11px]">
                                ({line.variety})
                              </span>
                            )}
                            {line.isNewCatalogItem ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-0.5 px-1.5 py-0"
                              >
                                <Sparkles className="size-2.5" />
                                New Item
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0"
                              >
                                Catalog #{line.inventoryItemId}
                              </Badge>
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
                            value={line.unitCost}
                            onChange={(e) =>
                              updateCost(line.id, parseFloat(e.target.value) || 0)
                            }
                            className="h-7 w-20 text-right text-xs ml-auto font-mono"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="mx-auto flex w-fit items-center rounded-lg border border-border bg-background">
                            <button
                              type="button"
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
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3.5 text-emerald-600" />
                <span>
                  New items entered will be added to the inventory catalog automatically.
                </span>
              </div>
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
              {isSubmitting ? 'Submitting PO...' : 'Post Purchase Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
