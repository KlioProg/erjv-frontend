import { Button } from '@/components/ui/button'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { Label } from '@/components/ui/label'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { useRunDeliverySelection } from '@/features/logistics/use-run-delivery-selection'

export function RunDeliveryPicker({
  selection,
  warehouseId,
  disabled = false,
  existingIds = [],
  heading,
  scrollSelected = true,
}: {
  selection: ReturnType<typeof useRunDeliverySelection>
  warehouseId?: number
  disabled?: boolean
  existingIds?: number[]
  heading?: string
  scrollSelected?: boolean
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-2"
      aria-label={heading ?? 'Delivery selection'}
    >
      {heading ? (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold leading-5">{heading}</h3>
          <p role="status" className="text-xs text-muted-foreground">
            {selection.selected.length} selected
            {selection.checking ? ' · Checking availability…' : ''}
            {selection.selected.length + existingIds.length >= 100
              ? ' · Trip limit: 100 deliveries'
              : ''}
          </p>
        </div>
      ) : (
        <Label htmlFor="run-ready-delivery">Ready deliveries from this warehouse</Label>
      )}
      {heading && <Label htmlFor="run-ready-delivery">Add Delivery</Label>}
      <CursorLookup<OutgoingDeliveryRecord>
        id="run-ready-delivery"
        path="/outgoing-deliveries"
        filter={{ statuses: ['READY'], warehouseId, unassigned: 'true' }}
        value=""
        label="Ready delivery"
        selectedValues={selection.selected.map((delivery) => String(delivery.id))}
        disabled={disabled || !warehouseId}
        getLabel={(delivery) =>
          `${delivery.deliveryNumber} · Sales Order #${delivery.salesOrderId}`
        }
        accept={(delivery) =>
          delivery.status === 'READY' &&
          delivery.runId === null &&
          delivery.warehouseId === warehouseId &&
          !existingIds.includes(delivery.id)
        }
        onChange={(_, delivery) => selection.toggle(delivery)}
      />
      <ul
        className={`flex flex-col gap-2${scrollSelected ? ' max-h-44 overflow-y-auto' : ''}`}
        aria-label="Selected deliveries"
      >
        {selection.selected.map((delivery, index) => (
          <li
            key={delivery.id}
            className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
          >
            <div className="min-w-0 break-words">
              <span className="font-medium">{delivery.deliveryNumber}</span>
              <p className="text-xs text-muted-foreground">Sales Order #{delivery.salesOrderId}</p>
              {selection.issues[index] && (
                <p role="alert" className="text-xs text-destructive">
                  {selection.issues[index]}
                </p>
              )}
              {selection.issues[index] && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={disabled || selection.checking}
                  onClick={() => selection.retry(index)}
                >
                  Check {delivery.deliveryNumber} again
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={`Remove ${delivery.deliveryNumber} from selection`}
              onClick={() => selection.remove(delivery.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
