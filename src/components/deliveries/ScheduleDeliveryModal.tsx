import { useState, type FormEvent } from 'react'
import { DeliveryFormDialog, DeliveryFormFooter } from './shared/DeliveryFormDialog'
import { deliveryFormStyles } from './shared/delivery-form.styles'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { CursorLookup } from '@/components/ui/CursorLookup'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useOutgoingPlanning } from '@/features/logistics/use-outgoing-planning'
import { outgoingOrderRemaining } from '@/features/logistics/outgoing-planning'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { SalesOrderItemRecord } from '@/features/crm/sales-orders.types'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { formatStockCents } from '@/features/logistics/stock-display'

interface ScheduleDeliveryModalProps {
  open: boolean
  onClose: () => void
  preselectedOrderId?: number
  onScheduled?: (delivery: OutgoingDeliveryRecord) => void
  onSaved?: (delivery: OutgoingDeliveryRecord) => void
  onViewDeliveries?: (salesOrderId: number) => void
  onViewDelivery?: (delivery: OutgoingDeliveryRecord) => void
  draftId?: number
}
const description =
  'Choose a sales order and warehouse, then commit planned quantities as READY. Departure is scheduled on a Delivery Run.'
function formatQuantity(value: string | null | undefined): string {
  const parsed = parseOrderDecimal(value ?? '')
  return parsed === null ? 'Unavailable' : decimalString(parsed)
}

export function ScheduleDeliveryModal(props: ScheduleDeliveryModalProps) {
  const draftQuery = useOutgoingDeliveryById(props.draftId)
  const [initialDraft, setInitialDraft] = useState<OutgoingDeliveryRecord | null>(null)
  if (
    props.draftId &&
    !initialDraft &&
    draftQuery.isFetchedAfterMount &&
    !draftQuery.isError &&
    draftQuery.data
  ) {
    setInitialDraft(draftQuery.data)
  }
  if (props.draftId && !initialDraft) {
    return (
      <DeliveryFormDialog
        open={props.open}
        onClose={props.onClose}
        busy={false}
        title="Plan Outgoing Delivery"
        description={description}
      >
        <div role={draftQuery.isFetching ? 'status' : 'alert'}>
          {draftQuery.isFetching
            ? 'Loading saved delivery draft...'
            : 'The saved delivery could not be loaded.'}
          {!draftQuery.isFetching && (
            <Button type="button" variant="link" onClick={() => void draftQuery.refetch()}>
              Retry loading draft
            </Button>
          )}
        </div>
      </DeliveryFormDialog>
    )
  }
  return (
    <OutgoingPlanningForm key={props.draftId ?? 'new'} {...props} initialDraft={initialDraft} />
  )
}

