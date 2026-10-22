import { formatProductUnit } from '@/lib/product-unit'
import { useState, type FormEvent } from 'react'
import { Package, Tag, FileText, Sparkles, RotateCcw } from 'lucide-react'
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
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { parseStockCents } from '@/features/logistics/stock-display'

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
      let backendMatch: InventoryItemResponse | null
      try {
        backendMatch = await fetchProductByNameApi(cleanName)
      } catch (err) {
        setErrorMsg(getErrorMessage(err))
        return
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

    const priceCents = parseStockCents(unitPrice)
    if (priceCents === null || priceCents > 999_999_999_999n) {
      setErrorMsg(
        'Enter a non-negative price with up to 2 decimals and 10 digits before the decimal point.',
      )
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

        if (priceCents !== parseStockCents(item.unitPrice)) {
          await updatePriceMutation.mutateAsync({
            id: item.id,
            unitPrice: unitPrice.trim(),
          })
        }
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          variety: variety.trim() || null,
          unitPrice: unitPrice.trim(),
          description: description.trim() || null,
        })
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
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader className="pb-2">
        <DialogTitle>{isEditing ? 'Edit Catalog Product' : 'Register New Product'}</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isEditing
            ? 'Update product details and pricing.'
            : 'Register a product, then allocate its stock from the Warehouses view.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedProductMatch && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedProductMatch && (
        <div className="my-1 p-3.5 rounded-lg bg-status-warning border border-status-warning-foreground/30 text-status-warning-foreground flex items-start gap-3">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-status-warning-foreground" />
          <div className="min-w-0 flex-1 text-xs [overflow-wrap:anywhere]">
            <p className="font-medium text-foreground">Deactivated Product Found</p>
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
          <Label htmlFor="item-name" className="text-[13px] font-medium text-foreground">
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

        {/* Variety / Grade */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-variety" className="text-[13px] font-medium text-foreground">
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
          <p className="text-xs text-muted-foreground">
            Specific strain, grade, or packaging classification of the product.
          </p>
        </div>

        {/* Unit Price Field - Enhanced & Large */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="item-price" className="text-[13px] font-medium text-foreground">
              Standard Wholesale Unit Price (₱ PHP){' '}
              {!isEditing && <span className="text-primary">*</span>}
            </Label>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3" />
              Standard Selling Rate
            </span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-medium text-sm text-muted-foreground pointer-events-none">
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
              className="pl-9 h-11 text-base font-medium"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-desc" className="text-[13px] font-medium text-foreground">
            Specifications, Units & Handling Notes
          </Label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 size-4 text-muted-foreground pointer-events-none" />
            <Textarea
              id="item-desc"
              placeholder="e.g. 20 Liters sealed carboy container, commercial cooking oil, storage instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="pl-9 text-[13px]"
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
              className="text-[13px] font-medium cursor-pointer"
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
                className="group gap-2 font-medium cursor-pointer"
              >
                {reactivateMutation.isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Reactivating Product...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Reactivate Product
                  </>
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={isPending} className="font-medium cursor-pointer">
                {isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    {isEditing ? 'Saving...' : 'Registering Product...'}
                  </>
                ) : (
                  <>{isEditing ? 'Save Product Changes' : 'Register Product'}</>
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
          itemDetails={`₱${Number(item.unitPrice || 0).toFixed(2)} / ${formatProductUnit(item.unit, 'unit')}`}
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
