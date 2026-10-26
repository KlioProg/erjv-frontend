import { type FormEvent } from 'react'
import { DeliveryFormDialog, DeliveryFormFooter } from './DeliveryFormDialog'
import { deliveryFormStyles as styles } from './delivery-form.styles'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useOutgoingCompletion } from '@/features/logistics/use-outgoing-completion'
import {
  reconciliationFields,
  type CompletionRow,
  type ReconciliationField,
} from '@/features/logistics/outgoing-completion'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

const labels: Record<ReconciliationField, string> = {
  deliveredQuantity: 'Delivered',
  returnedSellableQuantity: 'Returned sellable',
  returnedDamagedQuantity: 'Returned damaged',
  missingQuantity: 'Missing',
}
export function CompleteDeliveryModal({
  deliveryId,
  onClose,
}: {
  deliveryId: number
  onClose: () => void
}) {
  const form = useOutgoingCompletion(deliveryId, onClose)
  const columns: ColumnDef<CompletionRow>[] = [
    {
      id: 'product',
      header: 'Product',
      width: '20%',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue value={row.name} className="font-medium" />
          <OverflowValue value={row.unit} className="text-xs text-muted-foreground" />
        </div>
      ),
    },
    {
      id: 'loaded',
      header: 'Loaded',
      width: '10%',
      align: 'right',
      cell: ({ row }) => (
        <OverflowValue
          value={formatStockCents(parseStockCents(row.loadedQuantity))}
          tooltipSuffix={row.unit}
          className="text-right tabular-nums"
        />
      ),
    },
    ...reconciliationFields.map((field): ColumnDef<CompletionRow> => ({
      id: field,
      header: labels[field],
      width: '12%',
      cell: ({ row }) => {
        const error = form.lineErrors[row.id]?.[field],
          errorId = `completion-${field}-${row.id}`
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={form.drafts[row.id]?.[field] ?? ''}
              onChange={(event) => form.setValue(row.id, field, event.target.value)}
              disabled={!form.canSubmit}
              aria-label={`${labels[field]} for ${row.name}`}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : 'reconciliation-help'}
              className="h-10 min-w-0 tabular-nums"
            />
            {error && (
              <p id={errorId} role="alert" className="whitespace-normal text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )
      },
    })),
    {
      id: 'reason',
      header: 'Discrepancy reason',
      width: '22%',
      cell: ({ row }) => {
        const error = form.lineErrors[row.id]?.discrepancyReason,
          errorId = `completion-reason-${row.id}`
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <Input
              value={form.drafts[row.id]?.discrepancyReason ?? ''}
              onChange={(event) => form.setValue(row.id, 'discrepancyReason', event.target.value)}
              disabled={!form.canSubmit}
              placeholder="Required for damage or missing goods"
              aria-label={`Discrepancy reason for ${row.name}`}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : 'reconciliation-help'}
              className="h-10 min-w-0"
            />
            {error && (
              <p id={errorId} role="alert" className="whitespace-normal text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )
      },
    },
  ]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.submit()
  }
  return (
    <DeliveryFormDialog
      open
      onClose={onClose}
      busy={form.busy}
      title="Complete Outgoing Delivery"
      description="Reconcile every confirmed loaded item before completing the shipment. The server updates stock, quarantine, order progress and vehicle availability."
    >
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.body}>
          <div className={styles.fields}>
            {form.error && (
              <Alert variant="destructive">
                <AlertDescription>{form.error}</AlertDescription>
              </Alert>
            )}
            {form.loading && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading confirmed shipment items…
              </p>
            )}
            {form.delivery && (
              <div className="flex min-w-0 flex-col gap-1 rounded-md bg-secondary p-4 text-sm">
                <OverflowValue value={form.delivery.deliveryNumber} className="font-medium" />
                <OverflowValue value={form.order?.orderNumber ?? 'Sales order unavailable'} />
                <OverflowValue
                  value={form.warehouse?.name ?? 'Source warehouse details unavailable'}
                  className="text-xs text-muted-foreground"
                />
              </div>
            )}
            <p id="reconciliation-help" className="text-xs text-muted-foreground">
              Delivered, returned sellable, returned damaged and missing quantities must total the
              actual loaded quantity for every product. Damage and missing goods require a reason.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!form.canSubmit}
              onClick={form.markAllDelivered}
              className="self-start"
            >
              Mark All as Delivered
            </Button>
            {form.rows.length > 0 && (
              <DataTable
                data={form.rows}
                columns={columns}
                getRowKey={(row) => row.id}
                pagination={false}
                className="shrink-0"
                tableClassName="min-w-[1100px] w-full table-fixed"
              />
            )}
            <Button
              type="button"
              variant="link"
              disabled={form.busy || form.fetching}
              onClick={() => void form.refresh()}
              className="self-start"
            >
              Refresh shipment
            </Button>
          </div>
        </div>
        <DeliveryFormFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.busy}
            className={styles.button}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!form.canSubmit} className={styles.button}>
            {form.refreshing ? 'Refreshing…' : form.busy ? 'Completing…' : 'Confirm Completion'}
          </Button>
        </DeliveryFormFooter>
      </form>
    </DeliveryFormDialog>
  )
}
