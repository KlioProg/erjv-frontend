import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { useStockMetadata } from '@/features/logistics/use-stock-metadata'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'
import { useManualQuarantineTag } from '@/features/logistics/quarantine.hooks'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import type {
  ManualQuarantinePayload,
  QuarantineCondition,
  StockItemWithRelations,
} from '@/features/logistics/stock-items.types'
import { getApiError, getErrorMessage } from '@/lib/api-client'

type PendingReport = { payload: ManualQuarantinePayload; uncertain: boolean }
function productStockLabel(row: StockItemWithRelations) {
  return [row.inventoryItem.name, row.inventoryItem.variety, row.inventoryItem.unit]
    .filter(Boolean)
    .join(' · ')
}

function readPendingReport(key: string): PendingReport | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null') as PendingReport | null
    const payload = saved?.payload
    if (
      payload &&
      typeof saved?.uncertain === 'boolean' &&
      Number.isSafeInteger(payload.stockItemId) &&
      payload.stockItemId > 0 &&
      ['DAMAGED', 'SPOILED'].includes(payload.condition) &&
      (parseStockCents(payload.quantity) ?? 0n) > 0n &&
      typeof payload.reason === 'string' &&
      payload.reason.trim() &&
      typeof payload.requestId === 'string' &&
      /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(payload.requestId)
    )
      return saved!
  } catch {
    /* A malformed local draft must never be sent to the stock API. */
  }
}

