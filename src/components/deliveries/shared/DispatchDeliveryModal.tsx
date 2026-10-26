import { type FormEvent } from 'react'
import { Truck, User, Send, MapPin } from 'lucide-react'
import { DeliveryFormDialog, DeliveryFormFooter } from './DeliveryFormDialog'
import { deliveryFormStyles as styles } from './delivery-form.styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOutgoingDispatch } from '@/features/logistics/use-outgoing-dispatch'
import type { DispatchPlanRow } from '@/features/logistics/outgoing-dispatch'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface DispatchDeliveryModalProps {
  deliveryId: number
  open: boolean
  onClose: () => void
}

export function DispatchDeliveryModal({ deliveryId, open, onClose }: DispatchDeliveryModalProps) {
  const form = useOutgoingDispatch(deliveryId, onClose)
  const readOnly = !form.canSubmit
  const columns: ColumnDef<DispatchPlanRow>[] = [
    {
      id: 'product',
      header: 'Product',
      width: '34%',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue value={row.productName} className="font-medium" />
          <OverflowValue value={row.unit} className="text-xs text-muted-foreground" />
        </div>
      ),
    },
    ...(
      [
        ['plannedQuantity', 'Planned'],
        ['availableQuantity', 'Available'],
      ] as const
    ).map(([field, header]): ColumnDef<DispatchPlanRow> => ({
      id: field,
      header,
      align: 'right',
      width: '18%',
      cell: ({ row }) => (
        <OverflowValue
          value={formatStockCents(parseStockCents(row[field]))}
          tooltipSuffix={row.unit}
          className="text-right tabular-nums"
        />
      ),
    })),
    {
      id: 'loaded',
      header: 'Actual Loaded',
      width: '30%',
      cell: ({ row }) => {
        const error = form.lineErrors[row.salesOrderItemId]
        const errorId = `dispatch-load-error-${row.salesOrderItemId}`
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Enter quantity"
              value={form.quantities[row.salesOrderItemId] ?? ''}
              onChange={(event) => form.setQuantity(row.salesOrderItemId, event.target.value)}
              disabled={readOnly}
              aria-label={`Actual loaded quantity for ${row.productName}`}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : 'dispatch-load-help'}
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
    },
  ]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.submit()
  }
  return (
    <DeliveryFormDialog
      open={open}
      onClose={onClose}
      busy={form.busy}
      title="Dispatch Shipment to Transit"
      description={`Confirm the goods physically loaded, then assign a vehicle and driver${form.delivery ? ` for ${form.delivery.deliveryNumber}` : ''}. Dispatch reserves the confirmed loaded quantity.`}
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
                Loading saved shipment and current warehouse stock…
              </p>
            )}
            {form.delivery && (
              <div className="flex min-w-0 items-start gap-3 rounded-md bg-secondary p-4 text-sm">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <OverflowValue
                    value={
                      form.client?.name ??
                      (form.order ? `Customer #${form.order.clientId}` : 'Customer unavailable')
                    }
                    className="font-medium"
                  />
                  <OverflowValue
                    value={form.order?.orderNumber ?? 'Sales order unavailable'}
                    className="text-xs text-muted-foreground"
                  />
                  <OverflowValue value={form.order?.deliveryAddress || 'Destination unavailable'} />
                  <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <span>Origin:</span>
                    <OverflowValue value={form.warehouse?.name ?? 'Warehouse unavailable'} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.delivery.plannedItems?.length ?? 0} planned product{' '}
                    {form.delivery.plannedItems?.length === 1 ? 'line' : 'lines'}
                  </p>
                </div>
              </div>
            )}
            {form.rows.length > 0 && (
              <section aria-label="Confirm actual loading" className="flex min-w-0 flex-col gap-2">
                <h2 className={styles.sectionTitle}>Confirm actual loading</h2>
                <p id="dispatch-load-help" className="text-xs text-muted-foreground">
                  Enter the actual quantity loaded for each product. Partial loading is allowed;
                  leave a line blank or enter zero to skip it.
                </p>
                <DataTable
                  data={form.rows}
                  columns={columns}
                  getRowKey={(row) => row.salesOrderItemId}
                  pagination={false}
                  className="shrink-0"
                  tableClassName="min-w-[640px] w-full table-fixed"
                />
              </section>
            )}
            <fieldset disabled={readOnly} className={styles.grid}>
              <div className={styles.field}>
                <Label htmlFor="dispatch-vehicle" className={styles.label}>
                  Available Delivery Vehicle{' '}
                  <span aria-hidden="true" className="text-primary">
                    *
                  </span>
                </Label>
                <Select
                  value={form.vehicleId}
                  onValueChange={form.setVehicleId}
                  disabled={readOnly}
                >
                  <SelectTrigger id="dispatch-vehicle" className={styles.control}>
                    <SelectValue placeholder="Choose available vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {form.vehicles.length === 0 && (
                        <SelectItem value="none" disabled>
                          No vehicles registered in fleet
                        </SelectItem>
                      )}
                      {form.vehicles.map((vehicle) => {
                        const availability = DeliveryUtils.getVehicleAvailability(
                          vehicle,
                          form.deliveries,
                          deliveryId,
                        )
                        return (
                          <SelectItem
                            key={vehicle.id}
                            value={String(vehicle.id)}
                            disabled={!availability.isAvailable}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Truck
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-muted-foreground"
                              />
                              <OverflowValue
                                value={`${vehicle.plateNumber} (${vehicle.vehicleType}${vehicle.model ? ` · ${vehicle.model}` : ''})`}
                              />
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {availability.isAvailable ? 'Ready' : availability.reason}
                              </span>
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.field}>
                <Label htmlFor="dispatch-driver" className={styles.label}>
                  Assigned Driver / Logistics Officer{' '}
                  <span aria-hidden="true" className="text-primary">
                    *
                  </span>
                </Label>
                <Select value={form.driverId} onValueChange={form.setDriverId} disabled={readOnly}>
                  <SelectTrigger id="dispatch-driver" className={styles.control}>
                    <SelectValue placeholder="Choose active personnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {form.employees.length === 0 && (
                        <SelectItem value="none" disabled>
                          No active personnel available
                        </SelectItem>
                      )}
                      {form.employees.map((employee) => {
                        const availability = DeliveryUtils.getDriverAvailability(
                          employee,
                          form.deliveries,
                          deliveryId,
                        )
                        return (
                          <SelectItem
                            key={employee.id}
                            value={String(employee.id)}
                            disabled={!availability.isAvailable}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <User
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-muted-foreground"
                              />
                              <OverflowValue value={`${employee.firstName} ${employee.lastName}`} />
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {availability.isAvailable ? 'Available' : availability.reason}
                              </span>
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">
              Dispatch reserves the quantities you confirm and makes the selected vehicle
              unavailable. Physical stock is deducted when delivery is completed.
            </p>
            <Button
              type="button"
              variant="link"
              className="self-start"
              disabled={form.busy || form.fetching}
              onClick={() => void form.refresh()}
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
          <Button
            type="submit"
            disabled={!form.canSubmit || !form.vehicleId || !form.driverId}
            className={styles.button}
          >
            <Send aria-hidden="true" className="size-3.5" />
            {form.refreshing ? 'Refreshing…' : form.busy ? 'Dispatching…' : 'Dispatch Shipment'}
          </Button>
        </DeliveryFormFooter>
      </form>
    </DeliveryFormDialog>
  )
}
