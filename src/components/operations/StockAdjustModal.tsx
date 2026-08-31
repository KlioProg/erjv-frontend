import { useState, type FormEvent } from 'react'
import { Boxes, PlusCircle, MinusCircle, Package } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useCreateStockItem,
  useDecreaseStock,
  useIncreaseStock,
  useSetStockQuantity,
  useStockItems,
} from '@/features/logistics/stock-items.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'

type StockAdjustModalProps = {
  stockItem?: StockItemWithRelations | null
  inventoryItem?: InventoryItemResponse | null
  open: boolean
  onClose: () => void
}

function StockAdjustContent({
  stockItem,
  inventoryItem,
  onClose,
}: {
  stockItem?: StockItemWithRelations | null
  inventoryItem?: InventoryItemResponse | null
  onClose: () => void
}) {
  const { data: warehouses = [] } = useWarehouses()
  const { data: allStock = [] } = useStockItems()
  const createStockMutation = useCreateStockItem()
  const setQuantityMutation = useSetStockQuantity()
  const increaseMutation = useIncreaseStock()
  const decreaseMutation = useDecreaseStock()

  const isExistingStock = !!stockItem
  const existingAllocatedWhIds =
    !stockItem && inventoryItem
      ? allStock.filter((s) => s.inventoryItemId === inventoryItem.id).map((s) => s.warehouseId)
      : []
  const availableWarehouses = warehouses.filter((w) => !existingAllocatedWhIds.includes(w.id))

  const [mode, setMode] = useState<'increase' | 'decrease' | 'set'>(stockItem ? 'increase' : 'set')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() =>
    stockItem
      ? String(stockItem.warehouseId)
      : availableWarehouses[0]?.id
        ? String(availableWarehouses[0].id)
        : '',
  )
  const [amount, setAmount] = useState('20')
  const [errorMsg, setErrorMsg] = useState('')

  const currentQty = stockItem ? parseFloat(stockItem.quantity) : 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const parsedVal = parseFloat(amount)
    if (isNaN(parsedVal) || parsedVal <= 0) {
      setErrorMsg('Please enter a valid positive quantity.')
      return
    }

    try {
      if (isExistingStock && stockItem) {
        if (mode === 'increase') {
          await increaseMutation.mutateAsync({
            id: stockItem.id,
            payload: { amount: parsedVal.toFixed(2) },
          })
        } else if (mode === 'decrease') {
          if (parsedVal > currentQty) {
            setErrorMsg(`Cannot dispatch more than available inventory (${currentQty} units).`)
            return
          }
          await decreaseMutation.mutateAsync({
            id: stockItem.id,
            payload: { amount: parsedVal.toFixed(2) },
          })
        } else {
          await setQuantityMutation.mutateAsync({
            id: stockItem.id,
            payload: { quantity: parsedVal.toFixed(2) },
          })
        }
      } else if (inventoryItem) {
        const whId = Number(selectedWarehouseId)
        if (!whId) {
          setErrorMsg('Please select a target warehouse facility.')
          return
        }
        const whObj = warehouses.find((w) => w.id === whId)
        await createStockMutation.mutateAsync({
          payload: {
            inventoryItemId: inventoryItem.id,
            warehouseId: whId,
            quantity: parsedVal.toFixed(2),
          },
          itemName: inventoryItem.name,
          whName: whObj?.name,
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const isPending =
    createStockMutation.isPending ||
    setQuantityMutation.isPending ||
    increaseMutation.isPending ||
    decreaseMutation.isPending

  const itemName = stockItem?.inventoryItem?.name || inventoryItem?.name || 'Product Item'
  const whName = stockItem?.warehouse?.name

  return (
    <>
      <DialogHeader className="pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-2xs">
          <Boxes className="size-5" />
        </div>
        <DialogTitle className="text-xl font-bold tracking-tight">
          {isExistingStock ? 'Adjust Inventory Stock' : 'Allocate Stock to Warehouse'}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isExistingStock ? (
            <>
              Update physical inventory count for{' '}
              <span className="font-bold text-foreground">{itemName}</span> at{' '}
              <span className="font-bold text-foreground">{whName}</span>.
            </>
          ) : (
            <>
              Assign initial inventory for{' '}
              <span className="font-bold text-foreground">{itemName}</span> to a storage facility.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        {/* If adjusting existing stock, let user choose action type */}
        {isExistingStock && (
          <div className="flex rounded-xl bg-muted/70 p-1 border border-border/70">
            <button
              type="button"
              onClick={() => setMode('increase')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'increase'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PlusCircle className="size-3.5 text-emerald-500" />
              Receive (+Stock)
            </button>
            <button
              type="button"
              onClick={() => setMode('decrease')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'decrease'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MinusCircle className="size-3.5 text-amber-500" />
              Dispatch (-Stock)
            </button>
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'set'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Set Count
            </button>
          </div>
        )}

        {/* Current quantity callout */}
        {isExistingStock && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs">
            <span className="text-muted-foreground font-semibold">Current Available Stock:</span>
            <span className="font-extrabold text-foreground text-sm">
              {currentQty.toLocaleString()} units
            </span>
          </div>
        )}

        {/* Warehouse selector if creating new allocation */}
        {!isExistingStock &&
          (availableWarehouses.length === 0 ? (
            <Alert className="my-1 border-amber-500/30 bg-amber-500/10 text-foreground">
              <AlertDescription className="text-xs">
                All registered warehouse hubs already have a stock allocation for this product. You
                can adjust quantities directly from the product stock list.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock-wh" className="text-xs font-semibold text-foreground/90">
                Target Warehouse Facility <span className="text-primary">*</span>
              </Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger id="stock-wh" className="h-10 text-xs">
                  <SelectValue placeholder="Select warehouse or storage depot..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableWarehouses.map((wh) => (
                      <SelectItem key={wh.id} value={String(wh.id)} className="text-xs">
                        {wh.name} ({wh.address})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ))}

        {/* Amount Input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="stock-amount" className="text-xs font-semibold text-foreground/90">
            {mode === 'increase'
              ? 'Units to Receive / Inward Stock'
              : mode === 'decrease'
                ? 'Units to Dispatch / Outward Stock'
                : 'Exact Total Physical Count'}{' '}
            <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="stock-amount"
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10 h-11 text-sm font-bold"
              required
            />
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-muted-foreground font-semibold">Quick Units:</span>
            {[10, 25, 50, 100, 250].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(String(val))}
                className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 border border-border/60 font-mono text-[11px] font-bold text-foreground transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2.5 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending || (!isExistingStock && availableWarehouses.length === 0)}
            className="font-semibold shadow-xs"
          >
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Updating Stock...
              </>
            ) : (
              <>{!isExistingStock ? 'Allocate Stock' : 'Apply Stock Adjustment'}</>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function StockAdjustModal({
  stockItem,
  inventoryItem,
  open,
  onClose,
}: StockAdjustModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        {open && (
          <StockAdjustContent
            key={
              stockItem
                ? `stock-${stockItem.id}`
                : inventoryItem
                  ? `inv-${inventoryItem.id}`
                  : 'new-stock'
            }
            stockItem={stockItem}
            inventoryItem={inventoryItem}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
