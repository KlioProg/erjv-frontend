import { type FormEvent } from 'react'
import { DeliveryFormDialog, DeliveryFormFooter } from './shared/DeliveryFormDialog'
import { deliveryFormStyles as styles } from './shared/delivery-form.styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useIncomingReceiving } from '@/features/logistics/use-incoming-receiving'
import type { ReceiptRow } from '@/features/logistics/incoming-receiving'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

export function ReceiveProductsModal({
  deliveryId,
  onClose,
}: {
  deliveryId: number
  onClose: () => void
}) {
  const form = useIncomingReceiving(deliveryId, onClose)
  const readOnly = !form.canSubmit
  const columns: ColumnDef<ReceiptRow>[] = [
    {
      id: 'product',
      header: 'Product',
      width: '24%',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue value={row.name} className="font-medium" />
          <OverflowValue value={row.unit} className="text-xs text-muted-foreground" />
        </div>
      ),
    },
    ...(
      [
        ['ordered', 'Ordered'],
        ['previouslyReceived', 'Previously received'],
        ['outstanding', 'Outstanding (good)'],
      ] as const
    ).map(([field, header]): ColumnDef<ReceiptRow> => ({
      id: field,
      header,
      align: 'right',
      width: '14%',
      cell: ({ row }) => (
        <OverflowValue
          value={formatStockCents(parseStockCents(row[field]))}
          tooltipSuffix={row.unit}
          className="text-right tabular-nums"
        />
      ),
    })),
    ...(['received', 'damaged'] as const).map((field): ColumnDef<ReceiptRow> => ({
      id: field,
      header: field === 'received' ? 'Received now' : 'Damaged now',
      width: '17%',
      cell: ({ row }) => {
        const error = form.lineErrors[row.id]?.[field]
        const errorId = `receipt-${field}-error-${row.id}`
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Input
              type="text"
              inputMode="decimal"
              value={form.drafts[row.id]?.[field] ?? ''}
              onChange={(event) => form.setQuantity(row.id, field, event.target.value)}
              placeholder={field === 'received' ? 'Enter quantity' : '0'}
              disabled={readOnly || form.noReceipt}
              aria-label={`${field === 'received' ? 'Received' : 'Damaged'} now for ${row.name}`}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : 'receipt-quantity-help'}
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
      title="Receive Goods"
      description={`Confirm actual quantities${form.delivery ? ` for ${form.delivery.deliveryNumber}` : ''}. Damaged goods are recorded in quarantine and do not fulfill the purchase order.`}
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
                Loading delivery and purchase order receipts…
              </p>
            )}
            {form.delivery && (
              <div className="flex min-w-0 flex-col gap-1 rounded-md bg-secondary p-4 text-sm">
                <OverflowValue value={form.delivery.deliveryNumber} className="font-medium" />
                <OverflowValue value={form.order?.orderNumber ?? 'Purchase order unavailable'} />
                <OverflowValue
                  value={form.supplier?.name ?? 'Supplier unavailable'}
                  className="text-xs text-muted-foreground"
                />
                <div className="flex min-w-0 items-center gap-1">
                  <span>Receiving warehouse:</span>
                  <OverflowValue value={form.warehouse?.name ?? 'Warehouse unavailable'} />
                </div>
              </div>
            )}
            <p id="receipt-quantity-help" className="text-xs text-muted-foreground">
              Received now includes damaged goods. Previously received includes past damage;
              outstanding counts only accepted good stock. Leave a line blank or enter zero to skip
              it.
            </p>
            {form.rows.length > 0 && (
              <DataTable
                data={form.rows}
                columns={columns}
                getRowKey={(row) => row.id}
                pagination={false}
                className="shrink-0"
                tableClassName="min-w-[920px] w-full table-fixed"
              />
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="receipt-none"
                checked={form.noReceipt}
                onCheckedChange={(checked) => form.setNoReceipt(checked === true)}
                disabled={readOnly}
              />
              <Label htmlFor="receipt-none">No goods received</Label>
            </div>
            {form.noReceipt && (
              <div className={styles.field}>
                <Label htmlFor="no-receipt-reason">Reason for no receipt</Label>
                <Textarea
                  id="no-receipt-reason"
                  value={form.reason}
                  onChange={(event) => form.setReason(event.target.value)}
                  disabled={readOnly}
                  aria-required="true"
                  aria-invalid={!!form.reasonError}
                  aria-describedby={
                    form.reasonError ? 'no-receipt-reason-error' : 'no-receipt-help'
                  }
                />
                {form.reasonError && (
                  <p id="no-receipt-reason-error" role="alert" className="text-xs text-destructive">
                    {form.reasonError}
                  </p>
                )}
                <p id="no-receipt-help" className="text-xs text-muted-foreground">
                  This completes the delivery without adding stock or fulfilling purchase order
                  quantities.
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="link"
              className="self-start"
              disabled={form.busy || form.fetching}
              onClick={() => void form.refresh()}
            >
              Refresh receipt data
            </Button>
          </div>
        </div>
        <DeliveryFormFooter>
          <Button
            type="button"
            variant="outline"
            disabled={form.busy}
            onClick={onClose}
            className={styles.button}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!form.canSubmit} className={styles.button}>
            {form.refreshing
              ? 'Refreshing…'
              : form.busy
                ? 'Confirming…'
                : form.noReceipt
                  ? 'Confirm No Receipt'
                  : 'Confirm Receipt'}
          </Button>
        </DeliveryFormFooter>
      </form>
    </DeliveryFormDialog>
  )
}
