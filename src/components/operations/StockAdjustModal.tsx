import { formatProductUnit } from '@/lib/product-unit'
import { useState, useMemo, type FormEvent } from 'react'
import {
  PlusCircle,
  MinusCircle,
  Package,
  SlidersHorizontal,
  ArrowRight,
  AlertCircle,
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
  useStockItemByPair,
  useStockItems,
} from '@/features/logistics/stock-items.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'
import { parseStockCents } from '@/features/logistics/stock-display'

export type StockAdjustModalProps = {
  stockItem?: StockItemWithRelations | null
  inventoryItem?: InventoryItemResponse | null
  warehouseId?: number
  initialMode?: 'increase' | 'decrease' | 'set'
  open: boolean
  onClose: () => void
}

function StockAdjustContent({
  stockItem,
  inventoryItem,
  warehouseId,
  initialMode = 'increase',
  onClose,
}: {
  stockItem?: StockItemWithRelations | null
  inventoryItem?: InventoryItemResponse | null
  warehouseId?: number
  initialMode?: 'increase' | 'decrease' | 'set'
  onClose: () => void
}) {
  const { data: warehouses = [] } = useWarehouses()
  const { data: allStock = [] } = useStockItems()
  const createStockMutation = useCreateStockItem()
  const setQuantityMutation = useSetStockQuantity()
  const increaseMutation = useIncreaseStock()
  const decreaseMutation = useDecreaseStock()

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive !== false),
    [warehouses],
  )

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() =>
    stockItem ? String(stockItem.warehouseId) : warehouseId ? String(warehouseId) : '',
  )

  const effectiveWarehouseId =
    selectedWarehouseId || (activeWarehouses[0]?.id ? String(activeWarehouses[0].id) : '')

  const activeWhId = stockItem ? stockItem.warehouseId : Number(effectiveWarehouseId)
  const {
    data: pairStockItem,
    isLoading: isLoadingPair,
    error: pairError,
  } = useStockItemByPair(inventoryItem?.id, !stockItem && activeWhId > 0 ? activeWhId : undefined)

  const effectiveStock = stockItem || pairStockItem || null
  const isExistingStock = !!effectiveStock

  const [mode, setMode] = useState<'increase' | 'decrease' | 'set'>(stockItem ? initialMode : 'set')
  const effectiveMode = isExistingStock ? mode : 'set'

  const [amount, setAmount] = useState<string>('20')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const currentQty = effectiveStock ? parseFloat(effectiveStock.quantity) : 0
  const amountCents = parseStockCents(amount)
  const parsedVal = amountCents === null ? NaN : Number(amountCents) / 100

  // Live balance calculation
  const calculatedNewQty = useMemo(() => {
    if (!isExistingStock) return parsedVal
    if (isNaN(parsedVal)) return currentQty
    if (effectiveMode === 'increase') return currentQty + parsedVal
    if (effectiveMode === 'decrease') return currentQty - parsedVal
    return parsedVal // effectiveMode === 'set'
  }, [isExistingStock, currentQty, parsedVal, effectiveMode])

  const isDecreaseExceeding =
    isExistingStock && effectiveMode === 'decrease' && parsedVal > currentQty
  const isPending =
    createStockMutation.isPending ||
    setQuantityMutation.isPending ||
    increaseMutation.isPending ||
    decreaseMutation.isPending

  const itemName = stockItem?.inventoryItem?.name || inventoryItem?.name || 'Product Item'
  const whName =
    stockItem?.warehouse?.name || warehouses.find((w) => w.id === activeWhId)?.name || 'Warehouse'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (isPending || isLoadingPair) return
    if (pairError) {
      setErrorMsg(getErrorMessage(pairError))
      return
    }

    if (isNaN(parsedVal) || parsedVal < 0) {
      setErrorMsg('Please enter a valid non-negative quantity.')
      return
    }

    if (isDecreaseExceeding) {
      setErrorMsg(
        `Cannot reduce stock by ${parsedVal.toLocaleString()} ${formatProductUnit(inventoryItem?.unit || stockItem?.inventoryItem?.unit, 'units')} because available inventory is only ${currentQty.toLocaleString()} ${formatProductUnit(inventoryItem?.unit || stockItem?.inventoryItem?.unit, 'units')}.`,
      )
      return
    }

    try {
      if (effectiveStock) {
        if (effectiveMode === 'increase') {
          await increaseMutation.mutateAsync({
            id: effectiveStock.id,
            payload: { amount: parsedVal.toFixed(2) },
          })
        } else if (effectiveMode === 'decrease') {
          await decreaseMutation.mutateAsync({
            id: effectiveStock.id,
            payload: { amount: parsedVal.toFixed(2) },
          })
        } else {
          await setQuantityMutation.mutateAsync({
            id: effectiveStock.id,
            payload: { quantity: parsedVal.toFixed(2) },
          })
        }
      } else if (inventoryItem) {
        const whId = Number(effectiveWarehouseId)
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

  return (
    <>
      <DialogHeader className="pb-1">
        <DialogTitle>
          {isExistingStock ? 'Adjust Stock Quantity' : 'Allocate Stock to Warehouse'}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isExistingStock ? (
            <>
              Update physical inventory count for{' '}
              <span className="font-medium text-foreground">{itemName}</span> at{' '}
              <span className="font-medium text-foreground">{whName}</span>.
            </>
          ) : (
            <>
              Allocate initial stock for{' '}
              <span className="font-medium text-foreground">{itemName}</span> to a facility.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {(errorMsg || pairError) && (
        <Alert variant="destructive" className="py-2.5 px-3 my-1">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs font-semibold">
            {errorMsg || getErrorMessage(pairError)}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
        {/* Target Warehouse Facility Selector (shown when adjusting an item across facilities) */}
        {!stockItem && !warehouseId && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium text-foreground">
                Target Warehouse Facility <span className="text-primary">*</span>
              </Label>
              {isLoadingPair && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <Spinner className="size-3" /> Checking stock...
                </span>
              )}
            </div>
            {activeWarehouses.length === 0 ? (
              <Alert className="border-status-warning-foreground/30 bg-status-warning text-foreground">
                <AlertDescription className="text-xs">
                  No active warehouse facilities available.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={effectiveWarehouseId}
                onValueChange={(val) => {
                  setSelectedWarehouseId(val)
                  setErrorMsg(null)
                }}
              >
                <SelectTrigger className="h-10 text-[13px] rounded-md">
                  <SelectValue placeholder="Select warehouse facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {activeWarehouses.map((wh) => {
                      const stockRecord = allStock.find(
                        (s) => s.inventoryItemId === inventoryItem?.id && s.warehouseId === wh.id,
                      )
                      return (
                        <SelectItem key={wh.id} value={String(wh.id)} className="text-[13px]">
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="font-semibold">{wh.name}</span>
                            {stockRecord ? (
                              <span className="text-xs font-medium text-status-success-foreground">
                                ({parseFloat(stockRecord.quantity).toLocaleString()} in stock)
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                (New allocation)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Adjustment Type Selector */}
        {isExistingStock && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground">Adjustment Action</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('increase')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-center transition-all cursor-pointer ${
                  effectiveMode === 'increase'
                    ? 'border-status-success-foreground/40 bg-status-success text-status-success-foreground font-medium'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground font-semibold'
                }`}
              >
                <PlusCircle className="size-4 mb-1 text-status-success-foreground" />
                <span className="text-[13px]">Receive (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('decrease')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-center transition-all cursor-pointer ${
                  effectiveMode === 'decrease'
                    ? 'border-status-warning-foreground/40 bg-status-warning text-status-warning-foreground font-medium'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground font-semibold'
                }`}
              >
                <MinusCircle className="size-4 mb-1 text-status-warning-foreground" />
                <span className="text-[13px]">Dispatch (-)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('set')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-center transition-all cursor-pointer ${
                  effectiveMode === 'set'
                    ? 'border-primary-text bg-primary-selected text-primary-text font-medium'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground font-semibold'
                }`}
              >
                <SlidersHorizontal className="size-4 mb-1 text-primary" />
                <span className="text-[13px]">Set Total (=)</span>
              </button>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stock-amount" className="text-[13px] font-medium text-foreground">
            {isExistingStock
              ? effectiveMode === 'increase'
                ? 'Units to Receive / Add (+)'
                : effectiveMode === 'decrease'
                  ? 'Units to Dispatch / Deduct (-)'
                  : 'Exact Total Physical Count (=)'
              : 'Initial Stock Quantity'}
          </Label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="stock-amount"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-9 h-10 text-[13px] rounded-md font-medium"
              required
            />
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <span className="text-muted-foreground font-semibold">Presets:</span>
            {[10, 25, 50, 100, 250].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(String(val))}
                className="px-2 min-h-8 pointer-coarse:min-h-11 py-0.5 rounded-md bg-secondary hover:bg-muted border border-border text-[13px] font-medium text-foreground cursor-pointer transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Projected Balance Preview */}
        {isExistingStock && (
          <div className="rounded-lg border border-border bg-secondary p-3.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">Current Units</span>
              <span className="text-sm font-normal tabular-nums text-foreground">
                {currentQty.toLocaleString()}{' '}
                {formatProductUnit(inventoryItem?.unit || stockItem?.inventoryItem?.unit, 'units')}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>
                {effectiveMode === 'increase'
                  ? `+ ${parsedVal.toLocaleString()}`
                  : effectiveMode === 'decrease'
                    ? `- ${parsedVal.toLocaleString()}`
                    : `→`}
              </span>
              <ArrowRight className="size-3 text-primary" />
            </div>

            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-muted-foreground">Projected Balance</span>
              <span
                className={`text-sm font-medium tabular-nums ${
                  calculatedNewQty < 0
                    ? 'text-destructive'
                    : effectiveMode === 'increase'
                      ? 'text-status-success-foreground'
                      : 'text-foreground'
                }`}
              >
                {calculatedNewQty < 0
                  ? 'Invalid (< 0)'
                  : `${calculatedNewQty.toLocaleString()} ${formatProductUnit(inventoryItem?.unit || stockItem?.inventoryItem?.unit, 'units')}`}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="text-[13px] font-medium h-9 rounded-md cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isPending ||
              isLoadingPair ||
              !!pairError ||
              (!stockItem && activeWarehouses.length === 0) ||
              isDecreaseExceeding ||
              isNaN(parsedVal) ||
              parsedVal < 0
            }
            className={`text-[13px] font-medium h-9 rounded-md cursor-pointer ${
              isExistingStock && effectiveMode === 'increase'
                ? ''
                : isExistingStock && effectiveMode === 'decrease'
                  ? 'bg-status-warning-foreground hover:bg-status-warning-foreground/90 text-white'
                  : ''
            }`}
          >
            {isPending && <Spinner className="size-3.5 mr-1" />}
            {!isExistingStock
              ? 'Allocate Stock'
              : effectiveMode === 'increase'
                ? 'Confirm Inward Stock'
                : effectiveMode === 'decrease'
                  ? 'Confirm Dispatch'
                  : 'Save Stock Balance'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function StockAdjustModal({
  stockItem,
  inventoryItem,
  warehouseId,
  initialMode = 'increase',
  open,
  onClose,
}: StockAdjustModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6">
        {open && (
          <StockAdjustContent
            key={
              stockItem
                ? `stock-${stockItem.id}-${initialMode}`
                : inventoryItem
                  ? `inv-${inventoryItem.id}`
                  : 'new-stock'
            }
            stockItem={stockItem}
            inventoryItem={inventoryItem}
            warehouseId={warehouseId}
            initialMode={initialMode}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
