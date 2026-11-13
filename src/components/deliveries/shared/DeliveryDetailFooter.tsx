import { Button } from '@/components/ui/button'

export function DeliveryDetailFooter({
  onClose,
  onCancel,
  busy = false,
}: {
  onClose: () => void
  onCancel?: () => void
  busy?: boolean
}) {
  return (
    <footer
      role="group"
      aria-label="Delivery actions"
      className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6"
    >
      <div>
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel Delivery
          </Button>
        )}
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>
        Close
      </Button>
    </footer>
  )
}
