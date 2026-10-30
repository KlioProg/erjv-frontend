import { useRef, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useQueries } from '@tanstack/react-query'
import { productKeys } from '@/features/products/products.hooks'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import {
  useCompleteIncomingDelivery,
  useIncomingDeliveryById,
  useIncomingDeliveries,
} from './incoming-deliveries.hooks'
import { usePurchaseOrderById } from './purchase-orders.hooks'
import { useSupplierById } from './suppliers.hooks'
import { useWarehouse } from './warehouses.hooks'
import {
  incomingReceiptLines,
  validateIncomingReceipt,
  type IncomingReceiptCounts,
} from './incoming-receiving'
import type {
  IncomingDeliveryRecord,
  CompleteIncomingDeliveryPayload,
} from './incoming-deliveries.types'
import { decimalString } from './purchase-pricing'

export type ReceiptOutcome = 'all' | 'partial' | 'none'
const receiptSignature = (
  delivery: IncomingDeliveryRecord,
  lines: ReturnType<typeof incomingReceiptLines>,
) =>
  JSON.stringify([
    delivery.id,
    delivery.revision,
    delivery.status,
    delivery.purchaseOrderId,
    delivery.warehouseId,
    lines.map(({ item, outstanding }) => [item.id, outstanding?.toString() ?? null]),
  ])

