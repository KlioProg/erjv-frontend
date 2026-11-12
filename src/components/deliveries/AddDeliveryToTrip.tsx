import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { useRecordsById } from '@/lib/use-records-by-id'
import { getErrorMessage } from '@/lib/api-client'
import { toast } from '@/lib/notifications'
import { hasValidOutgoingPlan } from '@/features/logistics/outgoing-issues'
import { fetchOutgoingDeliveryByIdApi } from '@/features/logistics/outgoing-deliveries.api'
import { fetchDeliveryRunByIdApi } from '@/features/logistics/delivery-runs.api'
import { useChangeRunMembers } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

export function AddDeliveryToTrip({
  run,
  disabled,
  onRefresh,
  onBusyChange,
}: {
  run: DeliveryRunRecord
  disabled?: boolean
  onRefresh: () => Promise<unknown>
  onBusyChange: (busy: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<number>()
  const [error, setError] = useState('')
  const locked = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const change = useChangeRunMembers()
  const query = useCursorLookup<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    {
      statuses: ['READY'],
      warehouseId: run.warehouseId,
      unassigned: 'true',
      ...(search.trim() ? { q: search.trim() } : {}),
    },
    open && !disabled,
  )
  const eligible = query.items.filter(
    (delivery) =>
      delivery.status === 'READY' &&
      delivery.runId === null &&
      delivery.warehouseId === run.warehouseId &&
      hasValidOutgoingPlan(delivery) &&
      !run.deliveries.some((member) => member.id === delivery.id),
  )
  const orders = useRecordsById<{ id: number; orderNumber: string; clientId: number }>(
    '/sales-orders',
    eligible.map((delivery) => delivery.salesOrderId),
  )
  const clients = useRecordsById<{ id: number; name: string }>(
    '/clients',
    orders.data.map((order) => order.clientId),
  )
  async function assign(selected: OutgoingDeliveryRecord) {
    if (locked.current || disabled || run.status !== 'DRAFT') return
    locked.current = true
    setPendingId(selected.id)
    onBusyChange(true)
    setError('')
    let mutationStarted = false
    let confirmed = false
    try {
      const [latest, current] = await Promise.all([
        fetchOutgoingDeliveryByIdApi(selected.id),
        fetchDeliveryRunByIdApi(run.id),
      ])
      if (!active.current) return
      if (
        !latest ||
        !current ||
        current.id !== run.id ||
        current.status !== 'DRAFT' ||
        current.warehouseId !== run.warehouseId ||
        latest.id !== selected.id ||
        latest.revision !== selected.revision ||
        latest.status !== 'READY' ||
        latest.runId !== null ||
        latest.warehouseId !== current.warehouseId ||
        !hasValidOutgoingPlan(latest) ||
        current.deliveries.some((member) => member.id === selected.id) ||
        current.deliveries.length + (current.warehouseTransfers?.length ?? 0) >= 100
      )
        throw Error('This delivery or trip changed. Review the refreshed results before adding it.')
      mutationStarted = true
      const saved = await change.mutateAsync({
        id: current.id,
        payload: {
          expectedRevision: current.revision,
          add: [{ deliveryId: latest.id, expectedRevision: latest.revision }],
        },
      })
      confirmed = true
      if (
        saved.id !== current.id ||
        saved.revision <= current.revision ||
        !saved.deliveries?.some((member) => member.id === latest.id)
      )
        throw Error('Assignment was not confirmed. Review the refreshed trip before trying again.')
      toast.success('Delivery added to trip.')
    } catch (cause) {
      const message = getErrorMessage(cause)
      setError(message)
      // The existing mutation hook reports API failures once.
      if (!mutationStarted || confirmed) toast.error(message)
    } finally {
      await Promise.allSettled([query.reload(), onRefresh()])
      setPendingId(undefined)
      locked.current = false
      onBusyChange(false)
    }
  }
  return (
    <SearchableDropdown
      value=""
      options={eligible}
      ariaLabel="Add Delivery"
      placeholder="+ Add Delivery"
      className="h-8 w-auto shrink-0 text-ui font-medium"
      contentClassName="w-[min(26rem,calc(100vw-2rem))]"
      align="end"
      avoidCollisions
      disabled={
        disabled ||
        run.status !== 'DRAFT' ||
        run.deliveries.length + (run.warehouseTransfers?.length ?? 0) >= 100
      }
      closeOnSelect={false}
      onOpenChange={setOpen}
      onSearchChange={setSearch}
      onValueChange={(_, delivery) => void assign(delivery)}
      getOptionValue={(delivery) => String(delivery.id)}
      getOptionLabel={(delivery) => delivery.deliveryNumber}
      getOptionDisabled={() => pendingId !== undefined}
      searchPlaceholder="Search delivery, sales order or customer"
      renderOption={(delivery) => {
        const order = orders.data.find((order) => order.id === delivery.salesOrderId)
        const client = clients.data.find((client) => client.id === order?.clientId)
        return (
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-medium">{delivery.deliveryNumber}</span>
              <span className="block text-xs text-muted-foreground">
                {order?.orderNumber ?? `Sales Order #${delivery.salesOrderId}`}
                {client ? ` · ${client.name}` : ''}
              </span>
            </span>
            {pendingId === delivery.id ? (
              <Spinner className="size-4 shrink-0" />
            ) : (
              <Plus aria-hidden="true" className="size-4 shrink-0" />
            )}
          </span>
        )
      }}
      emptyMessage={
        query.isError
          ? 'Unable to load deliveries.'
          : query.isPending
            ? 'Loading deliveries…'
            : query.hasNextPage
              ? 'No eligible deliveries on this page. Load more deliveries.'
              : search.trim()
                ? 'No matching deliveries.'
                : 'No ready deliveries available.'
      }
      footer={
        <div className="flex flex-col gap-2 border-t pt-2 text-xs">
          {pendingId !== undefined && <p role="status">Adding delivery…</p>}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {query.isError && (
            <Button type="button" variant="outline" size="sm" onClick={() => void query.reload()}>
              Retry
            </Button>
          )}
          {query.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              Load more deliveries
            </Button>
          )}
        </div>
      }
    />
  )
}
