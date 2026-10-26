import { useRef, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useAllProducts } from '@/features/products/products.hooks'
import { usePurchaseOrderById } from './purchase-orders.hooks'
import { useAllWarehouses } from './warehouses.hooks'
import { useSuppliers } from './suppliers.hooks'
import {
  useIncomingDeliveryById,
  useIncomingDeliveries,
  useCompleteIncomingDelivery,
} from './incoming-deliveries.hooks'
import {
  incomingReceiptRows,
  validateIncomingReceipt,
  type ReceiptDraft,
} from './incoming-receiving'
import { getErrorMessage } from '@/lib/api-client'

export function useIncomingReceiving(id: number, onSuccess: () => void) {
  const { isAdmin, isManager } = useAuth()
  const canReceive = isAdmin || isManager
  const deliveryQuery = useIncomingDeliveryById(id)
  const delivery = deliveryQuery.data
  const orderQuery = usePurchaseOrderById(delivery?.purchaseOrderId)
  const historyQuery = useIncomingDeliveries({
    purchaseOrderId: delivery?.purchaseOrderId,
    status: 'COMPLETED',
  })
  const productsQuery = useAllProducts()
  const warehousesQuery = useAllWarehouses()
  const suppliersQuery = useSuppliers({ includeInactive: 'true' })
  const complete = useCompleteIncomingDelivery()
  const [drafts, setDrafts] = useState<Record<number, ReceiptDraft>>({})
  const [noReceipt, setNoReceipt] = useState(false)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const lock = useRef(false)
  const order = orderQuery.data
  const warehouse = warehousesQuery.data?.find(
    (warehouse) => warehouse.id === delivery?.warehouseId,
  )
  const supplier = suppliersQuery.data?.find((supplier) => supplier.id === order?.supplierId)
  const rows = order
    ? incomingReceiptRows(
        order,
        (historyQuery.data ?? []).filter((receipt) => receipt.id !== id),
        productsQuery.data ?? [],
      )
    : []
  const queries = [
    deliveryQuery,
    productsQuery,
    warehousesQuery,
    suppliersQuery,
    historyQuery,
    ...(delivery?.purchaseOrderId ? [orderQuery] : []),
  ]
  const loading =
    queries.some((query) => query.isLoading) ||
    (!deliveryQuery.isFetchedAfterMount && deliveryQuery.isFetching)
  const fetching = queries.some((query) => query.isFetching)
  const loadError = queries.find((query) => query.isError)?.error
  let dataIssue: string | undefined
  if (!loading && !loadError) {
    if (!canReceive) dataIssue = 'You do not have permission to confirm incoming receipts.'
    else if (!delivery || delivery.id !== id)
      dataIssue = 'The saved delivery could not be found. Refresh and review it before receiving.'
    else if (delivery.status !== 'SCHEDULED')
      dataIssue =
        'Only a scheduled delivery can be received. This delivery’s status has changed; review it in Incoming Deliveries.'
    else if (
      !order ||
      order.id !== delivery.purchaseOrderId ||
      !['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status)
    )
      dataIssue =
        'The purchase order is unavailable or cannot receive goods. Refresh and review the order.'
    else if (!warehouse?.isActive)
      dataIssue =
        'The receiving warehouse is missing or inactive. Refresh and review this delivery.'
    else if (
      !rows.length ||
      rows.some((row) => row.outstanding === null || row.previouslyReceived === null)
    )
      dataIssue =
        'The receiving balance is unavailable. Refresh the delivery and purchase order before confirming goods.'
  }
  const validation = validateIncomingReceipt(rows, drafts, noReceipt, reason)
  const busy = complete.isPending || refreshing
  const canSubmit =
    canReceive && !busy && !loading && !fetching && !loadError && !dataIssue && !needsRefresh
  async function refresh() {
    if (lock.current || busy) return
    setRefreshing(true)
    try {
      const results = await Promise.all(queries.map((query) => query.refetch()))
      const failed = results.some((result) => result.isError)
      setNeedsRefresh(failed)
      setMessage(
        failed
          ? 'The receipt could not be fully refreshed. Check your connection and try refreshing again.'
          : '',
      )
    } finally {
      setRefreshing(false)
    }
  }
  async function submit() {
    if (lock.current || !canSubmit) return
    setSubmitted(true)
    setMessage('')
    if (validation.error) {
      setMessage(validation.error)
      return
    }
    lock.current = true
    try {
      await complete.mutateAsync({ id, payload: validation.payload })
      onSuccess()
    } catch (cause) {
      setMessage(
        `${getErrorMessage(cause)} Refresh this delivery and review its status and receiving balance before trying again.`,
      )
      setNeedsRefresh(true)
    } finally {
      lock.current = false
    }
  }
  return {
    delivery,
    order,
    warehouse,
    supplier,
    rows,
    drafts,
    noReceipt,
    setNoReceipt,
    reason,
    setReason,
    setQuantity: (id: number, field: 'received' | 'damaged', value: string) =>
      setDrafts((current) => ({
        ...current,
        [id]: { ...(current[id] ?? { received: '', damaged: '' }), [field]: value },
      })),
    lineErrors: submitted ? validation.errors : {},
    reasonError:
      submitted && noReceipt && !reason.trim() ? 'Explain why no goods were received.' : undefined,
    error: loadError
      ? `Receipt data could not be loaded. ${getErrorMessage(loadError)}`
      : (dataIssue ?? message),
    busy,
    refreshing,
    loading,
    fetching,
    canSubmit,
    submit,
    refresh,
  }
}
