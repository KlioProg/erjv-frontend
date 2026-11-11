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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import { useOutgoingDispatch } from '@/features/logistics/use-outgoing-dispatch'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { useRecordsById } from '@/lib/use-records-by-id'

export function DispatchDeliveryModal({
  runId,
  onClose,
  onDeparted,
}: {
  runId: number
  onClose: () => void
  onDeparted?: (run: DeliveryRunRecord) => void
}) {
  const form = useOutgoingDispatch(runId, onDeparted ?? onClose)
  const products = useRecordsById<{ id: number; name: string; unit: string }>('/inventory-items', form.transfers.flatMap((transfer) => transfer.items.map((item) => item.inventoryItemId)))
  return (
    <Dialog open onOpenChange={(open) => !open && !form.busy && onClose()}>
      <DialogContent
        closeDisabled={form.busy}
        className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 px-6 pr-14 pt-6">
          <DialogTitle>Confirm Departure?</DialogTitle>
          <DialogDescription>
            {form.run?.runNumber || 'Loading trip...'} · Confirm all delivery loads before departure.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            void form.submit()
          }}
        >
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
            <Button
              type="button"
              variant="link"
              disabled={form.busy}
              aria-label="Refresh trip data"
              onClick={() => void form.refresh()}
            >
              Refresh trip and review current data
            </Button>
            {form.error && (
              <Alert variant={form.fetching ? 'default' : 'destructive'}>
                <AlertDescription>{form.error}</AlertDescription>
              </Alert>
            )}
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Source warehouse</dt>
                <dd>{form.warehouse?.name || 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Departure</dt>
                <dd>
                  {!form.run
                    ? 'Unavailable'
                    : form.run.scheduledDepartureAt
                      ? new Date(form.run.scheduledDepartureAt).toLocaleString('en-PH', {
                          timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })
                      : 'Not scheduled'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Assigned vehicle</dt>
                <dd>{form.vehicle?.plateNumber || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Assigned driver</dt>
                <dd>
                  {form.driver
                    ? `${form.driver.firstName} ${form.driver.lastName}`
                    : 'Not assigned'}
                </dd>
              </div>
            </dl>
            {!!form.rows.length && <section className="flex min-w-0 flex-col gap-3" aria-labelledby="run-loading-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="run-loading-heading" className="text-sm font-medium">
                  Delivery product loading
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!form.canSubmit}
                  onClick={form.usePlannedQuantities}
                >
                  Use Planned Quantities
                </Button>
              </div>
              <DataTable
                data={form.rows}
                pagination={false}
                getRowKey={(row) => row.key}
                columns={[
                  { id: 'delivery', header: 'Delivery', cell: ({ row }) => row.deliveryNumber },
                  {
                    id: 'product',
                    header: 'Product',
                    className: 'whitespace-normal',
                    cell: ({ row }) => (
                      <div>
                        <p className="font-medium">{row.productName}</p>
                        <p className="text-xs text-muted-foreground">{row.unit}</p>
                        {parseStockCents(row.availableQuantity) === 0n && <p className="text-xs text-muted-foreground">{row.productName}: No stock available at this warehouse.</p>}
                      </div>
                    ),
                  },
                  {
                    id: 'planned',
                    header: 'Planned',
                    cell: ({ row }) => formatStockCents(parseStockCents(row.plannedQuantity)),
                  },
                  {
                    id: 'available',
                    header: 'Available',
                    cell: ({ row }) => formatStockCents(parseStockCents(row.availableQuantity)),
                  },
                  {
                    id: 'loaded',
                    header: 'Quantity Loaded',
                    className: 'w-40',
                    cell: ({ row }) => (
                      <div className="flex flex-col gap-1.5">
                        <Label className="sr-only" htmlFor={`run-load-${row.key}`}>
                          Quantity loaded for {row.productName} on {row.deliveryNumber}
                        </Label>
                        <Input
                          id={`run-load-${row.key}`}
                          inputMode="decimal"
                          value={form.quantities[row.key] ?? ''}
                          aria-invalid={!!form.fieldErrors[row.key]}
                          aria-describedby={form.fieldErrors[row.key] ? `run-load-${row.key}-error` : undefined}
                          disabled={form.busy}
                          onChange={(event) => form.setQuantity(row.key, event.target.value)}
                        />
                        {form.fieldErrors[row.key] && <p id={`run-load-${row.key}-error`} role="alert" className="text-xs text-destructive">{form.fieldErrors[row.key]}</p>}
                      </div>
                    ),
                  },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Partial loading is allowed. Leave unloaded product lines blank or enter zero. Each
                delivery needs at least one loaded product; remove fully unloaded deliveries before
                departure. Availability is shared across this trip.
              </p>
            </section>}
            {!!form.transfers.length && <section aria-label="Warehouse transfer loads" className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Warehouse transfer loads</h3>
              {form.transfers.map((transfer) => <div key={transfer.id} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{transfer.transferNumber}</p>
                <DataTable data={transfer.items} pagination={false} getRowKey={(item) => item.id} columns={[
                  { header: 'Product', cell: ({ row }) => products.data.find((product) => product.id === row.inventoryItemId)?.name ?? `Item #${row.inventoryItemId}` },
                  { header: 'Quantity to send', accessorKey: 'quantity' },
                ]} />
              </div>)}
              <p className="text-xs text-muted-foreground">Confirm every saved transfer quantity is loaded. To change quantities, remove the transfer from this trip and edit its draft. Stock for the combined load is checked when sending.</p>
            </section>}
            <div className="flex max-w-sm flex-col gap-2">
              <Label htmlFor="run-loaded-weight">Actual total loaded weight (kg)</Label>
              <Input
                id="run-loaded-weight"
                inputMode="decimal"
                value={form.loadedWeightKg}
                disabled={form.busy}
                onChange={(event) => form.setLoadedWeightKg(event.target.value)}
                aria-invalid={!!form.fieldErrors.loadedWeightKg}
                aria-describedby={`run-capacity${form.fieldErrors.loadedWeightKg ? ' run-weight-error' : ''}`}
              />
              {form.fieldErrors.loadedWeightKg && <p id="run-weight-error" role="alert" className="text-xs text-destructive">{form.fieldErrors.loadedWeightKg}</p>}
              <p id="run-capacity" className="text-xs text-muted-foreground">
                Vehicle capacity: {formatStockCents(parseStockCents(form.vehicle?.capacityKg))} kg.
                Confirm the measured total weight for this trip.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Send Trip records departure for all included deliveries and transfers. Loaded goods move from
              on-hand stock to in transit. Confirm the actual quantities before sending.
            </p>
          </div>
          {form.reviewing && <p role="status" className="px-6 pb-3 text-sm">Load reviewed. Confirm Send Trip when the goods physically leave.</p>}
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={form.busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.canSubmit}>
              {form.sending ? 'Sending...' : form.reviewing ? 'Send Trip' : 'Review Departure'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
