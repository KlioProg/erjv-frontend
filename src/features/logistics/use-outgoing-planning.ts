import { useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useQueries } from '@tanstack/react-query'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { productKeys } from '@/features/products/products.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { useWarehouse } from './warehouses.hooks'
import {
  useCreateOutgoingDeliveryDraft,
  useUpdateOutgoingDeliveryDraft,
  useReadyOutgoingDelivery,
  useOutgoingPlanningOptions,
} from './outgoing-deliveries.hooks'
import { fetchOutgoingDeliveryByIdApi } from './outgoing-deliveries.api'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import {
  outgoingOrderRemaining,
  outgoingPlanningErrors,
  outgoingPlanningMaximum,
} from './outgoing-planning'

function draftQuantities(draft?: OutgoingDeliveryRecord | null) {
  return Object.fromEntries(
    (draft?.plannedItems ?? []).map((item) => [item.salesOrderItemId, item.plannedQuantity]),
  )
}

export function useOutgoingPlanning(
  initialDraft?: OutgoingDeliveryRecord | null,
  preselectedOrderId?: number,
) {
  const create = useCreateOutgoingDeliveryDraft()
  const update = useUpdateOutgoingDeliveryDraft()
  const ready = useReadyOutgoingDelivery()
  const [savedDraft, setSavedDraft] = useState(initialDraft ?? null)
  const [latestDraft, setLatestDraft] = useState<OutgoingDeliveryRecord | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(
    String(initialDraft?.salesOrderId ?? preselectedOrderId ?? ''),
  )
  const [warehouseId, setWarehouseId] = useState(String(initialDraft?.warehouseId ?? ''))
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    draftQuantities(initialDraft),
  )
  const [notes, setNotes] = useState(initialDraft?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [limits, setLimits] = useState<Record<number, string>>({})
  const [completed, setCompleted] = useState<'DRAFT' | 'READY' | null>(null)
  const [phase, setPhase] = useState<'checking' | 'saving' | 'readying' | null>(null)
  const lock = useRef(false)
  const orderQuery = useSalesOrderById(Number(selectedOrderId) || undefined)
  const planningQuery = useOutgoingPlanningOptions(
    Number(selectedOrderId) || undefined,
    Number(warehouseId) || undefined,
  )
  const order = orderQuery.data
  const warehouseQuery = useWarehouse(Number(warehouseId) || undefined)
  const productQueries = useQueries({ queries: [...new Set((order?.items ?? []).map((item) => item.inventoryItemId))].map((id) => ({
    queryKey: productKeys.detail(id), queryFn: () => fetchProductByIdApi(id),
  })) })
  const eligible = !!order && ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status)
  const activeWarehouse = warehouseQuery.data?.id === Number(warehouseId) && warehouseQuery.data.isActive
  const required = [
    ...(selectedOrderId ? [orderQuery] : []),
    ...(warehouseId ? [warehouseQuery] : []),
    ...(selectedOrderId && warehouseId ? [planningQuery] : []),
    ...productQueries,
  ]
  const loading = required.some((query) => query.isLoading)
  const loadFailed = required.some((query) => query.isError)
  const busy = phase !== null || create.isPending || update.isPending || ready.isPending
  const lineErrors =
    order && activeWarehouse && !planningQuery.isFetching && !planningQuery.isError
      ? outgoingPlanningErrors(order, planningQuery.data ?? [], quantities, limits)
      : {}

  async function refresh() {
    setLimits({})
    await Promise.all([
      ...(warehouseId ? [warehouseQuery.refetch()] : []),
      ...productQueries.map((query) => query.refetch()),
      ...(selectedOrderId ? [orderQuery.refetch()] : []),
      ...(selectedOrderId && warehouseId ? [planningQuery.refetch()] : []),
    ])
  }
  async function fetchLatest(id: number) {
    const latest = await fetchOutgoingDeliveryByIdApi(id)
    if (!latest)
      throw new Error('The saved delivery could not be loaded. Retry loading before continuing.')
    setLatestDraft(latest)
  }
  function loadLatest() {
    if (!latestDraft) return
    setSavedDraft(latestDraft)
    setSelectedOrderId(String(latestDraft.salesOrderId))
    setWarehouseId(String(latestDraft.warehouseId ?? ''))
    setQuantities(draftQuantities(latestDraft))
    setNotes(latestDraft.notes ?? '')
    setLatestDraft(null)
    setReviewRequired(false)
    setErrors({})
    void refresh()
  }
  const failField = (field: string, message: string) => {
    setErrors({ [field]: message })
    requestAnimationFrame(() => document.getElementById(`delivery-${field}`)?.focus())
  }
  async function submit(intent: 'draft' | 'ready') {
    if (lock.current || completed || reviewRequired) return
    lock.current = true
    setPhase('checking')
    setErrors({})
    let persisted = savedDraft
    try {
      if (persisted && persisted.status !== 'DRAFT')
        throw new Error(
          'This delivery can no longer be edited or marked ready. Review it in Outgoing Deliveries.',
        )
      if (!selectedOrderId) return failField('sales-order', 'Choose a Sales Order to fulfill.')
      if (!warehouseId) return failField('warehouse', 'Choose an active source warehouse.')
      const [freshOrder, freshWarehouse, freshPlanning] = await Promise.all([
        orderQuery.refetch(),
        warehouseQuery.refetch(),
        planningQuery.refetch(),
      ])
      if (
        freshOrder.isError ||
        freshWarehouse.isError ||
        freshPlanning.isError ||
        !freshOrder.data ||
        !freshPlanning.data
      )
        throw new Error(
          'Current planning availability could not be checked. Retry loading before saving.',
        )
      if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(freshOrder.data.status))
        return failField('sales-order', 'This Sales Order is no longer available for planning.')
      if (!persisted) {
        const balances = freshOrder.data.items.map((item) =>
          parseOrderDecimal(
            outgoingOrderRemaining(
              freshPlanning.data.find(
                (option) =>
                  option.salesOrderItemId === item.id &&
                  option.inventoryItemId === item.inventoryItemId,
              ),
            ) ?? '',
          ),
        )
        if (!balances.some((balance) => balance !== null && balance > 0n))
          return failField(
            'plan',
            balances.length && balances.every((balance) => balance === 0n)
              ? 'All quantities for this Sales Order are already planned.'
              : 'Current order planning quantities are unavailable. Reload availability before saving.',
          )
      }
      if (
        !freshWarehouse.data?.isActive || String(freshWarehouse.data.id) !== warehouseId
      )
        return failField(
          'warehouse',
          'This warehouse is inactive or unavailable. Choose another warehouse.',
        )
      const validation = outgoingPlanningErrors(
        freshOrder.data,
        freshPlanning.data,
        quantities,
        limits,
      )
      if (Object.keys(validation).length) {
        setErrors(validation)
        requestAnimationFrame(() =>
          document.getElementById(`delivery-${Object.keys(validation)[0]}`)?.focus(),
        )
        return
      }
      const plannedItems = Object.entries(quantities).flatMap(([id, raw]) => {
        const quantity = parseOrderDecimal(raw || '0')!
        return quantity > 0n
          ? [{ salesOrderItemId: Number(id), plannedQuantity: decimalString(quantity) }]
          : []
      })
      if (intent === 'ready' && !plannedItems.length)
        return failField(
          'plan',
          'Enter a positive planned quantity for at least one product before marking ready.',
        )
      setPhase('saving')
      if (!persisted) {
        persisted = await create.mutateAsync({ salesOrderId: Number(selectedOrderId) })
        setSavedDraft(persisted)
      }
      if (
        !Number.isInteger(persisted.id) ||
        persisted.id <= 0 ||
        !Number.isInteger(persisted.revision) ||
        persisted.revision < 1 ||
        persisted.status !== 'DRAFT'
      )
        throw new Error(
          'The server did not confirm a valid draft and revision. Review it in Outgoing Deliveries before continuing.',
        )
      const id = persisted.id
      persisted = await update.mutateAsync({
        id,
        payload: {
          expectedRevision: persisted.revision,
          warehouseId: Number(warehouseId),
          notes: notes.trim() || null,
          plannedItems,
        },
      })
      if (
        persisted.id !== id ||
        persisted.status !== 'DRAFT' ||
        !Number.isInteger(persisted.revision) ||
        persisted.revision < 1
      )
        throw new Error(
          'The server did not confirm the saved draft. Review it in Outgoing Deliveries before continuing.',
        )
      setSavedDraft(persisted)
      if (intent === 'ready') {
        if (!persisted.warehouseId || !persisted.plannedItems?.length)
          throw new Error(
            'The saved draft is incomplete. Review its warehouse and planned quantities before marking ready.',
          )
        setPhase('readying')
        persisted = await ready.mutateAsync({
          id: persisted.id,
          expectedRevision: persisted.revision,
        })
        setSavedDraft(persisted)
        setCompleted('READY')
      } else {
        toast.success(`Delivery draft "${persisted.deliveryNumber}" saved`)
        setCompleted('DRAFT')
      }
      return persisted
    } catch (error) {
      const conflict = axios.isAxiosError(error) ? error.response?.data : undefined
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      if (axios.isAxiosError(error) && (status === undefined || status >= 500)) {
        setReviewRequired(true)
        setErrors({
          request: 'The result is uncertain; the server may have saved this delivery or marked it ready. Review the saved record before retrying. Your input is preserved.',
        })
        if (persisted) {
          try {
            await fetchLatest(persisted.id)
          } catch (loadError) {
            setErrors((current) => ({ ...current, review: getErrorMessage(loadError) }))
          }
        }
        return
      }
      const messages: Record<string, string> = {
        STALE_REVISION:
          'Another user changed this delivery. Review the latest saved draft before continuing. Your unsaved input is kept below.',
        ORDER_CAPACITY_CHANGED:
          'The order planning capacity changed. Review the refreshed limits and adjust the highlighted quantities.',
        PLAN_LIMIT_EXCEEDED:
          'A planned quantity exceeds the current limit. Review the highlighted quantities.',
        INVALID_DELIVERY_STATE:
          'This delivery can no longer be edited or marked ready in its current state. Review the latest record.',
      }
      setErrors({ request: messages[conflict?.code] ?? getErrorMessage(error) })
      if (['STALE_REVISION', 'INVALID_DELIVERY_STATE'].includes(conflict?.code) && persisted) {
        setReviewRequired(true)
        try {
          await fetchLatest(persisted.id)
        } catch (loadError) {
          setErrors((current) => ({ ...current, review: getErrorMessage(loadError) }))
        }
      }
      if (
        ['ORDER_CAPACITY_CHANGED', 'PLAN_LIMIT_EXCEEDED'].includes(
          conflict?.code,
        )
      ) {
        await planningQuery.refetch()
        const details = Array.isArray(conflict.details) ? conflict.details : [conflict.details]
        const currentLimits: Record<number, string> = {}
        for (const detail of details) {
          if (
            Number.isInteger(detail?.salesOrderItemId) &&
            typeof detail?.currentMaximumQuantity === 'string' &&
            parseOrderDecimal(detail.currentMaximumQuantity) !== null
          )
            currentLimits[detail.salesOrderItemId] = detail.currentMaximumQuantity
        }
        setLimits(currentLimits)
      }
    } finally {
      setPhase(null)
      lock.current = false
    }
  }
  return {
    products: productQueries.flatMap((query) => query.data ? [query.data] : []),
    warehouse: warehouseQuery.data,
    order,
    selectedOrderId,
    warehouseId,
    quantities,
    notes,
    setNotes,
    errors: { ...lineErrors, ...errors },
    loading,
    loadFailed,
    busy,
    phase,
    completed,
    savedDraft,
    latestDraft,
    reviewRequired,
    orderOptions: planningQuery.data ?? [],
    options:
      planningQuery.isFetching || planningQuery.isError
        ? []
        : (planningQuery.data ?? []).map((option) => ({
            ...option,
            maximumPlannableQuantity:
              outgoingPlanningMaximum(option, limits[option.salesOrderItemId]) ??
              option.maximumPlannableQuantity,
          })),
    planningLoading: planningQuery.isFetching,
    eligible,
    activeWarehouse,
    submit,
    refresh,
    loadLatest,
    retryLatest: () =>
      savedDraft &&
      fetchLatest(savedDraft.id).catch((error) =>
        setErrors((current) => ({ ...current, review: getErrorMessage(error) })),
      ),
    changeOrder: (id: string) => {
      if (savedDraft) return
      setSelectedOrderId(id)
      setQuantities({})
      setLimits({})
      setErrors({})
    },
    changeWarehouse: (id: string) => {
      setWarehouseId(id)
      setLimits({})
      setErrors({})
    },
    changeQuantity: (id: number, quantity: string) => {
      setQuantities((current) => ({ ...current, [id]: quantity }))
      setErrors({})
    },
  }
}