export function StockConditionReportModal({
  open,
  onClose,
  stocks,
  stocksLoading = false,
  stocksError = false,
  initialStockItemId,
}: {
  open: boolean
  onClose: () => void
  stocks: StockItemWithRelations[]
  stocksLoading?: boolean
  stocksError?: boolean
  initialStockItemId?: number
}) {
  const { user, isAdmin, isManager, isStaff } = useAuth()
  const storageKey = `erjv:stock-condition-report:${user?.id}`
  const [pendingReport, setPendingReport] = useState(() => readPendingReport(storageKey))
  const [stockId, setStockId] = useState(
    String(pendingReport?.payload.stockItemId ?? initialStockItemId ?? ''),
  )
  const [warehouseId, setWarehouseId] = useState(() => {
    const initial = stocks.find(
      (row) => row.id === (pendingReport?.payload.stockItemId ?? initialStockItemId),
    )
    return initial ? String(initial.warehouseId) : ''
  })
  const [condition, setCondition] = useState<QuarantineCondition>(
    pendingReport?.payload.condition ?? 'DAMAGED',
  )
  const [quantity, setQuantity] = useState(pendingReport?.payload.quantity ?? '')
  const [reason, setReason] = useState(pendingReport?.payload.reason ?? '')
  const [confirmed, setConfirmed] = useState(!!pendingReport)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mutation = useManualQuarantineTag()
  const suppliedStock = stocks.find(row => row.id === Number(stockId))
  const selectedStock = useStockMetadata(!suppliedStock && stockId ? Number(stockId) : undefined)
  const candidate = suppliedStock ?? selectedStock.data
  const resolvedWarehouseId = warehouseId || (candidate ? String(candidate.warehouseId) : '')
  const stock = candidate && String(candidate.warehouseId) === resolvedWarehouseId ? candidate : undefined
  const inactive = stock && (('isActive' in stock.inventoryItem && stock.inventoryItem.isActive === false) || ('isActive' in stock.warehouse && stock.warehouse.isActive === false))
  const available =
    stock && !inactive && !selectedStock.isError && !selectedStock.isFetching && !stocksLoading && !stocksError ? parseStockCents(stock.availableQuantity) : null
  const unit = stock?.inventoryItem.unit?.trim()
  const amount = parseStockCents(quantity)
  const quantityError = !quantity.trim()
    ? ''
    : amount === null
      ? 'Enter a quantity with up to two decimals.'
      : amount <= 0n
        ? 'Quantity must be greater than zero.'
        : stock && available === null
          ? 'Available stock is unavailable.'
          : available !== null && amount > available
            ? 'Quantity cannot exceed available stock.'
            : ''
  const valid =
    !!stock &&
    Number.isSafeInteger(stock.id) &&
    stock.id > 0 &&
    ['DAMAGED', 'SPOILED'].includes(condition) &&
    amount !== null &&
    amount > 0n &&
    available !== null &&
    amount <= available &&
    !!reason.trim() &&
    confirmed
  const canReport = !!user && (isAdmin || isManager || isStaff)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    setError('')
    if (!canReport) return setError('Your account cannot report stock conditions.')
    let report = pendingReport
    if (!report) {
      const amount = parseStockCents(quantity)
      if (!stock) return setError('Select a warehouse and product stock record.')
      if (
        !Number.isSafeInteger(stock.id) ||
        stock.id <= 0 ||
        !['DAMAGED', 'SPOILED'].includes(condition) ||
        amount === null ||
        amount <= 0n ||
        available === null ||
        amount > available
      )
        return setError(
          'Enter a positive quantity with up to two decimals within the current available stock.',
        )
      if (!reason.trim()) return setError('Enter a reason for this stock condition report.')
      if (!confirmed)
        return setError('Confirm the product, warehouse, condition, and quantity before reporting.')
      report = {
        payload: {
          stockItemId: stock.id,
          condition,
          quantity: decimalString(amount),
          reason: reason.trim(),
          requestId: crypto.randomUUID(),
        },
        uncertain: true,
      }
    }
    inFlight.current = true
    try {
      // Persist before sending so a timeout or navigation cannot silently create a second logical report.
      sessionStorage.setItem(storageKey, JSON.stringify({ ...report, uncertain: true }))
    } catch {
      inFlight.current = false
      setError(
        'This browser could not retain the report for safe retries. Allow session storage before submitting.',
      )
      return
    }
    try {
      setPendingReport(report)
      await mutation.mutateAsync(report.payload)
      sessionStorage.removeItem(storageKey)
      toast.success('Stock condition reported. Warehouse balances have been refreshed.')
      onClose()
    } catch (cause) {
      const status = getApiError(cause)?.status
      const failed = { ...report, uncertain: !status || status >= 500 }
      setPendingReport(failed)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(failed))
      } catch {
        /* The original frozen payload is already saved with an uncertain outcome. */
      }
      setError(getErrorMessage(cause))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !mutation.isPending && onClose()}>
      <DialogContent
        closeDisabled={mutation.isPending}
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Report Stock Condition</DialogTitle>
          <DialogDescription>
            Report damaged or spoiled stock at its warehouse. Reported units become unavailable for
            sale.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {pendingReport && (
            <Alert>
              <AlertDescription>
                {pendingReport.uncertain
                  ? 'The outcome of this report is not yet confirmed. Retry the same report to check and finish it safely.'
                  : 'This report was not accepted. Retry the same values, or edit it as a different report.'}
              </AlertDescription>
            </Alert>
          )}
          <fieldset
            disabled={mutation.isPending || !!pendingReport || !canReport}
            className="flex min-w-0 flex-col gap-4"
          >
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="condition-warehouse">Warehouse</Label>
                <CursorLookup<{ id: number; name: string }>
                  id="condition-warehouse" path="/warehouses" filter={{ includeInactive: 'false' }} value={resolvedWarehouseId}
                  onChange={(value) => {
                    if (value === resolvedWarehouseId) return
                    setWarehouseId(value)
                    setStockId('')
                    setConfirmed(false)
                    setError('')
                  }}
                  getLabel={row => row.name} selectedLabel={stock?.warehouse.name} label="Warehouse" ariaLabel="Warehouse"
                  disabled={mutation.isPending || !!pendingReport || !canReport}
                />
              </div>
              <fieldset
                disabled={!resolvedWarehouseId || stocksLoading || stocksError}
                className="flex min-w-0 flex-col gap-2"
              >
                <Label htmlFor="condition-stock">Product</Label>
                <CursorLookup<StockItemWithRelations>
                  key={resolvedWarehouseId} id="condition-stock" path={`/stock-items/warehouses/${resolvedWarehouseId}`}
                  value={stockId} onChange={(value) => { setStockId(value); setConfirmed(false); setError('') }}
                  getLabel={productStockLabel} selectedLabel={stock ? productStockLabel(stock) : undefined}
                  label="Product" ariaLabel="Product" disabled={!resolvedWarehouseId || mutation.isPending || !!pendingReport || !canReport}
                />
              </fieldset>
            </div>
            {inactive && <p role="alert">The selected product or warehouse is inactive. Choose an active stock record.</p>}
            {selectedStock.isError && <p role="alert">Selected stock record unavailable. <Button type="button" variant="link" onClick={() => void selectedStock.refetch()}>Retry selected stock</Button></p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="condition-kind">Condition</Label>
              <Select
                value={condition}
                onValueChange={(value) => setCondition(value as QuarantineCondition)}
              >
                <SelectTrigger id="condition-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                    <SelectItem value="SPOILED">Spoiled</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Label htmlFor="condition-quantity">Quantity{unit ? ` (${unit})` : ''}</Label>
                {(stock || stocksLoading || stocksError) && (
                  <span
                    id="condition-quantity-help"
                    role="status"
                    className="ml-auto text-right text-xs text-muted-foreground"
                  >
                    {stocksLoading
                      ? 'Loading stock...'
                      : available === null
                        ? 'Available stock unavailable'
                        : `${formatStockCents(available)}${unit ? ` ${unit}` : ''} available`}
                  </span>
                )}
              </div>
              <Input
                id="condition-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value)
                  setError('')
                }}
                aria-invalid={!!quantityError}
                aria-describedby={
                  [
                    (stock || stocksLoading || stocksError) && 'condition-quantity-help',
                    quantityError && 'condition-quantity-error',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                required
              />
              {quantityError && (
                <p id="condition-quantity-error" role="alert" className="text-xs text-destructive">
                  {quantityError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="condition-reason">Reason</Label>
              <Input
                id="condition-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>
            <Label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 size-4 shrink-0"
              />
              I confirm the product, warehouse, condition, and quantity.
            </Label>
          </fieldset>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              Close
            </Button>
            {pendingReport && !pendingReport.uncertain && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.removeItem(storageKey)
                  setPendingReport(undefined)
                  setConfirmed(false)
                  setError('')
                }}
                disabled={mutation.isPending}
              >
                Edit report
              </Button>
            )}
            {/* A frozen retry remains valid even if its first attempt already reduced availability. */}
            <Button
              type="submit"
              disabled={mutation.isPending || !canReport || (!pendingReport && !valid)}
            >
              {mutation.isPending
                ? 'Reporting...'
                : pendingReport
                  ? 'Retry same report'
                  : 'Report Stock Condition'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
