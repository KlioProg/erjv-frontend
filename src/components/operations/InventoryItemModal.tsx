import { useState, type FormEvent } from 'react'
import {
  Package,
  Tag,
  FileText,
  Sparkles,
  Warehouse as WarehouseIcon,
  RotateCcw,
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
  useUpdateProductPrice,
  useDeactivateProduct,
  useReactivateProduct,
  fetchProductByNameApi,
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
  const updatePriceMutation = useUpdateProductPrice()
  const deactivateMutation = useDeactivateProduct()
  const reactivateMutation = useReactivateProduct()
  const createStockMutation = useCreateStockItem()
  const { data: warehouses = [] } = useWarehouses()

  const [name, setName] = useState(item?.name || '')
  const [variety, setVariety] = useState(item?.variety || '')
  const [unitPrice, setUnitPrice] = useState<string>(
    item?.unitPrice !== undefined ? String(item.unitPrice) : '',
  )
  const [description, setDescription] = useState(item?.description || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deactivatedProductMatch, setDeactivatedProductMatch] =
    useState<InventoryItemResponse | null>(null)
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
    setDeactivatedProductMatch(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Product name is required.')
      return
    }

    if (!isEditing) {
      let backendMatch: InventoryItemResponse | null = null
      try {
        backendMatch = await fetchProductByNameApi(cleanName)
      } catch {
        // Ignore
      }

      if (
        backendMatch &&
        typeof backendMatch === 'object' &&
        backendMatch.id &&
        backendMatch.isActive === false
      ) {
        setDeactivatedProductMatch(backendMatch)
        setErrorMsg(
          `Product with name "${cleanName}" is currently deactivated. You can reactivate it directly.`,
        )
        return
      }

      // Check if active duplicate exists in current catalog or server
      const isDuplicate = allProducts.some(
        (p) => p.name.toLowerCase().trim() === cleanName.toLowerCase() && p.isActive !== false,
      )
      if (
        isDuplicate ||
        (backendMatch &&
          typeof backendMatch === 'object' &&
          backendMatch.id &&
          backendMatch.isActive !== false)
      ) {
        setErrorMsg(`A product with the name "${cleanName}" is already active in the catalog.`)
        return
      }
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
            variety: variety.trim() || null,
            description: description.trim() || null,
          },
        })

        if (parsedPrice !== item.unitPrice) {
          await updatePriceMutation.mutateAsync({
            id: item.id,
            unitPrice: parsedPrice,
          })
        }

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
          variety: variety.trim() || null,
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

  const handleRestoreFoundProduct = async () => {
    if (deactivatedProductMatch) {
      await reactivateMutation.mutateAsync(deactivatedProductMatch.id)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    createStockMutation.isPending ||
    reactivateMutation.isPending

  return (
    <>
      <DialogHeader className="pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-2xs">
          {isEditing ? <Tag className="size-5" /> : <Package className="size-5" />}
        </div>
        <DialogTitle className="text-xl font-bold tracking-tight">
          {isEditing ? 'Edit Catalog Product' : 'Register New Product'}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isEditing
            ? 'Update product catalog item specifications, packaging units, and warehouse allocations.'
            : 'Register a product item to track multi-warehouse inventory, pricing, and distribution across 1, 2, or all storage hubs.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedProductMatch && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedProductMatch && (
        <div className="my-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4 animate-in spin-in-180 duration-500" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Product Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived catalog item for{' '}
              <strong className="text-foreground">{deactivatedProductMatch.name}</strong> already
              exists. Click <strong>"Reactivate Product"</strong> below to restore it.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        {/* Product Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-name" className="text-xs font-semibold text-foreground/90">
            Product Item Name <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="item-name"
              placeholder="e.g. Cooking Oil 1L Pouch, Sugar 50kg Sack, Premium Sinandomeng"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (deactivatedProductMatch) setDeactivatedProductMatch(null)
                if (errorMsg) setErrorMsg('')
              }}
              className="pl-9 h-10 text-sm"
              required
            />
          </div>
        </div>

        {/* Variety / Category */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-variety" className="text-xs font-semibold text-foreground/90">
            Variety / Grade (Optional)
          </Label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="item-variety"
              placeholder="e.g. Sinandomeng, Refined White, Palm Olein"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Specific strain, grade, or packaging classification of the product.
          </p>
        </div>

        {/* Unit Price Field - Enhanced & Large */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="item-price" className="text-xs font-semibold text-foreground/90">
              Standard Wholesale Unit Price (₱ PHP){' '}
              {!isEditing && <span className="text-primary">*</span>}
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
              className="pl-9 h-11 text-base font-extrabold"
              required
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
            <span className="text-[11px] text-muted-foreground font-medium">
              Optional initial allocation
            </span>
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
                    <span
                      className="text-xs font-bold text-foreground block truncate"
                      title={wh.name}
                    >
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
            {deactivatedProductMatch ? (
              <Button
                type="button"
                onClick={handleRestoreFoundProduct}
                disabled={isPending}
                className="group gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-300 animate-in fade-in-0 zoom-in-95"
              >
                {reactivateMutation.isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Reactivating Product...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                    Reactivate Product
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isPending}
                className="font-semibold shadow-xs cursor-pointer transition-all duration-300"
              >
                {isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    {isEditing ? 'Saving...' : 'Registering Product & Stocks...'}
                  </>
                ) : (
                  <>{isEditing ? 'Save Product Changes' : 'Register Product & Allocate Stocks'}</>
                )}
              </Button>
            )}
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
          itemDetails={`₱${Number(item.unitPrice || 0).toFixed(2)} / unit`}
          confirmText="Delete Product"
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
