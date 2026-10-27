import { useState, type FormEvent } from 'react'
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
import type { StockItem } from '@/features/logistics/stock-items.types'
import { useSetReorderThreshold } from '@/features/logistics/stock-items.hooks'
import { parseStockCents } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'

type ReorderThresholdModalProps = {
  stock: Pick<StockItem, 'id' | 'reorderThreshold'>
  productName: string
  warehouseName: string
  open: boolean
  onClose: () => void
}

export function ReorderThresholdModal({
  stock,
  productName,
  warehouseName,
  open,
  onClose,
}: ReorderThresholdModalProps) {
  const [threshold, setThreshold] = useState(stock.reorderThreshold ?? '')
  const [error, setError] = useState('')
  const mutation = useSetReorderThreshold()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = threshold.trim() ? parseStockCents(threshold) : null
    if (threshold.trim() && (parsed === null || parsed > 999_999_999_999n)) {
      setError(
        'Enter a non-negative threshold with up to two decimals and 10 whole digits, or leave it blank.',
      )
      return
    }
    try {
      await mutation.mutateAsync({
        id: stock.id,
        payload: { reorderThreshold: parsed === null ? null : threshold.trim() },
      })
      onClose()
    } catch (cause) {
      setError(getErrorMessage(cause))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Warehouse Reorder Threshold</DialogTitle>
          <DialogDescription>
            Set the low-stock threshold for {productName} at {warehouseName}. Leave it blank to
            disable low-stock warnings for this warehouse.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="stock-reorder-threshold">Reorder threshold</Label>
            <Input
              id="stock-reorder-threshold"
              type="number"
              min="0"
              step="0.01"
              value={threshold}
              onChange={(event) => {
                setThreshold(event.target.value)
                setError('')
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'stock-reorder-threshold-error' : undefined}
              disabled={mutation.isPending}
            />
            {error && (
              <p
                id="stock-reorder-threshold-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save threshold'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