export function useIncomingReceiving(delivery: IncomingDeliveryRecord, onClose: () => void) {
  const latest = useIncomingDeliveryById(delivery.id)
  const purchase = usePurchaseOrderById(delivery.purchaseOrderId)
  const receipts = useIncomingDeliveries({
    purchaseOrderId: delivery.purchaseOrderId,
    status: 'COMPLETED',
  })
  const productIds = [...new Set((purchase.data?.items ?? []).map((item) => item.inventoryItemId))]
  const products = useQueries({ queries: productIds.map((id) => ({
    queryKey: productKeys.detail(id), queryFn: () => fetchProductByIdApi(id),
  })) })
  const supplier = useSupplierById(purchase.data?.supplierId ?? undefined)
  const warehouse = useWarehouse(latest.data?.warehouseId ?? delivery.warehouseId)
  const complete = useCompleteIncomingDelivery()
  const { isAdmin, isManager } = useAuth()
  const [outcome, setOutcome] = useState<ReceiptOutcome | null>(null)
  const [pendingOutcome, setPendingOutcome] = useState<ReceiptOutcome | null>(null)
  const [counts, setCounts] = useState<IncomingReceiptCounts>({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [serverErrors, setServerErrors] = useState<Record<number, { received?: string; damaged?: string }>>({})
  const [checking, setChecking] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [fullReceipt, setFullReceipt] = useState<{
    signature: string
    items: CompleteIncomingDeliveryPayload['items']
  } | null>(null)
  const inFlight = useRef(false)
  const lines = purchase.data
    ? incomingReceiptLines(purchase.data, receipts.data ?? [], delivery.id)
    : []
  const rows = lines.map((line) => ({
    ...line,
    product: products.find((query) => query.data?.id === line.item.inventoryItemId)?.data,
  }))
  const signature = latest.data ? receiptSignature(latest.data, lines) : ''
  const validation = validateIncomingReceipt(lines, counts)
  const invalidLines =
    !rows.length ||
    new Set(rows.map((row) => row.item.id)).size !== rows.length ||
    rows.some((row) => !Number.isSafeInteger(row.item.id) || row.item.id <= 0)
  const regularUnavailable =
    invalidLines ||
    products.some((query) => query.isFetching || query.isError) ||
    rows.some((row) => !row.product?.name || !row.product.unit || row.outstanding === null)
  const loading = latest.isFetching || purchase.isFetching || receipts.isFetching
  const loadFailed = latest.isError || purchase.isError || receipts.isError
  const disabled =
    needsRefresh ||
    checking ||
    complete.isPending ||
    loading ||
    loadFailed ||
    !latest.data ||
    !purchase.data ||
    latest.data.status !== 'SCHEDULED' ||
    !(isAdmin || isManager)
  const validOutcome =
    outcome === 'none'
      ? !!reason.trim()
      : outcome === 'all'
        ? fullReceipt?.signature === signature &&
          fullReceipt.items.length > 0 &&
          !regularUnavailable
        : outcome === 'partial' &&
          !regularUnavailable &&
          validation.items.length > 0 &&
          !Object.keys(validation.errors).length

  async function currentReceipt() {
    const [freshDelivery, freshPurchase, freshReceipts] = await Promise.all([
      latest.refetch(),
      purchase.refetch(),
      receipts.refetch(),
    ])
    if (
      freshDelivery.isError ||
      freshPurchase.isError ||
      freshReceipts.isError ||
      !freshDelivery.data ||
      !freshPurchase.data ||
      !freshReceipts.data
    )
      throw Error(
        'Current delivery, purchase order, or receipts could not be checked. Retry before confirming.',
      )
    if (freshDelivery.data.status !== 'SCHEDULED')
      throw Error('Only a scheduled delivery can be received. Close and review its current status.')
    if (
      freshDelivery.data.purchaseOrderId !== delivery.purchaseOrderId ||
      freshPurchase.data.id !== delivery.purchaseOrderId
    )
      throw Error('The delivery purchase order changed. Close and reload before receiving.')
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(freshPurchase.data.status))
      throw Error(
        'This purchase order is no longer available for receiving. Close and review its current status.',
      )
    const currentLines = incomingReceiptLines(freshPurchase.data, freshReceipts.data, delivery.id)
    return { lines: currentLines, signature: receiptSignature(freshDelivery.data, currentLines), revision: freshDelivery.data.revision }
  }
  async function applyOutcome(next: ReceiptOutcome) {
    if (disabled || inFlight.current) return
    setError('')
    setPendingOutcome(null)
    setOutcome(next)
    if (next !== 'all') return
    inFlight.current = true
    setChecking(true)
    setFullReceipt(null)
    try {
      const fresh = await currentReceipt()
      if (
        !fresh.lines.length ||
        fresh.lines.some((line) => line.outstanding === null) ||
        regularUnavailable
      )
        throw Error(
          'Full receipt is unavailable because current products or outstanding quantities could not be verified. Review the receipt or reload.',
        )
      const items = fresh.lines
        .filter((line) => line.outstanding! > 0n)
        .map(({ item, outstanding }) => ({
          purchaseOrderItemId: item.id,
          receivedQuantity: decimalString(outstanding!),
          damagedQuantity: '0.00',
        }))
      if (!items.length)
        throw Error(
          'No positive outstanding quantities remain. Review the purchase order before recording a receipt.',
        )
      setFullReceipt({ signature: fresh.signature, items })
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }
  function chooseOutcome(next: ReceiptOutcome) {
    if (disabled || inFlight.current) return
    if (
      outcome === 'partial' &&
      next !== 'partial' &&
      Object.values(counts).some(
        (count) => count.received.trim() || (count.damaged.trim() && count.damaged !== '0'),
      )
    ) {
      setPendingOutcome(next)
      setError('')
    } else void applyOutcome(next)
  }
  async function submit() {
    if (disabled || inFlight.current || pendingOutcome || !validOutcome) return
    inFlight.current = true
    setChecking(true)
    setError('')
    setServerErrors({})
    let mutationStarted = false
    let items: CompleteIncomingDeliveryPayload['items'] = []
    try {
      const fresh = await currentReceipt()
      if (fresh.revision !== latest.data?.revision) {
        setNeedsRefresh(true)
        throw Error('The delivery or outstanding quantities changed. Your input is preserved. Refresh and review the receipt before confirming again.')
      }
      if (outcome === 'all') {
        if (!fullReceipt || fresh.signature !== fullReceipt.signature) {
          setFullReceipt(null)
          throw Error(
            'Outstanding quantities changed. Review the current products and select full receipt again.',
          )
        }
        items = fullReceipt.items
      } else if (outcome === 'partial') {
        const current = validateIncomingReceipt(fresh.lines, counts)
        if (!current.items.length || Object.keys(current.errors).length)
          throw Error(
            'Review the received and damaged quantities against current outstanding goods.',
          )
        items = current.items
      }
      mutationStarted = true
      await complete.mutateAsync({
        id: delivery.id,
        expectedRevision: fresh.revision,
        items,
        ...(outcome === 'none' ? { noReceiptReason: reason.trim() } : {}),
      })
      onClose()
    } catch (cause) {
      const issues = getApiFieldErrors(cause)
      setServerErrors(Object.fromEntries(items.map((item, index) => [item.purchaseOrderItemId, {
        ...(issues[`items.${index}.receivedQuantity`] ? { received: issues[`items.${index}.receivedQuantity`] } : {}),
        ...(issues[`items.${index}.damagedQuantity`] ? { damaged: issues[`items.${index}.damagedQuantity`] } : {}),
      }])))
      setNeedsRefresh((current) => current || mutationStarted)
      setError(getErrorMessage(cause))
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }
  return {
    canReceive: isAdmin || isManager,
    refresh: async () => {
      if (inFlight.current) return
      inFlight.current = true
      setChecking(true)
      try {
        await currentReceipt()
        const metadata = await Promise.all(products.map((query) => query.refetch()))
        if (metadata.some((result) => result.isError)) throw Error('Product details could not be loaded. Retry before recording received quantities.')
        setNeedsRefresh(false)
        setError('')
      } catch (cause) {
        setError(getErrorMessage(cause))
      } finally {
        inFlight.current = false
        setChecking(false)
      }
    },
    purchase: purchase.data,
    latest: latest.data,
    rows,
    counts,
    reason,
    setReason,
    outcome,
    pendingOutcome,
    setPendingOutcome,
    chooseOutcome,
    applyOutcome,
    error,
    checking,
    pending: complete.isPending,
    disabled,
    loadFailed,
    loading,
    regularUnavailable,
    fullNeedsReview:
      outcome === 'all' && (!fullReceipt || fullReceipt.signature !== signature) && !checking,
    canSubmit: !!validOutcome && !disabled && !pendingOutcome,
    errors: Object.fromEntries([...new Set([...Object.keys(validation.errors), ...Object.keys(serverErrors)])].map((id) => [id, { ...validation.errors[Number(id)], ...serverErrors[Number(id)] }])),
    submit,
    supplier: supplier.data?.id === purchase.data?.supplierId ? supplier.data : undefined,
    warehouse: warehouse.data?.id === (latest.data?.warehouseId ?? delivery.warehouseId) ? warehouse.data : undefined,
    change: (id: number, field: 'received' | 'damaged', value: string) => {
      setServerErrors((current) => ({ ...current, [id]: Object.fromEntries(Object.entries(current[id] ?? {}).filter(([key]) => key !== field)) }))
      setCounts((current) => ({
        ...current,
        [id]: {
          received: current[id]?.received ?? '',
          damaged: current[id]?.damaged ?? '0',
          [field]: value,
        },
      }))
      setError('')
    },
  }
}
