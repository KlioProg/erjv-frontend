import { useQuarantineTag } from '@/features/logistics/use-quarantine-tag'
import { formatStockCents } from '@/features/logistics/stock-display'
import { formatProductUnit } from '@/lib/product-unit'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function ManualQuarantineDialog({
  stockItemId,
  onClose,
}: {
  stockItemId?: number
  onClose: () => void
}) {
  const form = useQuarantineTag(onClose, stockItemId)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.busy) onClose()
      }}
    >
      <DialogContent
        closeDisabled={form.busy}
        className="flex max-h-[90dvh] flex-col overflow-hidden"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Quarantine stock</DialogTitle>
          <DialogDescription>
            Record damaged or spoiled goods found during warehouse inspection. The server holds this
            quantity from available stock.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.submit()
          }}
        >
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            {!form.canTag && <p role="alert">You are not authorized to quarantine stock.</p>}
            {form.error && (
              <Alert variant="destructive">
                <AlertDescription role="alert">{form.error}</AlertDescription>
              </Alert>
            )}
            {form.loading && <p role="status">Loading current stock…</p>}
            <fieldset disabled={!form.canEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <SearchableDropdown
                  options={form.warehouses}
                  value={form.warehouseId}
                  onValueChange={form.setWarehouseId}
                  disabled={!form.canEdit}
                  getOptionValue={(item) => String(item.id)}
                  getOptionLabel={(item) => item.name}
                  placeholder="Select warehouse"
                  searchPlaceholder="Search warehouses"
                  emptyMessage="No active warehouses"
                  ariaLabel="Quarantine warehouse"
                />
              </div>
              <div className="space-y-2">
                <Label>Product stock</Label>
                <SearchableDropdown
                  options={form.stocks}
                  value={form.stockId}
                  onValueChange={form.setStockId}
                  disabled={!form.canEdit}
                  getOptionValue={(item) => String(item.id)}
                  getOptionLabel={(item) => `${item.inventoryItem.name} · stock #${item.id}`}
                  placeholder="Select stock record"
                  searchPlaceholder="Search products"
                  emptyMessage="No eligible stock records"
                  ariaLabel="Quarantine product stock"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Available: {formatStockCents(form.available)}{' '}
                {formatProductUnit(form.selected?.inventoryItem.unit, 'units')}
              </p>
              <div className="space-y-2">
                <Label htmlFor="tag-condition">Condition</Label>
                <select
                  id="tag-condition"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.condition}
                  onChange={(event) =>
                    form.setCondition(event.target.value as 'DAMAGED' | 'SPOILED')
                  }
                >
                  <option value="DAMAGED">Damaged</option>
                  <option value="SPOILED">Spoiled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-quantity">Inspection quantity</Label>
                <Input
                  id="tag-quantity"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(event) => form.setQuantity(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-reason">Inspection reason</Label>
                <Textarea
                  id="tag-reason"
                  value={form.reason}
                  onChange={(event) => form.setReason(event.target.value)}
                  required
                />
              </div>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={form.busy}
              onClick={() => void form.refreshData()}
            >
              Refresh stock and lots
            </Button>
            <Button type="submit" disabled={!form.canSubmit}>
              {form.busy
                ? 'Processing…'
                : form.retrying
                  ? 'Retry same request'
                  : 'Quarantine stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
