import { useRef, useState, type FormEvent } from 'react'
import { Package, PlusCircle, MinusCircle, SlidersHorizontal } from 'lucide-react'
import { formatProductUnit } from '@/lib/product-unit'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useCreateStockAdjustment, useCreateStockItem, useStockItemById, useStockItemByPair } from '@/features/logistics/stock-items.hooks'
import type { StockAdjustment, StockAdjustmentPayload, StockItem, StockItemWithRelations } from '@/features/logistics/stock-items.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getApiError, getErrorMessage, requireRevision } from '@/lib/api-client'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { useCursorLookup } from '@/lib/use-cursor-lookup'

type Mode = 'increase' | 'decrease' | 'set'
export type StockAdjustModalProps = {
  stockItem?: StockItemWithRelations | null
  inventoryItem?: InventoryItemResponse | null
  warehouseId?: number
  initialMode?: Mode
  open: boolean
  onClose: () => void
}
const historyColumns: ColumnDef<StockAdjustment>[] = [
  { accessorKey: 'createdAt', header: 'Recorded' },
  { accessorKey: 'kind', header: 'Action' },
  { accessorKey: 'submittedQuantity', header: 'Quantity' },
  { accessorKey: 'beforeOnHandQuantity', header: 'Before on hand' },
  { accessorKey: 'afterOnHandQuantity', header: 'After on hand' },
  { accessorKey: 'reason', header: 'Reason' },
]
function StockAdjustContent({ stockItem, inventoryItem, warehouseId, initialMode = 'increase', onClose }: Omit<StockAdjustModalProps, 'open'>) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(String(stockItem?.warehouseId ?? warehouseId ?? ''))
  const detail = useStockItemById(stockItem?.id)
  const pair = useStockItemByPair(stockItem ? undefined : inventoryItem?.id, Number(selectedWarehouseId) || undefined)
  const query = stockItem ? detail : pair
  const [reviewed, setReviewed] = useState<StockItem | null>(stockItem ?? null)
  const current = reviewed ?? query.data ?? null
  const [mode, setMode] = useState<Mode>(initialMode)
  const [amount, setAmount] = useState('20')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState<{ id: number; payload: StockAdjustmentPayload } | null>(null)
  const [rejected, setRejected] = useState(false)
  const lock = useRef(false)
  const create = useCreateStockItem()
  const adjust = useCreateStockAdjustment()
  const history = useCursorLookup<StockAdjustment>(`/stock-items/${current?.id}/adjustments`, {}, Boolean(current?.id))
  const quantity = parseStockCents(amount)
  const onHand = parseStockCents(current?.onHandQuantity)
  const projected = quantity === null || onHand === null ? null : mode === 'set' ? quantity : mode === 'increase' ? onHand + quantity : onHand - quantity
  const stale = Boolean(current && query.data && current.revision !== query.data.revision)
  const busy = create.isPending || adjust.isPending
  const freeze = busy || Boolean(attempt)
  const unit = formatProductUnit(stockItem?.inventoryItem.unit ?? inventoryItem?.unit, 'units')
  const capture = () => { if (current && !reviewed) setReviewed(current) }
  const invalid = quantity === null || (mode !== 'set' && quantity <= 0n) || !reason.trim() || projected === null || projected < 0n
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (lock.current || busy || query.isPending || query.isError || !selectedWarehouseId || rejected) return
    if (!attempt && current && (stale || invalid)) return
    lock.current = true
    setMessage('')
    try {
      if (!current) {
        if (!inventoryItem) throw Error('Choose a product before creating an allocation.')
        await create.mutateAsync({ payload: { inventoryItemId: inventoryItem.id, warehouseId: Number(selectedWarehouseId) } })
      } else {
        const command = attempt ?? { id: current.id, payload: {
          kind: mode.toUpperCase() as StockAdjustmentPayload['kind'], quantity: decimalString(quantity!),
          expectedRevision: requireRevision(current.revision), reason: reason.trim(), requestId: crypto.randomUUID(),
        } }
        setAttempt(command)
        await adjust.mutateAsync(command)
      }
      onClose()
    } catch (error) {
      const status = getApiError(error)?.status
      const definiteRejection = status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429
      setRejected(definiteRejection)
      setMessage(`${getErrorMessage(error)} ${definiteRejection ? 'Refresh and review the current balance before creating a new adjustment.' : 'The outcome may be uncertain. Retry the same adjustment to avoid recording it twice.'}`)
    } finally { lock.current = false }
  }
  const refresh = async () => {
    const result = await query.refetch()
    if (result.isSuccess) {
      setReviewed(result.data ?? null)
      if (rejected) { setAttempt(null); setRejected(false) }
      setMessage('Current balance refreshed. Review the quantities before submitting.')
    }
  }
  return <>
    <DialogHeader>
      <DialogTitle>{current ? 'Adjust Stock Quantity' : 'Allocate Stock to Warehouse'}</DialogTitle>
      <DialogDescription>{current ? `Record an audited adjustment for ${stockItem?.inventoryItem.name ?? inventoryItem?.name ?? 'this product'}.` : 'Register this product at a warehouse with zero stock. Record a separate adjustment to change the balance.'}</DialogDescription>
    </DialogHeader>
    {(message || query.isError || stale) && <Alert variant={query.isError || rejected || stale ? 'destructive' : 'default'}><AlertDescription>
      {message || (query.isError ? getErrorMessage(query.error) : 'This balance has changed. Refresh and review it before submitting.')}
    </AlertDescription></Alert>}
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!stockItem && !warehouseId && <div className="space-y-2"><Label htmlFor="stock-warehouse">Target Warehouse Facility</Label>
        <CursorLookup<{ id: number; name: string }> id="stock-warehouse" path="/warehouses" filter={{ includeInactive: 'false' }} value={selectedWarehouseId} label="Warehouse" getLabel={(record) => record.name} disabled={freeze} onChange={(id) => { setSelectedWarehouseId(id); setReviewed(null); setMessage('') }} />
      </div>}
      {current && <>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Adjustment action">
          {([['increase', 'Increase (+)', PlusCircle], ['decrease', 'Decrease (-)', MinusCircle], ['set', 'Set Total (=)', SlidersHorizontal]] as const).map(([value, label, Icon]) => <Button key={value} type="button" variant={mode === value ? 'default' : 'outline'} disabled={freeze} aria-pressed={mode === value} onClick={() => { capture(); setMode(value) }}><Icon className="size-4" />{label}</Button>)}
        </div>
        <div className="space-y-2"><Label htmlFor="stock-amount">Adjustment quantity ({unit})</Label><div className="relative"><Package className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="stock-amount" className="pl-9" type="text" inputMode="decimal" value={amount} disabled={freeze} onChange={(event) => { capture(); setAmount(event.target.value) }} required /></div></div>
        <div className="space-y-2"><Label htmlFor="stock-reason">Adjustment reason</Label><Input id="stock-reason" value={reason} disabled={freeze} onChange={(event) => { capture(); setReason(event.target.value) }} required /></div>
        <div className="flex justify-between rounded-lg border bg-muted/30 p-3 text-sm"><span>On hand: {formatStockCents(onHand)} {unit}</span><span>Projected: {projected !== null && projected >= 0n ? formatStockCents(projected) : '?'} {unit}</span></div>
        <p className="text-xs text-muted-foreground">In transit: {current.inTransitQuantity} {unit} ? Quarantined: {current.quarantinedQuantity} {unit}. Adjustments change on-hand stock; delivery and quarantine actions remain separate.</p>
      </>}
      <DialogFooter className="flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        {(stale || rejected || query.isError) && <Button type="button" variant="outline" disabled={busy || query.isFetching} onClick={() => void refresh()}>Refresh stock balance</Button>}
        <Button type="submit" disabled={busy || query.isPending || query.isError || !selectedWarehouseId || rejected || (!attempt && Boolean(current) && (invalid || stale))}>{busy ? 'Saving?' : !current ? 'Allocate Stock' : attempt ? 'Retry Same Adjustment' : 'Record Adjustment'}</Button>
      </DialogFooter>
    </form>
    {current && <section className="space-y-2 border-t pt-3" aria-label="Adjustment history"><h3 className="text-sm font-medium">Adjustment history</h3>
      {history.isError && <Alert variant="destructive"><AlertDescription>{getErrorMessage(history.error)} <Button type="button" variant="outline" size="sm" onClick={() => void history.reload()}>Reload history</Button></AlertDescription></Alert>}
      <DataTable data={history.items} columns={historyColumns} isLoading={history.isPending} pagination={false} emptyContent={<p>No adjustments recorded.</p>} />
      {history.hasNextPage && <Button type="button" variant="outline" size="sm" disabled={history.isFetching} onClick={() => void history.fetchNextPage()}>Load more adjustments</Button>}
    </section>}
  </>
}
export function StockAdjustModal({ open, ...props }: StockAdjustModalProps) {
  return <Dialog open={open} onOpenChange={(value) => !value && props.onClose()}><DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">{open && <StockAdjustContent key={props.stockItem ? `stock-${props.stockItem.id}-${props.initialMode}` : `product-${props.inventoryItem?.id}`} {...props} />}</DialogContent></Dialog>
}
