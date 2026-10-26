import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import {
  useQuarantineLots,
  useRefreshQuarantine,
  useResolveQuarantine,
} from '@/features/logistics/quarantine.hooks'
import type { QuarantineLot, StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { ManualQuarantineDialog } from './ManualQuarantineDialog'
import { CorrectQuarantineConditionDialog } from './CorrectQuarantineConditionDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function sourceLabel(lot: QuarantineLot) {
  if (lot.incomingDeliveryItemId != null)
    return `Incoming delivery item #${lot.incomingDeliveryItemId}`
  if (lot.outgoingDeliveryItemId != null)
    return `Outgoing return item #${lot.outgoingDeliveryItemId}`
  if (lot.sourceKind === 'INCOMING_DELIVERY') return 'Incoming receiving (item details unavailable)'
  if (lot.sourceKind === 'OUTGOING_DELIVERY') return 'Outgoing return (item details unavailable)'
  return lot.sourceKind === 'MANUAL' ? 'Manual quarantine' : 'Source details unavailable'
}

function quantityLabel(value: string | undefined, stock?: StockItemWithRelations) {
  return `${formatStockCents(parseStockCents(value))} ${formatProductUnit(stock?.inventoryItem?.unit, 'units')}`
}

export function QuarantinedStock({
  stockItemId,
  onOpenWarehouse,
}: {
  stockItemId?: number
  onOpenWarehouse?: (warehouseId: number) => void
}) {
  const lots = useQuarantineLots(stockItemId)
  const { user } = useAuth()
  const canTag = ['ADMIN', 'MANAGER', 'SUPERADMIN', 'STAFF'].includes(user?.role ?? '')
  const [tagOpen, setTagOpen] = useState(false)
  const stocks = useStockItems({ includeInactive: 'true' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const selected = lots.data?.find((lot) => lot.id === selectedId)
  const stockMap = new Map(stocks.data?.map((stock) => [stock.id, stock]))
  const columns: ColumnDef<QuarantineLot>[] = [
    {
      id: 'product',
      header: 'Product',
      width: 220,
      sortable: true,
      sortKey: (lot) => stockMap.get(lot.stockItemId)?.inventoryItem?.name ?? '',
      cell: ({ row }) => <OverflowValue value={stockMap.get(row.stockItemId)?.inventoryItem?.name ?? `Stock item #${row.stockItemId}`} />,
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      width: 180,
      sortable: true,
      sortKey: (lot) => stockMap.get(lot.stockItemId)?.warehouse?.name ?? '',
      cell: ({ row }) => {
        const stock = stockMap.get(row.stockItemId)
        return stock && onOpenWarehouse ? (
          <OverflowValue value={stock.warehouse?.name ?? `Warehouse #${stock.warehouseId}`} onActivate={() => onOpenWarehouse(stock.warehouseId)} />
        ) : (
          <OverflowValue value={stock?.warehouse?.name ?? 'Warehouse unavailable'} />
        )
      },
    },
    { id: 'lot', header: 'Lot', sortable: true, sortKey: 'id', cell: ({ row }) => `#${row.id}` },
    { id: 'source', header: 'Source', cell: ({ row }) => <OverflowValue value={sourceLabel(row)} /> },
    { id: 'condition', header: 'Condition', accessorKey: 'condition' },
    ...(['initialQuantity', 'remainingQuantity'] as const).map(
      (field): ColumnDef<QuarantineLot> => ({
        id: field,
        header: field === 'initialQuantity' ? 'Initial' : 'Remaining',
        align: 'right',
        sortable: true,
        sortKey: (lot) => stockSortKey(parseStockCents(lot[field])),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {quantityLabel(row[field], stockMap.get(row.stockItemId))}
          </span>
        ),
      }),
    ),
    {
      id: 'date',
      header: 'Date recorded',
      sortable: true,
      sortKey: 'createdAt',
      cell: ({ row }) => <OverflowValue value={new Date(row.createdAt).toLocaleString()} />,
    },
    {
      id: 'actions',
      header: 'Details',
      width: 180,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          {parseStockCents(row.remainingQuantity) === 0n && (
            <Badge variant="secondary">No remaining quarantine</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedId(row.id)}
            aria-label={`View quarantine lot #${row.id}`}
          >
            View lot
          </Button>
        </div>
      ),
    },
  ]
  const term = search.trim().toLowerCase()
  const filtered = (lots.data ?? []).filter((lot) => {
    const stock = stockMap.get(lot.stockItemId)
    return (
      (!openOnly || (parseStockCents(lot.remainingQuantity) ?? 0n) > 0n) &&
      (!term ||
        `${lot.id} ${stock?.inventoryItem?.name ?? ''} ${stock?.warehouse?.name ?? ''}`
          .toLowerCase()
          .includes(term))
    )
  })
  const error = lots.isError || stocks.isError
  const loadError = lots.error ?? stocks.error
  const status = isAxiosError(loadError) ? loadError.response?.status : undefined
  const loadGuidance =
    status === 401 || status === 403 || (isAxiosError(loadError) && !loadError.response)
      ? getErrorMessage(loadError)
      : 'Select Refresh to try again. If the problem continues, contact your administrator.'
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Quarantined goods are held from available stock. Lots are recorded when damaged quantities
        are confirmed during incoming receiving or outgoing delivery returns, or recorded after a warehouse inspection. View a lot to inspect
        its source and remaining quantity.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {canTag && <Button variant="outline" disabled={lots.isError || stocks.isError || lots.isFetching || stocks.isFetching} onClick={() => setTagOpen(true)}>Quarantine stock</Button>}
        <Input
          aria-label="Search quarantine lots"
          placeholder="Search product, warehouse, or lot"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="quarantine-open-only"
            checked={openOnly}
            onCheckedChange={(value) => setOpenOnly(value === true)}
          />
          <Label htmlFor="quarantine-open-only">Only lots with remaining quarantine</Label>
        </div>
        <Button
          variant="outline"
          disabled={lots.isFetching || stocks.isFetching}
          onClick={() => {
            void lots.refetch()
            void stocks.refetch()
          }}
        >
          Refresh
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Unable to load quarantined stock. {loadGuidance}
          </AlertDescription>
        </Alert>
      )}
      <DataTable
        data={error ? [] : filtered}
        columns={columns}
        isLoading={lots.isLoading || stocks.isLoading}
        loadingMessage="Loading quarantine lots"
        tableClassName="min-w-[1100px] table-fixed"
        emptyContent={
          error
            ? 'Quarantine data unavailable. Refresh to try again.'
            : lots.data?.length === 0
              ? 'No quarantined stock has been recorded. Lots will appear here after damaged quantities are confirmed during receiving or outgoing returns, or recorded during warehouse inspection.'
              : 'No quarantine lots match this view.'
        }
      />
      {tagOpen && <ManualQuarantineDialog stockItemId={stockItemId} onClose={() => setTagOpen(false)} />}
      {selected && (
        <QuarantineLotDialog
          key={selected.id}
          lot={selected}
          stock={stockMap.get(selected.stockItemId)}
          dataUnavailable={error || lots.isFetching || stocks.isFetching}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function QuarantineLotDialog({
  lot,
  stock,
  dataUnavailable,
  onClose,
}: {
  lot: QuarantineLot
  stock?: StockItemWithRelations
  dataUnavailable: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const canResolve = ['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(user?.role ?? '')
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const mutation = useResolveQuarantine()
  const refresh = useRefreshQuarantine()
  const lock = useRef(false)
  const [action, setAction] = useState<'CLEAR' | 'REMOVE'>('CLEAR')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshRequired, setRefreshRequired] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const balance = parseStockCents(lot.remainingQuantity)
  const product = stock?.inventoryItem?.name ?? `Stock item #${lot.stockItemId}`
  const warehouse = stock?.warehouse?.name ?? 'Warehouse unavailable'
  const remaining = balance !== null && balance > 0n

  const refreshData = async () => {
    setRefreshRequired(true)
    try {
      await refresh()
      setRefreshRequired(false)
    } catch {
      setError((previous) =>
        `${previous} Current inventory could not be refreshed. Refresh before submitting again.`.trim(),
      )
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || !canResolve || !stock || dataUnavailable || refreshRequired) return
    const amount = parseStockCents(quantity)
    if (amount === null || amount <= 0n || balance === null || amount > balance) {
      setFieldError(
        `Enter a positive quantity with at most two decimals, up to ${quantityLabel(lot.remainingQuantity, stock)}.`,
      )
      return
    }
    setFieldError('')
    if (!reason.trim() || (action === 'REMOVE' && !confirmed)) return
    lock.current = true
    setBusy(true)
    setError('')
    let succeeded = false
    try {
      await mutation.mutateAsync({
        lotId: lot.id,
        payload: { action, quantity, reason: reason.trim() },
      })
      succeeded = true
      toast.success(action === 'CLEAR' ? 'Quarantine cleared' : 'Damaged stock removed')
      setQuantity('')
      setReason('')
    } catch (failure) {
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      setError(
        status === 403
          ? 'You are not authorized to resolve quarantined stock.'
          : status === 409
            ? `This lot may have changed, or current inventory or purchasing constraints prevent this resolution. ${getErrorMessage(failure)}`
            : !status || status >= 500
              ? `The result is uncertain. The server may have processed this resolution. Review refreshed balances before deliberately retrying. ${getErrorMessage(failure)}`
              : getErrorMessage(failure),
      )
    }
    setConfirmed(false)
    await refreshData()
    setBusy(false)
    lock.current = false
    if (succeeded) setFieldError('')
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          if (canResolve && (quantity || reason)) setDiscardOpen(true)
          else onClose()
        }
      }}
    >
      <DialogContent closeDisabled={busy} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quarantine lot #{lot.id}</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {product} · {warehouse}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Source', sourceLabel(lot)],
            ['Condition', lot.condition],
            ['Initial quarantine', quantityLabel(lot.initialQuantity, stock)],
            ['Remaining quarantine', quantityLabel(lot.remainingQuantity, stock)],
            ['Date recorded', new Date(lot.createdAt).toLocaleString()],
            ['Physical stock', quantityLabel(stock?.quantity, stock)],
            ['Quarantined stock', quantityLabel(stock?.quarantinedQuantity, stock)],
            ['Damaged stock', quantityLabel(stock?.damagedQuantity, stock)],
            ['Available stock', quantityLabel(stock?.availableQuantity, stock)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {lot.tagReason && <p className="break-words text-sm">Inspection reason: {lot.tagReason}{lot.taggedByUserId != null ? ` · User #${lot.taggedByUserId}` : ''}</p>}
        {((lot.conditionChanges?.length ?? 0) > 0 || (lot.resolutions?.length ?? 0) > 0) && <details className="text-sm"><summary className="cursor-pointer font-medium">Lot audit history</summary><ul className="mt-2 space-y-2 [overflow-wrap:anywhere]">
          {lot.conditionChanges?.map((entry) => <li key={`condition-${entry.id}`}>{entry.fromCondition} → {entry.toCondition}: {entry.reason} · User #{entry.actorUserId} · {new Date(entry.createdAt).toLocaleString()}</li>)}
          {lot.resolutions?.map((entry) => <li key={`resolution-${entry.id}`}>{entry.action} {quantityLabel(entry.quantity, stock)}: {entry.reason} · User #{entry.actorUserId} · {new Date(entry.createdAt).toLocaleString()}</li>)}
        </ul></details>}
        {canResolve && remaining && <Button variant="outline" disabled={busy || dataUnavailable || refreshRequired || !stock} onClick={() => setCorrectionOpen(true)}>Correct condition</Button>}
        {correctionOpen && <CorrectQuarantineConditionDialog lot={lot} onClose={() => setCorrectionOpen(false)} />}
        <p className="text-xs text-muted-foreground">
          Physical stock may include quarantined goods. Quarantined stock is held from availability.
          Available stock is calculated by the backend and is eligible for further operations.
        </p>
        {!stock && (
          <Alert>
            <AlertDescription>
              Product and warehouse context is unavailable. Refresh inventory before resolving this
              lot.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription role="alert">{error}</AlertDescription>
          </Alert>
        )}
        {refreshRequired && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await refreshData()
              setBusy(false)
            }}
          >
            Refresh inventory before retrying
          </Button>
        )}
        {canResolve && remaining ? (
          <form
            onSubmit={(event) => {
              void submit(event)
            }}
            className="flex flex-col gap-4"
          >
            <fieldset
              disabled={busy || dataUnavailable || refreshRequired || !stock}
              className="flex flex-col gap-4"
            >
              <legend className="mb-2 text-sm font-medium">Resolve quarantine</legend>
              <div className="flex flex-wrap gap-4">
                <Label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="quarantine-action"
                    checked={action === 'CLEAR'}
                    onChange={() => {
                      setAction('CLEAR')
                      setConfirmed(false)
                    }}
                  />
                  Clear Quarantine
                </Label>
                <Label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="quarantine-action"
                    checked={action === 'REMOVE'}
                    onChange={() => {
                      setAction('REMOVE')
                      setConfirmed(false)
                    }}
                  />
                  Remove Damaged Stock
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {action === 'CLEAR'
                  ? 'Release the selected quantity from quarantine according to the inventory rules.'
                  : 'Permanently remove the selected quantity from physical inventory.'}
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quarantine-quantity">Quantity</Label>
                <Input
                  id="quarantine-quantity"
                  inputMode="decimal"
                  placeholder="0"
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value)
                    setConfirmed(false)
                    setFieldError('')
                  }}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? 'quarantine-quantity-error' : undefined}
                />
                {fieldError && (
                  <p
                    id="quarantine-quantity-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {fieldError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quarantine-reason">Reason (required)</Label>
                <Textarea
                  id="quarantine-reason"
                  required
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setConfirmed(false)
                  }}
                />
              </div>
              {action === 'REMOVE' && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="quarantine-confirm"
                    checked={confirmed}
                    onCheckedChange={(value) => setConfirmed(value === true)}
                  />
                  <Label htmlFor="quarantine-confirm" className="text-destructive">
                    I confirm permanent removal of {quantity || '0'}{' '}
                    {formatProductUnit(stock?.inventoryItem?.unit, 'units')} of {product} from{' '}
                    {warehouse}.
                  </Label>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="submit"
                  variant={action === 'REMOVE' ? 'destructive' : 'default'}
                  disabled={busy || !reason.trim() || (action === 'REMOVE' && !confirmed)}
                >
                  {busy
                    ? 'Processing…'
                    : action === 'CLEAR'
                      ? 'Clear Quarantine'
                      : 'Remove Damaged Stock'}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {remaining
              ? 'Only managers and admins can resolve quarantined stock.'
              : 'This lot has no remaining quarantine to resolve.'}
          </p>
        )}
        <ConfirmDeleteModal
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onConfirm={onClose}
          title="Discard unsaved resolution?"
          description="Your entered quantity and reason will be lost. No resolution will be submitted."
          confirmText="Discard Changes"
          cancelText="Keep Editing"
        />
      </DialogContent>
    </Dialog>
  )
}
