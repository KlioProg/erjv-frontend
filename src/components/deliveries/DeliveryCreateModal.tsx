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
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { useDeliveryCreation } from '@/features/logistics/use-delivery-creation'
import { DeliveryItemsTable } from './shared/DeliveryItemsTable'

function ShipmentSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Search options…',
  disabled,
}: {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <SearchableDropdown
      id={id}
      value={value}
      options={options}
      onValueChange={onChange}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.label}
      placeholder={placeholder}
      searchPlaceholder={placeholder}
      emptyMessage="No matching options"
      ariaLabel={id.replaceAll('-', ' ')}
      disabled={disabled}
    />
  )
}
export function DeliveryCreateModal({
  kind,
  preselectedOrderId,
  onClose,
}: {
  kind: 'Incoming' | 'Outgoing'
  preselectedOrderId?: number
  onClose: () => void
}) {
  const form = useDeliveryCreation(kind, preselectedOrderId)
  const incoming = kind === 'Incoming'
  return (
    <Dialog open onOpenChange={(open) => !open && !form.pending && onClose()}>
      <DialogContent className="flex max-h-[90svh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-6 pt-6 text-left">
          <DialogTitle>Create {kind} Delivery</DialogTitle>
          <DialogDescription>
            {incoming
              ? 'Select the confirmed purchase order and destination warehouse. Confirm actual quantities when the goods arrive.'
              : 'Select the confirmed sales order and its warehouse allocations. Physical stock is deducted when delivery is completed.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault()
            if (await form.submit()) onClose()
          }}
        >
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
            {(form.error || form.unavailable) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.error ||
                    'Delivery or inventory data could not be loaded. Close and retry when the connection is available.'}
                  {form.createdId !== null &&
                    ' The draft was saved. Retry scheduling without creating another delivery.'}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="shipment-order">{incoming ? 'Purchase Order' : 'Sales Order'}</Label>
              <ShipmentSelect
                id="shipment-order"
                value={form.effectiveOrderId}
                options={form.orderOptions}
                onChange={form.changeOrder}
                placeholder="Search confirmed orders…"
                disabled={form.locked || form.loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shipment-warehouse">
                {incoming ? 'Destination Warehouse' : 'Source Warehouse'}
              </Label>
              <ShipmentSelect
                id="shipment-warehouse"
                value={form.effectiveWarehouseId}
                options={form.activeWarehouses.map((warehouse) => ({
                  value: String(warehouse.id),
                  label: warehouse.name,
                }))}
                onChange={form.setWarehouseId}
                placeholder="Search warehouses…"
                disabled={form.locked || form.loading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="shipment-date">Scheduled Date</Label>
                <Input
                  id="shipment-date"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(event) => form.setScheduledAt(event.target.value)}
                  disabled={form.locked}
                />
              </div>
              {incoming && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shipment-reference">Supplier Reference</Label>
                  <Input
                    id="shipment-reference"
                    value={form.supplierReference}
                    onChange={(event) => form.setSupplierReference(event.target.value)}
                    disabled={form.locked}
                  />
                </div>
              )}
            </div>
            {!incoming && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shipment-vehicle">Vehicle (optional)</Label>
                  <ShipmentSelect
                    id="shipment-vehicle"
                    value={form.vehicleId}
                    options={[
                      { value: 'none', label: 'Assign at dispatch' },
                      ...form.vehicleOptions,
                    ]}
                    onChange={form.setVehicleId}
                    disabled={form.locked}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shipment-driver">Driver (optional)</Label>
                  <ShipmentSelect
                    id="shipment-driver"
                    value={form.driverId}
                    options={[
                      { value: 'none', label: 'Assign at dispatch' },
                      ...form.driverOptions,
                    ]}
                    onChange={form.setDriverId}
                    disabled={form.locked}
                  />
                </div>
              </div>
            )}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Shipment Items</h2>
              <p className="text-xs text-muted-foreground">
                Available quantities exclude other active shipments. Enter zero to leave a product
                for another shipment.
              </p>
              {form.loading ? (
                <p role="status">Loading shipment balances…</p>
              ) : (
                <DeliveryItemsTable
                  rows={form.rows}
                  onChange={form.changeQuantity}
                  disabled={form.locked || form.unavailable}
                />
              )}
            </section>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shipment-notes">Notes</Label>
              <Input
                id="shipment-notes"
                value={form.notes}
                onChange={(event) => form.setNotes(event.target.value)}
                disabled={form.locked}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoSchedule}
                onChange={(event) => form.setAutoSchedule(event.target.checked)}
                disabled={form.locked}
              />
              Schedule after creating the draft
            </label>
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={form.pending}>
              {form.createdId === null ? 'Cancel' : 'Close'}
            </Button>
            <Button type="submit" disabled={form.pending || form.loading || form.unavailable}>
              {form.pending
                ? 'Saving…'
                : form.createdId !== null
                  ? 'Retry Scheduling'
                  : form.autoSchedule
                    ? 'Create & Schedule'
                    : 'Create Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
