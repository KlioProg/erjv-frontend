import { deliveryFormStyles } from './delivery-form.styles'
import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useOutgoingDeliveryById,
  useCompleteOutgoingDelivery,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useAllProducts } from '@/features/products/products.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import { parseStockCents, formatStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { getErrorMessage } from '@/lib/api-client'

const fields = [
  ['deliveredQuantity', 'Delivered'],
  ['returnedSellableQuantity', 'Returned sellable'],
  ['returnedDamagedQuantity', 'Returned damaged'],
  ['missingQuantity', 'Missing'],
] as const
type Counts = Record<(typeof fields)[number][0] | 'discrepancyReason', string>
type Outcome = 'all' | 'exceptions'

export function CompleteDeliveryModal({
  deliveryId,
  onClose,
}: {
  deliveryId: number
  onClose: () => void
}) {
  const query = useOutgoingDeliveryById(deliveryId)
  const complete = useCompleteOutgoingDelivery()
  const { isAdmin, isManager } = useAuth()
  const delivery = query.data
  const order = useSalesOrderById(delivery?.salesOrderId)
  const products = useAllProducts()
  const warehouses = useWarehouses()
  const clients = useClients()
  const [counts, setCounts] = useState<Record<number, Partial<Counts>>>({})
  const [selection, setSelection] = useState<{ outcome: Outcome; signature: string } | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [error, setError] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inFlight = useRef(false)
  const signature = JSON.stringify([
    deliveryId,
    delivery?.status,
    delivery?.items.map((item) => [item.id, item.loadedQuantity ?? item.quantity]),
  ])
  const outcome = selection?.signature === signature ? selection.outcome : null
  const rows = (delivery?.items ?? []).map((item) => {
    const line = order.data?.items.find((line) => line.id === item.salesOrderItemId)
    const product = products.data?.find((product) => product.id === line?.inventoryItemId)
    const warehouse = warehouses.data?.find(
      (warehouse) => warehouse.id === (delivery?.warehouseId ?? item.stockItem?.warehouseId),
    )
    const loaded = parseStockCents(item.loadedQuantity ?? item.quantity)
    const values = fields.map(([field]) => parseStockCents(counts[item.id]?.[field] ?? ''))
    const total = values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n)
    const reasonRequired = (values[2] ?? 0n) > 0n || (values[3] ?? 0n) > 0n
    const invalid = values.some((value) => value === null)
    const balanced = !invalid && loaded !== null && total === loaded
    return { item, product, warehouse, loaded, values, total, reasonRequired, invalid, balanced }
  })
  const lookupsLoading = order.isFetching || products.isFetching || warehouses.isFetching
  const detailsUnavailable =
    order.isError ||
    products.isError ||
    warehouses.isError ||
    !order.data ||
    rows.some((row) => !row.product?.name || !row.product.unit || !row.warehouse)
  const invalidLines =
    !rows.length ||
    new Set(rows.map((row) => row.item.id)).size !== rows.length ||
    rows.some(
      (row) => !Number.isSafeInteger(row.item.id) || row.item.id <= 0 || row.loaded === null,
    )
  const disabled =
    needsRefresh || refreshing ||
    complete.isPending ||
    query.isFetching ||
    query.isError ||
    !delivery ||
    lookupsLoading ||
    detailsUnavailable ||
    invalidLines ||
    delivery.status !== 'DISPATCHED' ||
    !(isAdmin || isManager)
  const validOutcome =
    outcome === 'all' ||
    (outcome === 'exceptions' &&
      rows.every(
        (row) =>
          row.balanced && (!row.reasonRequired || counts[row.item.id]?.discrepancyReason?.trim()),
      ))
  const chooseOutcome = (next: Outcome) => {
    if (
      next === 'all' &&
      outcome === 'exceptions' &&
      Object.values(counts).some((line) => Object.values(line).some((value) => value?.trim()))
    ) {
      setConfirmAll(true)
      return
    }
    setSelection({ outcome: next, signature })
    setConfirmAll(false)
    setError('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !complete.isPending && onClose()}>
      <DialogContent
        closeDisabled={complete.isPending}
        className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 px-6 pr-14 pt-6">
          <DialogTitle>Complete Delivery</DialogTitle>
          <DialogDescription>
            {delivery?.deliveryNumber || 'Loading delivery...'} ·{' '}
            {clients.data?.find((client) => client.id === order.data?.clientId)?.name ||
              'Customer unavailable'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={async (event) => {
            event.preventDefault()
            if (disabled || inFlight.current || confirmAll || !validOutcome) return
            setError('')
            try {
              const items = rows.map((row) => {
                const values = outcome === 'all' ? [row.loaded!, 0n, 0n, 0n] : row.values
                if (
                  values.some((value) => value === null) ||
                  values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n) !== row.loaded
                )
                  throw Error('Account for the exact loaded quantity for each product.')
                const reason =
                  outcome === 'exceptions' && row.reasonRequired
                    ? counts[row.item.id]?.discrepancyReason?.trim()
                    : undefined
                if ((values[2]! > 0n || values[3]! > 0n) && !reason)
                  throw Error('Damage or missing goods require a discrepancy reason.')
                return {
                  outgoingDeliveryItemId: row.item.id,
                  deliveredQuantity: decimalString(values[0]!),
                  returnedSellableQuantity: decimalString(values[1]!),
                  returnedDamagedQuantity: decimalString(values[2]!),
                  missingQuantity: decimalString(values[3]!),
                  ...(reason ? { discrepancyReason: reason } : {}),
                }
              })
              inFlight.current = true
              await complete.mutateAsync({ id: deliveryId, payload: { items } })
              onClose()
            } catch (cause) {
              setNeedsRefresh(true)
              setError(getErrorMessage(cause))
            } finally {
              inFlight.current = false
            }
          }}
        >
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
            {!(isAdmin || isManager) && <Alert><AlertDescription>You do not have permission to complete deliveries.</AlertDescription></Alert>}
            <Button type="button" variant="link" disabled={complete.isPending || refreshing} onClick={async () => {
              setRefreshing(true)
              try {
                const results = await Promise.all([query.refetch(), order.refetch(), products.refetch(), warehouses.refetch()])
                if (results.some((result) => result.isError)) throw new Error('Delivery details could not be refreshed.')
                setNeedsRefresh(false)
                setError('')
              } catch (cause) { setError(getErrorMessage(cause)) }
              finally { setRefreshing(false) }
            }}>Refresh delivery data</Button>
            {(error || query.isError) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error || 'The latest delivery could not be loaded. Close and retry.'}
                </AlertDescription>
              </Alert>
            )}
            {(lookupsLoading || detailsUnavailable) && (
              <Alert variant={lookupsLoading ? 'default' : 'destructive'}>
                <AlertDescription>
                  {lookupsLoading
                    ? 'Loading product and warehouse details...'
                    : 'Product or warehouse details are unavailable. Close and retry before confirming.'}
                </AlertDescription>
              </Alert>
            )}
            {delivery && invalidLines && (
              <Alert variant="destructive">
                <AlertDescription>
                  Loaded products are missing, repeated, or have an invalid quantity. Close and
                  reload.
                </AlertDescription>
              </Alert>
            )}
            {delivery && delivery.status !== 'DISPATCHED' && (
              <Alert variant="destructive">
                <AlertDescription>
                  This delivery is no longer in transit. Close and review its current status.
                </AlertDescription>
              </Alert>
            )}
            {selection && !outcome && (
              <Alert>
                <AlertDescription>
                  Loaded quantities changed. Review the current products and choose the delivery
                  outcome again. Your exception entries have been kept.
                </AlertDescription>
              </Alert>
            )}
            <section aria-labelledby="completion-loaded-heading" className="flex flex-col gap-3">
              <h3 id="completion-loaded-heading" className="text-sm font-medium">
                Loaded products
              </h3>
              <ul className="flex flex-col gap-3">
                {rows.map((row) => (
                  <li
                    key={row.item.id}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {row.product?.name ||
                          (lookupsLoading ? 'Loading product...' : 'Product unavailable')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[row.product?.variety, row.product?.unit, row.warehouse?.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="tabular-nums">
                      {formatStockCents(row.loaded)} {row.product?.unit} loaded
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">
                Did the customer receive all the goods?
              </legend>
              <Label className={deliveryFormStyles.outcomeChoice}>
                <input
                  type="radio"
                  name="delivery-outcome"
                  value="all"
                  checked={outcome === 'all'}
                  onChange={() => chooseOutcome('all')}
                  className={deliveryFormStyles.outcomeRadio}
                />
                Yes, everything was delivered
              </Label>
              <Label className={deliveryFormStyles.outcomeChoice}>
                <input
                  type="radio"
                  name="delivery-outcome"
                  value="exceptions"
                  checked={outcome === 'exceptions'}
                  onChange={() => chooseOutcome('exceptions')}
                  className={deliveryFormStyles.outcomeRadio}
                />
                No, there were returns or missing goods
              </Label>
            </fieldset>
            {confirmAll && (
              <Alert>
                <AlertDescription>
                  <p>
                    Confirm everything was delivered? This replaces the exception outcome. Your
                    entries will be kept if you switch back.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => setConfirmAll(false)}
                    >
                      Keep exceptions
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        setSelection({ outcome: 'all', signature })
                        setConfirmAll(false)
                        setError('')
                      }}
                    >
                      Confirm everything delivered
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {outcome === 'all' && (
              <Alert>
                <AlertDescription>
                  All loaded goods will be recorded as delivered. No sellable returns, damaged
                  returns, or missing goods.
                </AlertDescription>
              </Alert>
            )}
            {outcome === 'exceptions' && (
              <section className="flex flex-col gap-5" aria-label="Product reconciliation">
                {rows.map((row, index) => (
                  <fieldset
                    key={row.item.id}
                    disabled={disabled || confirmAll}
                    className="flex min-w-0 flex-col gap-3 border-t pt-4"
                  >
                    <legend className="max-w-full break-words pr-3 text-sm font-medium">
                      {row.product?.name || 'Product unavailable'}
                      {row.product?.variety ? ` · ${row.product.variety}` : ''}
                    </legend>
                    <p className="text-xs text-muted-foreground">
                      Loaded: {formatStockCents(row.loaded)} {row.product?.unit}
                    </p>
                    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">
                      {fields.map(([field, label]) => {
                        const value = counts[row.item.id]?.[field] ?? ''
                        const invalid = !!value && parseStockCents(value) === null
                        return (
                          <div key={field} className="flex min-w-0 flex-col gap-1.5">
                            <Label htmlFor={`completion-${row.item.id}-${field}`}>{label}</Label>
                            <Input
                              id={`completion-${row.item.id}-${field}`}
                              inputMode="decimal"
                              value={value}
                              aria-label={`${label} for ${row.product?.name || 'unavailable product'} (${index + 1})`}
                              aria-invalid={invalid}
                              aria-describedby={`completion-balance-${row.item.id}`}
                              onChange={(event) =>
                                setCounts((current) => ({
                                  ...current,
                                  [row.item.id]: {
                                    ...current[row.item.id],
                                    [field]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                    <p
                      id={`completion-balance-${row.item.id}`}
                      aria-live="polite"
                      className="text-xs"
                    >
                      Accounted for: {formatStockCents(row.total)} / {formatStockCents(row.loaded)}{' '}
                      {row.product?.unit}.
                      {row.invalid
                        ? ' Enter all four quantities with up to two decimals.'
                        : !row.balanced
                          ? ' Quantities must equal the loaded amount.'
                          : ' Balanced.'}
                    </p>
                    {row.reasonRequired && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`completion-reason-${row.item.id}`}>
                          Discrepancy Reason (required)
                        </Label>
                        <Input
                          id={`completion-reason-${row.item.id}`}
                          aria-label={`Discrepancy Reason for ${row.product?.name || 'unavailable product'} (${index + 1})`}
                          value={counts[row.item.id]?.discrepancyReason ?? ''}
                          required
                          onChange={(event) =>
                            setCounts((current) => ({
                              ...current,
                              [row.item.id]: {
                                ...current[row.item.id],
                                discrepancyReason: event.target.value,
                              },
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Explain the damaged or missing goods.
                        </p>
                      </div>
                    )}
                  </fieldset>
                ))}
              </section>
            )}
            {outcome && (
              <p className="text-xs text-muted-foreground">
                Delivered goods count toward order fulfillment. The system reconciles returns,
                tracks damaged goods, and updates vehicle availability.
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={complete.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled || !validOutcome || confirmAll}>
              {complete.isPending ? 'Completing...' : 'Confirm Completion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
