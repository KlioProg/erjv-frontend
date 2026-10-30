import { useRef, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useAllProducts } from '@/features/products/products.hooks'
import { useAllWarehouses } from './warehouses.hooks'
import { useOutgoingDeliveryById } from './outgoing-deliveries.hooks'
import { useDeliveryRunById, useReconcileRunMember } from './delivery-runs.hooks'
import {
  blankReconciliation,
  outgoingCompletionRows,
  validateOutgoingCompletion,
  type ReconciliationDraft,
} from './outgoing-completion'
import { getErrorMessage } from '@/lib/api-client'

export function useOutgoingCompletion(runId: number, id: number, onSuccess: () => void) {
  const { isAdmin, isManager, isStaff } = useAuth()
  const deliveryQuery = useOutgoingDeliveryById(id)
  const delivery = deliveryQuery.data
  const orderQuery = useSalesOrderById(delivery?.salesOrderId)
  const productsQuery = useAllProducts()
  const warehousesQuery = useAllWarehouses()
  const runQuery = useDeliveryRunById(runId)
  const complete = useReconcileRunMember()
  const [reviewedRevision, setReviewedRevision] = useState<number | null>(null)
  if (delivery && reviewedRevision === null && deliveryQuery.isFetchedAfterMount)
    setReviewedRevision(delivery.revision)
  const [drafts, setDrafts] = useState<Record<number, ReconciliationDraft>>({})
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const lock = useRef(false)
  const order = orderQuery.data
  const rows =
    delivery && order ? outgoingCompletionRows(delivery, order, productsQuery.data ?? []) : []
  const queries = [
    deliveryQuery,
    runQuery,
    productsQuery,
    warehousesQuery,
    ...(delivery?.salesOrderId ? [orderQuery] : []),
  ]
  const loading =
    queries.some((query) => query.isLoading) ||
    (!deliveryQuery.isFetchedAfterMount && deliveryQuery.isFetching)
  const fetching = queries.some((query) => query.isFetching)
  const loadError = queries.find((query) => query.isError)?.error
  let dataIssue: string | undefined
  if (!loading && !loadError) {
    if (!isAdmin && !isManager && !isStaff)
      dataIssue = 'You do not have permission to reconcile outgoing deliveries.'
    else if (!delivery || delivery.id !== id)
      dataIssue = 'The saved shipment could not be loaded. Refresh before confirming delivery.'
    else if (
      delivery.revision !== reviewedRevision ||
      delivery.runId !== runId ||
      delivery.reconciledAt != null ||
      runQuery.data?.status !== 'DISPATCHED' ||
      !runQuery.data.deliveries.some(
        (member) => member.id === id && member.revision === delivery.revision,
      )
    )
      dataIssue =
        'Run membership or the member revision changed. Refresh and review before reconciling.'
    else if (delivery.status !== 'DISPATCHED')
      dataIssue =
        'Only an in-transit shipment can be completed. Review its current status in Outgoing Deliveries.'
    else if (!rows.length)
      dataIssue =
        'The confirmed loaded items could not be matched to the sales order. Refresh this shipment before completing it.'
  }
  const validation = validateOutgoingCompletion(rows, drafts)
  const busy = refreshing || complete.isPending
  const canSubmit = !busy && !loading && !fetching && !loadError && !dataIssue && !needsRefresh
  async function refresh() {
    if (lock.current || busy) return
    setRefreshing(true)
    try {
      const results = await Promise.all(queries.map((query) => query.refetch()))
      const failed = results.some((result) => result.isError)
      if (!failed && results[0].data && 'revision' in results[0].data)
        setReviewedRevision(results[0].data.revision)
      setNeedsRefresh(failed)
      setMessage(
        failed
          ? 'The shipment could not be fully refreshed. Check your connection and try again.'
          : '',
      )
    } finally {
      setRefreshing(false)
    }
  }
  async function submit() {
    if (lock.current || !canSubmit || !delivery) return
    setSubmitted(true)
    setMessage('')
    if (validation.error) {
      setMessage(validation.error)
      return
    }
    lock.current = true
    try {
      const saved = await complete.mutateAsync({
        id: runId,
        deliveryId: id,
        payload: { expectedRevision: delivery.revision, ...validation.payload },
      })
      if (
        saved?.delivery?.id !== id ||
        saved.delivery.runId !== runId ||
        saved.delivery.status !== 'RECONCILED' ||
        !Number.isSafeInteger(saved.delivery.revision) ||
        saved.delivery.revision <= delivery.revision ||
        !saved.delivery.reconciledAt ||
        saved.run?.id !== runId
      )
        throw Error(
          'The server did not confirm reconciliation. Refresh and review before retrying.',
        )
      onSuccess()
    } catch (cause) {
      setMessage(
        `${getErrorMessage(cause)} Refresh this shipment and review its status before retrying.`,
      )
      setNeedsRefresh(true)
    } finally {
      lock.current = false
    }
  }
  return {
    delivery,
    order,
    rows,
    drafts,
    busy,
    loading,
    fetching,
    refreshing,
    canSubmit,
    warehouse: warehousesQuery.data?.find((warehouse) => warehouse.id === delivery?.warehouseId),
    error: loadError
      ? `Shipment data could not be loaded. ${getErrorMessage(loadError)}`
      : (dataIssue ?? message),
    lineErrors: submitted ? validation.errors : {},
    submit,
    refresh,
    setValue: (id: number, field: keyof ReconciliationDraft, value: string) =>
      setDrafts((current) => ({
        ...current,
        [id]: { ...(current[id] ?? blankReconciliation()), [field]: value },
      })),
    markAllDelivered: () => {
      if (canSubmit) {
        setDrafts(
          Object.fromEntries(
            rows.map((row) => [
              row.id,
              {
                ...blankReconciliation(),
                deliveredQuantity: row.loadedQuantity,
                returnedSellableQuantity: '0.00',
                returnedDamagedQuantity: '0.00',
                missingQuantity: '0.00',
              },
            ]),
          ),
        )
        setMessage('')
      }
    },
  }
}
