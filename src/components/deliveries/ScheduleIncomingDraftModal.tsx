import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  useIncomingSchedulingEligibility,
  useScheduleIncomingDelivery,
} from '@/features/logistics/incoming-deliveries.hooks'
import { incomingSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import { formatDeliverySchedule } from '@/features/logistics/delivery-workflow'
import { getErrorMessage } from '@/lib/api-client'

export function ScheduleIncomingDraftModal({
  id,
  reference,
  onClose,
  onViewOrder,
  canManage,
}: {
  id: number
  canManage: boolean
  reference: string
  onClose: () => void
  onViewOrder: (id: number) => void
}) {
  const query = useIncomingSchedulingEligibility(id)
  const schedule = useScheduleIncomingDelivery()
  const [error, setError] = useState('')
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const verified =
    canManage && query.isFetchedAfterMount && !query.isFetching && !query.isError && !!query.data
  const issue =
    query.data && query.isFetchedAfterMount && !query.isError
      ? incomingSchedulingIssue(query.data)
      : null
  const message = !canManage
    ? 'Only administrators and managers can schedule an arrival.'
    : query.isError
      ? 'Unable to verify scheduling eligibility. Recheck the current delivery and purchase order before continuing.'
      : error
  const confirm = async () => {
    if (lock.current || !verified || issue || failed || !query.data) return
    lock.current = true
    setError('')
    try {
      await schedule.mutateAsync({ id, expectedRevision: query.data.delivery.revision })
      onClose()
    } catch (error) {
      setError(getErrorMessage(error))
      setFailed(true)
    } finally {
      lock.current = false
    }
  }
  const arrival = formatDeliverySchedule(query.data?.delivery.scheduledAt ?? null, false)
  return (
    <Dialog open onOpenChange={(open) => !open && !schedule.isPending && onClose()}>
      <DialogContent closeDisabled={schedule.isPending} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Arrival</DialogTitle>
          <DialogDescription>
            Mark this draft as scheduled and ready for receiving. Physical stock is unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 rounded-md bg-muted/50 p-4">
          <p className="font-medium">{reference}</p>
          {query.data && (
            <p className="text-sm text-muted-foreground">
              {query.data.order.orderNumber} · {query.data.warehouse.name} · {arrival.date}{' '}
              {arrival.time}
            </p>
          )}
        </div>
        {query.isFetching && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking current scheduling eligibility...
          </p>
        )}
        {issue && (
          <Alert>
            <AlertTitle>{issue.title}</AlertTitle>
            <AlertDescription>
              {issue.message}
              {query.data?.delivery.status === 'DRAFT' &&
                ' This incoming delivery is still saved as a draft, but it cannot currently be scheduled.'}
            </AlertDescription>
          </Alert>
        )}
        {message && !issue && (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {query.data && (
            <Button
              type="button"
              variant="link"
              disabled={schedule.isPending}
              onClick={() => onViewOrder(query.data.order.id)}
            >
              View Purchase Order
            </Button>
          )}
          {(query.isError || failed || issue) && (
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching || schedule.isPending}
              onClick={async () => {
                const result = await query.refetch()
                if (!result.isError) {
                  setError('')
                  setFailed(false)
                }
              }}
            >
              Recheck Eligibility
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={schedule.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!verified || !!issue || failed || schedule.isPending}
            onClick={() => void confirm()}
          >
            {schedule.isPending ? 'Checking and scheduling...' : 'Schedule Arrival'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