function OutgoingPlanningForm({
  open,
  onClose,
  preselectedOrderId,
  onScheduled,
  onSaved,
  onViewDeliveries,
  onViewDelivery,
  initialDraft,
}: ScheduleDeliveryModalProps & { initialDraft?: OutgoingDeliveryRecord | null }) {
  const form = useOutgoingPlanning(initialDraft, preselectedOrderId)
  const [notesOpen, setNotesOpen] = useState(false)
  const { order, errors, savedDraft, latestDraft, busy } = form
  const dismiss = () => {
    if (!busy) onClose()
  }
  const readOnly = busy || form.reviewRequired || (!!savedDraft && savedDraft.status !== 'DRAFT')
  const orderLabel = (candidate: SalesOrderRecord) =>
    `${candidate.orderNumber} / Customer #${candidate.clientId}`
  const fieldError = (field: string, message = errors[field]) =>
    message ? (
      <p id={`delivery-${field}-error`} role="alert" className="text-xs text-destructive">
        {message}
      </p>
    ) : null
  const remaining = (item: SalesOrderItemRecord) =>
    outgoingOrderRemaining(
      form.orderOptions.find(
        (option) =>
          option.salesOrderItemId === item.id && option.inventoryItemId === item.inventoryItemId,
      ),
    )
  const fullyPlanned =
    !form.planningLoading &&
    !form.loadFailed &&
    !savedDraft &&
    !!order?.items.length &&
    order.items.every((item) => remaining(item) === '0.00')
  const unknownPlanning = !!order?.items.some((item) => remaining(item) === null)
  const unavailableEnteredLines = savedDraft
    ? []
    : (order?.items ?? []).filter(
        (item) =>
          remaining(item) === '0.00' &&
          (parseOrderDecimal(form.quantities[item.id] ?? '') ?? 0n) > 0n,
      )
  const rows = (order?.items ?? []).filter(
    (item) => savedDraft || (parseOrderDecimal(remaining(item) ?? '') ?? 0n) > 0n,
  )
  const hasPlannableDemand = rows.some(
    (item) =>
      (parseOrderDecimal(
        form.options.find((option) => option.salesOrderItemId === item.id)
          ?.maximumPlannableQuantity ?? '',
      ) ?? 0n) > 0n,
  )
  const columns: ColumnDef<SalesOrderItemRecord>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => {
        const product = form.products.find((product) => product.id === row.inventoryItemId)
        return (
          <div className="min-w-32 text-[13px]">
            <p className="font-medium">{product?.name || `Product #${row.inventoryItemId}`}</p>
            <p className="text-xs text-muted-foreground">
              {[product?.variety, product?.unit].filter(Boolean).join(' · ')}
            </p>
          </div>
        )
      },
    },
    {
      id: 'remaining',
      header: 'Remaining',
      align: 'right',
      cell: ({ row }) =>
        formatQuantity(
          outgoingOrderRemaining(form.options.find((option) => option.salesOrderItemId === row.id)),
        ),
    },
    {
      id: 'committed',
      header: 'Committed',
      align: 'right',
      cell: ({ row }) => formatQuantity(form.options.find((option) => option.salesOrderItemId === row.id)?.committedQuantity),
    },
    {
      id: 'available',
      header: 'Warehouse Available',
      align: 'right',
      cell: ({ row }) => <div className="flex flex-col gap-1"><span>{formatQuantity(form.options.find((option) => option.salesOrderItemId === row.id)?.availableQuantity)}</span>
        <span className="text-xs text-muted-foreground">Shortfall: {formatQuantity(form.options.find((option) => option.salesOrderItemId === row.id)?.shortfallQuantity)}</span></div>,
    },
    {
      id: 'quantity',
      header: 'Planned Quantity',
      align: 'center',
      width: '34%',
      cell: ({ row }) => {
        const product = form.products.find((product) => product.id === row.inventoryItemId)
        const option = form.options.find((option) => option.salesOrderItemId === row.id)
        const field = `quantity-${row.id}`
        const maximum = parseOrderDecimal(option?.maximumPlannableQuantity ?? '')
        const quantity = parseOrderDecimal(form.quantities[row.id] || '0')
        const maximumHint = `Max ${formatStockCents(maximum)} ${product?.unit || 'units'}`
        const hint = !form.warehouseId
          ? 'Select a source warehouse.'
          : form.planningLoading
            ? 'Loading warehouse availability...'
            : !option
              ? 'Planning availability is unavailable. Retry loading.'
              : parseOrderDecimal(option.maximumPlannableQuantity) === 0n
                ? 'No planning capacity in this warehouse.'
                : `Maximum planned quantity: ${formatStockCents(maximum)} ${product?.unit || 'units'}.`
        return (
          <div className="mx-auto flex w-28 max-w-full flex-col items-center justify-center gap-1.5 text-center">
            <Input
              id={`delivery-${field}`}
              aria-label={`Quantity to ship for ${product?.name || `Product #${row.inventoryItemId}`}`}
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              title={hint}
              max={option?.maximumPlannableQuantity}
              value={form.quantities[row.id] ?? ''}
              disabled={
                readOnly ||
                !form.activeWarehouse ||
                form.planningLoading ||
                !option ||
                (maximum === 0n && quantity === 0n)
              }
              onChange={(event) => form.changeQuantity(row.id, event.target.value)}
              aria-invalid={!!errors[field]}
              aria-describedby={`delivery-${field}-hint${errors[field] ? ` delivery-${field}-error` : ''}`}
              className={`${deliveryFormStyles.control} text-center tabular-nums`}
            />
            <p id={`delivery-${field}-hint`} className="sr-only">
              {hint}
            </p>
            {maximum === 0n && (
              <p className="text-xs text-muted-foreground">
                No planning capacity in this warehouse.
              </p>
            )}
            {fieldError(
              field,
              errors[field] && maximum !== null && quantity !== null && quantity > maximum
                ? maximumHint
                : errors[field],
            )}
          </div>
        )
      },
    },
  ]
  const save = async (intent: 'draft' | 'ready') => {
    const delivery = await form.submit(intent)
    if (delivery) onSaved?.(delivery)
  }
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void save('ready')
  }
  return (
    <DeliveryFormDialog
      open={open}
      onClose={dismiss}
      busy={busy}
      title="Plan Outgoing Delivery"
      description={description}
    >
      {form.completed ? (
        <div className={deliveryFormStyles.form}>
          <div role="status" className={deliveryFormStyles.body}>
            <p className="font-semibold">
              {form.completed === 'READY' ? 'Delivery ready for a run' : 'Delivery draft saved'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {savedDraft?.deliveryNumber} is available in Outgoing Deliveries.{' '}
              {form.completed === 'READY'
                ? 'Add it to a Delivery Run to assign a driver, vehicle, and departure.'
                : 'Mark it ready after reviewing the plan.'}
            </p>
          </div>
          <DeliveryFormFooter>
            {savedDraft && onViewDelivery && (
              <Button variant="outline" onClick={() => onViewDelivery(savedDraft)}>
                View Delivery
              </Button>
            )}
            <Button
              variant="primary-contrast"
              onClick={() => {
                if (form.completed === 'READY' && savedDraft && onScheduled)
                  onScheduled(savedDraft)
                else dismiss()
              }}
              className={deliveryFormStyles.button}
            >
              {form.completed === 'READY' && onScheduled ? 'Continue to Delivery Runs' : 'Done'}
            </Button>
          </DeliveryFormFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className={deliveryFormStyles.form}>
          <div className={deliveryFormStyles.body}>
            {(form.loading || form.loadFailed) && (
              <div
                role={form.loadFailed ? 'alert' : 'status'}
                className={`${deliveryFormStyles.message} ${form.loadFailed ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {!form.loadFailed && (
                  <Spinner aria-hidden="true" className="mr-2 inline-block size-4" />
                )}
                {form.loadFailed
                  ? 'Order or warehouse planning availability could not be loaded.'
                  : 'Loading orders and planning availability...'}
                {form.loadFailed && (
                  <Button
                    type="button"
                    variant="link"
                    className={deliveryFormStyles.retry}
                    onClick={() => void form.refresh()}
                  >
                    Retry loading
                  </Button>
                )}
              </div>
            )}
            {fieldError('request')}
            {savedDraft && (
              <p role="status" className={`${deliveryFormStyles.message} text-muted-foreground`}>
                Draft {savedDraft.deliveryNumber} · Revision {savedDraft.revision}. Saving and
                readiness use this same draft.
              </p>
            )}
            {form.reviewRequired && (
              <section
                aria-label="Latest delivery review"
                className="mb-4 flex flex-col gap-2 rounded-md border p-3 text-xs"
              >
                {latestDraft ? (
                  <>
                    <p className="font-medium">
                      Latest saved delivery: revision {latestDraft.revision} · {latestDraft.status}
                    </p>
                    <p>
                      Warehouse:{' '}
                      {(form.warehouse?.id === latestDraft.warehouseId ? form.warehouse.name : null) ||
                        (latestDraft.warehouseId
                          ? `Warehouse #${latestDraft.warehouseId}`
                          : 'Unselected')}
                    </p>
                    <p>Notes: {latestDraft.notes || 'None'}</p>
                    <ul className="list-inside list-disc">
                      {(latestDraft.plannedItems ?? []).map((item) => (
                        <li key={item.salesOrderItemId}>
                          Order line #{item.salesOrderItemId}: {item.plannedQuantity}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Load the latest draft to replace your unsaved input. Review it before saving
                      or marking it ready again.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="self-start"
                      onClick={form.loadLatest}
                    >
                      Load latest draft
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => void form.retryLatest()}>
                    Retry loading latest draft
                  </Button>
                )}
                {fieldError('review')}
              </section>
            )}
            {savedDraft && savedDraft.status !== 'DRAFT' && (
              <p role="alert" className={deliveryFormStyles.message}>
                This delivery is {savedDraft.status.toLowerCase()} and cannot be edited here.
              </p>
            )}
            {Object.entries(errors)
              .filter(
                ([field]) =>
                  field.startsWith('quantity-') &&
                  !rows.some((row) => field === `quantity-${row.id}`),
              )
              .map(([field, message]) => (
                <p key={field} role="alert" className="mb-3 text-xs text-destructive">
                  Order line #{field.replace('quantity-', '')}: {message}
                </p>
              ))}
            <fieldset disabled={readOnly} className={deliveryFormStyles.fields}>
              <div className={deliveryFormStyles.grid}>
                <div className={deliveryFormStyles.field}>
                  <Label htmlFor="delivery-sales-order" className={deliveryFormStyles.label}>
                    Sales Order to Fulfill <span className="text-primary">*</span>
                  </Label>
                  {savedDraft ? (
                    <Input
                      id="delivery-sales-order"
                      value={order ? orderLabel(order) : `Sales Order #${savedDraft.salesOrderId}`}
                      readOnly
                      className={deliveryFormStyles.control}
                    />
                  ) : (
                    <CursorLookup<SalesOrderRecord>
                      id="delivery-sales-order" path="/sales-orders"
                      filter={{ statuses: ['CONFIRMED', 'PARTIALLY_DELIVERED'] }}
                      label="Sales Order" ariaLabel="Sales Order to Fulfill"
                      searchPlaceholder="Search order or customer..."
                      value={form.selectedOrderId} onChange={form.changeOrder}
                      getLabel={orderLabel} selectedLabel={order ? orderLabel(order) : undefined}
                      accept={(candidate) => ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(candidate.status)}
                      disabled={readOnly} className={deliveryFormStyles.control}
                    />
                  )}
                  {fieldError('sales-order')}
                  {order && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {order.deliveryAddress}
                    </p>
                  )}
                  {order && !form.eligible && (
                    <p role="alert" className="text-xs text-destructive">
                      This Sales Order is no longer available for planning.
                    </p>
                  )}
                </div>
                <div className={deliveryFormStyles.field}>
                  <Label htmlFor="delivery-warehouse" className={deliveryFormStyles.label}>
                    Stock Source / Warehouse <span className="text-primary">*</span>
                  </Label>
                  <CursorLookup<Warehouse>
                    id="delivery-warehouse" path="/warehouses" filter={{ isActive: true }}
                    label="warehouse" ariaLabel="Stock Source / Warehouse"
                    value={form.warehouseId} onChange={form.changeWarehouse}
                    getLabel={(warehouse) => warehouse.name} selectedLabel={form.warehouse?.name}
                    accept={(warehouse) => warehouse.isActive}
                    disabled={readOnly} className={deliveryFormStyles.control}
                  />
                  {fieldError('warehouse')}
                  {!!form.warehouseId && !form.activeWarehouse && !form.loading && (
                    <p role="alert" className="text-xs text-destructive">
                      The selected warehouse is inactive or unavailable. Choose an active warehouse.
                    </p>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    One warehouse supplies this delivery plan.
                  </p>
                </div>
              </div>
              {!order && !form.loading && (
                <p role="status" className={deliveryFormStyles.empty}>
                  Select an order to view its current products.
                </p>
              )}
              {order && (
                <>
                  <section aria-label="Product planning" className="flex min-w-0 flex-col gap-3">
                    <h2 className={deliveryFormStyles.sectionTitle}>Product planning</h2>
                    <DataTable
                      data={rows}
                      columns={columns}
                      getRowKey={(row) => row.id}
                      pagination={false}
                      appearance="subtle"
                      tableClassName="min-w-[580px] tabular-nums"
                      emptyContent={
                        fullyPlanned ? (
                          <div className="flex flex-col items-center gap-2 p-4 text-sm">
                            <p>All quantities for this Sales Order are already planned.</p>
                            <p className="text-xs text-muted-foreground">
                              View its existing outgoing deliveries or choose another order.
                            </p>
                            {onViewDeliveries && order && (
                              <Button
                                type="button"
                                variant="link"
                                onClick={() => onViewDeliveries(order.id)}
                              >
                                View existing deliveries
                              </Button>
                            )}
                          </div>
                        ) : !form.warehouseId ? (
                          'Select a source warehouse to load planning quantities.'
                        ) : form.planningLoading ? (
                          'Loading planning availability...'
                        ) : (
                          'No known positive planning quantities are available.'
                        )
                      }
                    />
                    {!!form.warehouseId && !form.planningLoading && unknownPlanning && (
                      <p className="text-xs text-muted-foreground">
                        Some planning quantities are unavailable. Reload availability before
                        planning those products.
                      </p>
                    )}
                    {fieldError('plan')}
                    {!!unavailableEnteredLines.length && (
                      <div className="text-xs text-muted-foreground">
                        <p>
                          Some entered quantities are no longer available to plan. Clear those
                          values and review the remaining products.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() =>
                            unavailableEnteredLines.forEach((item) =>
                              form.changeQuantity(item.id, ''),
                            )
                          }
                        >
                          Clear quantities no longer available
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      READY commits order demand, even when stock has a shortfall. Actual goods
                      are loaded and moved into transit only when the Delivery Run is dispatched.
                    </p>
                  </section>
                  <div className="flex flex-col gap-4 border-t pt-4">
                    <details
                      open={notesOpen}
                      onToggle={(event) => setNotesOpen(event.currentTarget.open)}
                    >
                      <summary className={deliveryFormStyles.summary}>
                        Delivery instructions (Optional)
                      </summary>
                      <div hidden={!notesOpen} className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="delivery-notes" className={deliveryFormStyles.label}>
                          Delivery Notes / Instructions
                        </Label>
                        <Input
                          id="delivery-notes"
                          value={form.notes}
                          onChange={(event) => form.setNotes(event.target.value)}
                          placeholder="Loading instructions or gate code..."
                          className={deliveryFormStyles.control}
                        />
                      </div>
                      {!notesOpen && form.notes && (
                        <p
                          className="mt-1 truncate text-xs text-muted-foreground"
                          title={form.notes}
                        >
                          {form.notes}
                        </p>
                      )}
                    </details>
                  </div>
                </>
              )}
            </fieldset>
          </div>
          <DeliveryFormFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={dismiss}
              className={deliveryFormStyles.button}
            >
              {savedDraft ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={
                readOnly ||
                form.loading ||
                form.loadFailed ||
                !form.eligible ||
                !form.activeWarehouse ||
                fullyPlanned ||
                (!savedDraft && !rows.length)
              }
              onClick={() => void save('draft')}
              className={deliveryFormStyles.button}
            >
              Save Draft
            </Button>
            <Button
              type="submit"
              variant="primary-contrast"
              className={deliveryFormStyles.button}
              disabled={
                readOnly ||
                form.loading ||
                form.loadFailed ||
                !form.eligible ||
                !form.activeWarehouse ||
                fullyPlanned ||
                !hasPlannableDemand
              }
            >
              {form.phase === 'checking'
                ? 'Checking quantities...'
                : form.phase === 'saving'
                  ? 'Saving...'
                  : form.phase === 'readying'
                    ? 'Marking ready...'
                    : 'Mark Ready'}
            </Button>
          </DeliveryFormFooter>
        </form>
      )}
    </DeliveryFormDialog>
  )
}
