import { useState, type FormEvent } from 'react'
import {
  Package,
  Tag,
  FileText,
  Barcode,
  HelpCircle,
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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useProducts,
  useCreateProduct,
  useUpdateProductDetails,
  useDeactivateProduct,
} from '@/features/products/products.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useCreateStockItem } from '@/features/logistics/stock-items.hooks'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

type InventoryItemModalProps = {
  item: InventoryItemResponse | null
  open: boolean
  onClose: () => void
}

function ItemFormContent({
  item,
  onClose,
}: {
  item: InventoryItemResponse | null
  onClose: () => void
}) {
  const isEditing = !!item
  const { data: allProducts = [] } = useProducts()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProductDetails()
  const deactivateMutation = useDeactivateProduct()
  const createStockMutation = useCreateStockItem()
  const { data: warehouses = [] } = useWarehouses()

  const [name, setName] = useState(item?.name || '')
  const [sku, setSku] = useState(item?.sku || '')
  const [unitPrice, setUnitPrice] = useState<string>(
    item?.unitPrice !== undefined ? String(item.unitPrice) : ''
  )
  const [description, setDescription] = useState(item?.description || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  // Warehouse Initial Stock Allocations map: { [warehouseId]: quantityString }
  const [warehouseAllocations, setWarehouseAllocations] = useState<Record<number, string>>({})

  const handleWarehouseQtyChange = (whId: number, qty: string) => {
    setWarehouseAllocations((prev) => ({
      ...prev,
      [whId]: qty,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Product name is required.')
      return
    }

    const isDuplicate = allProducts.some(
      (p) => p.id !== item?.id && p.name.toLowerCase().trim() === cleanName.toLowerCase()
    )
    if (isDuplicate) {
      setErrorMsg(`A product with the name "${cleanName}" already exists in the database.`)
      return
    }

    if (!isEditing && !sku.trim()) {
      setErrorMsg('Product SKU / Barcode is required.')
      return
    }

    const parsedPrice = parseFloat(unitPrice)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg('Please enter a valid positive unit price.')
      return
    }

    try {
      if (isEditing && item) {
        await updateMutation.mutateAsync({
          id: item.id,
          payload: {
            name: name.trim(),
            description: description.trim() || null,
          },
        })

        // Also save any newly specified warehouse allocations
        const entries = Object.entries(warehouseAllocations)
        for (const [whIdStr, qtyStr] of entries) {
          const parsedQty = parseFloat(qtyStr)
          if (!isNaN(parsedQty) && parsedQty > 0) {
            const whObj = warehouses.find((w) => w.id === Number(whIdStr))
            await createStockMutation.mutateAsync({
              payload: {
                inventoryItemId: item.id,
                warehouseId: Number(whIdStr),
                quantity: parsedQty.toFixed(2),
              },
              itemName: item.name,
              whName: whObj?.name,
            })
          }
        }
      } else {
        const newProduct = await createMutation.mutateAsync({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          unitPrice: parsedPrice,
          description: description.trim() || null,
        })

        // Automatically allocate initial stock to specified warehouses
        const entries = Object.entries(warehouseAllocations)
        for (const [whIdStr, qtyStr] of entries) {
          const parsedQty = parseFloat(qtyStr)
          if (!isNaN(parsedQty) && parsedQty > 0) {
            const whObj = warehouses.find((w) => w.id === Number(whIdStr))
            await createStockMutation.mutateAsync({
              payload: {
                inventoryItemId: newProduct.id,
                warehouseId: Number(whIdStr),
                quantity: parsedQty.toFixed(2),
              },
              itemName: newProduct.name,
              whName: whObj?.name,
            })
          }
        }
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || createStockMutation.isPending

  return (
    <>
      <DialogHeader className="pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-2xs">
          {isEditing ? <Tag className="size-5" /> : <Package className="size-5" />}
        </div>
        <DialogTitle className="text-xl font-bold tracking-tight">
          {isEditing ? 'Edit Catalog Product SKU' : 'Register New Product SKU'}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isEditing
            ? 'Update product catalog item specifications, packaging units, and warehouse allocations.'
            : 'Register a product SKU to track multi-warehouse inventory, pricing, and distribution across 1, 2, or all storage hubs.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        {/* Product Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-name" className="text-xs font-semibold text-foreground/90">
            Product Item & Packaging Name <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="item-name"
              placeholder="e.g. Palm Cooking Oil (20L Carboy), Kohaku Red Rice (50kg Sack), Refined Sugar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9 h-10 text-sm"
              required
            />
          </div>
        </div>

        {/* Spacious, Expanded SKU Section */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/40 border border-border/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <Label htmlFor="item-sku" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Stock Keeping Unit (SKU / Barcode)
              {!isEditing && <span className="text-primary">*</span>}
            </Label>
            <span className="text-[11px] text-primary font-mono font-bold">
              {isEditing ? 'Read-only SKU' : 'UPPERCASE FORMAT'}
            </span>
          </div>

          <div className="relative">
            <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-primary pointer-events-none" />
            <Input
              id="item-sku"
              placeholder="e.g. OIL-PALM-20L, RICE-KOH-50KG, SUG-REF-50KG"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={isEditing}
              className="pl-11 h-11 font-mono tracking-wider uppercase text-sm bg-background font-black border-border shadow-inner"
              required={!isEditing}
            />
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Sample SKU Presets:</span>
              <button
                type="button"
                onClick={() => setSku('OIL-PALM-20L-CARB')}
                className="px-2 py-0.5 rounded-md bg-background border border-border font-mono hover:bg-muted font-bold text-foreground cursor-pointer"
              >
                OIL-PALM-20L
              </button>
              <button
                type="button"
                onClick={() => setSku('RICE-KOH-RED-50KG')}
                className="px-2 py-0.5 rounded-md bg-background border border-border font-mono hover:bg-muted font-bold text-foreground cursor-pointer"
              >
                RICE-KOH-50KG
              </button>
              <button
                type="button"
                onClick={() => setSku('SUG-REF-WHT-50KG')}
                className="px-2 py-0.5 rounded-md bg-background border border-border font-mono hover:bg-muted font-bold text-foreground cursor-pointer"
              >
                SUG-REF-50KG
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <HelpCircle className="size-3 shrink-0" />
            Standardized barcode identifier used across warehouses, delivery trucks, and POS checkout registers.
          </p>
        </div>

        {/* Unit Price Field - Enhanced & Large */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="item-price" className="text-xs font-semibold text-foreground/90">
              Standard Wholesale Unit Price (₱ PHP) {!isEditing && <span className="text-primary">*</span>}
            </Label>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <Sparkles className="size-3" />
              Standard Selling Rate
            </span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-lg text-primary pointer-events-none">
              ₱
            </span>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="1150.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              disabled={isEditing}
              className="pl-9 h-11 text-base font-extrabold"
              required={!isEditing}
            />
          </div>
        </div>

        {/* Multi-Warehouse Stock Allocation Section */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card border border-border/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <WarehouseIcon className="size-4 text-primary" />
              Warehouse Stock Distribution (Assign across 1, 2, or All Facilities)
            </Label>
            <span className="text-[11px] text-muted-foreground font-medium">Optional initial allocation</span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Specify how many units of this product to store in each warehouse hub upon creation:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {warehouses.map((wh) => {
              const currentVal = warehouseAllocations[wh.id] || ''
              return (
                <div
                  key={wh.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/70"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground block truncate" title={wh.name}>
                      {wh.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {wh.address}
                    </span>
                  </div>

                  <div className="w-24 shrink-0">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0 units"
                      value={currentVal}
                      onChange={(e) => handleWarehouseQtyChange(wh.id, e.target.value)}
                      className="h-8 text-xs font-bold text-right"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-desc" className="text-xs font-semibold text-foreground/90">
            Specifications, Units & Handling Notes
          </Label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
            <Textarea
              id="item-desc"
              placeholder="e.g. 20 Liters sealed carboy container, commercial cooking oil, storage instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="pl-9 text-xs"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2.5 pt-3 border-t sm:justify-between">
          {isEditing && item ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={isPending}
              className="text-xs font-semibold cursor-pointer"
            >
              Delete Product
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="font-semibold shadow-xs cursor-pointer">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Registering SKU & Stocks...'}
                </>
              ) : (
                <>{isEditing ? 'Save Product Changes' : 'Register SKU & Allocate Stocks'}</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>

      {item && (
        <ConfirmDeleteModal
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={async () => {
            try {
              await deactivateMutation.mutateAsync(item.id)
              onClose()
            } catch (err) {
              setErrorMsg(getErrorMessage(err))
            }
          }}
          title="Delete Product from Active Catalog"
          description="Are you sure you want to remove this product from the active catalog? It will no longer be available for point of sale billing."
          itemName={item.name}
          itemDetails={`SKU: ${item.sku} • ₱${item.unitPrice.toFixed(2)}`}
          confirmText="Delete Product SKU"
          variant="destructive"
        />
      )}
    </>
  )
}

export function InventoryItemModal({ item, open, onClose }: InventoryItemModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        {open && (
          <ItemFormContent
            key={item ? `item-${item.id}` : 'new-item'}
            item={item}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
