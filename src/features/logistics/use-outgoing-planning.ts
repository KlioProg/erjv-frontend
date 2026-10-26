import { useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useSalesOrders, useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { useWarehouses } from './warehouses.hooks'
import {
  useCreateOutgoingDeliveryDraft,
  useUpdateOutgoingDeliveryDraft,
  useScheduleOutgoingDelivery,
  useOutgoingPlanningOptions,
} from './outgoing-deliveries.hooks'
import { fetchOutgoingDeliveryByIdApi } from './outgoing-deliveries.api'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import { outgoingPlanningErrors, outgoingPlanningMaximum } from './outgoing-planning'
import { DeliveryUtils } from './delivery-utils'

function draftQuantities(draft?: OutgoingDeliveryRecord | null) {
  return Object.fromEntries(
    (draft?.plannedItems ?? []).map((item) => [item.salesOrderItemId, item.plannedQuantity]),
  )
}

export function useOutgoingPlanning(
  initialDraft?: OutgoingDeliveryRecord | null,
  preselectedOrderId?: number,
) {
  const ordersQuery = useSalesOrders()
  const clientsQuery = useClients()
  const warehousesQuery = useWarehouses()
  const productsQuery = useProducts()
  const create = useCreateOutgoingDeliveryDraft()
  const update = useUpdateOutgoingDeliveryDraft()
  const schedule = useScheduleOutgoingDelivery()
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
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (initialDraft)
      return initialDraft.scheduledAt
        ? DeliveryUtils.toDateTimeInput(new Date(initialDraft.scheduledAt))
        : ''
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return DeliveryUtils.toDateTimeInput(date)
  })
  const [notes, setNotes] = useState(initialDraft?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [limits, setLimits] = useState<Record<number, string>>({})
  const [completed, setCompleted] = useState<'DRAFT' | 'SCHEDULED' | null>(null)
  const [phase, setPhase] = useState<'checking' | 'saving' | 'scheduling' | null>(null)
  const lock = useRef(false)
  const orderQuery = useSalesOrderById(Number(selectedOrderId) || undefined)
  const planningQuery = useOutgoingPlanningOptions(
    Number(selectedOrderId) || undefined,
    Number(warehouseId) || undefined,
  )
  const order = orderQuery.data
  const eligibleOrders = (ordersQuery.data ?? []).filter((order) =>
    ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status),
  )
  const activeWarehouses = (warehousesQuery.data ?? []).filter((warehouse) => warehouse.isActive)
  const eligible = !!order && ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status)
  const activeWarehouse = activeWarehouses.some((warehouse) => String(warehouse.id) === warehouseId)
  const required = [
    ordersQuery,
    warehousesQuery,
    ...(selectedOrderId ? [orderQuery] : []),
    ...(selectedOrderId && warehouseId ? [planningQuery] : []),
  ]
  const loading = required.some((query) => query.isLoading)
  const loadFailed = required.some((query) => query.isError)
  const busy = phase !== null || create.isPending || update.isPending || schedule.isPending
  const lineErrors =
    order && activeWarehouse && !planningQuery.isFetching && !planningQuery.isError
      ? outgoingPlanningErrors(order, planningQuery.data ?? [], quantities, limits)
      : {}

  async function refresh() {
    setLimits({})
    await Promise.all([
      ordersQuery.refetch(),
      warehousesQuery.refetch(),
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
    setScheduledAt(
      latestDraft.scheduledAt
        ? DeliveryUtils.toDateTimeInput(new Date(latestDraft.scheduledAt))
        : '',
    )
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
  async function submit(intent: 'draft' | 'schedule') {
    if (lock.current || completed || reviewRequired) return
    lock.current = true
    setPhase('checking')
    setErrors({})
    let persisted = savedDraft
    try {
      if (persisted && persisted.status !== 'DRAFT')
        throw new Error(
          'This delivery can no longer be edited or scheduled. Review it in Outgoing Deliveries.',
        )
      if (!selectedOrderId) return failField('sales-order', 'Choose a Sales Order to fulfill.')
      if (!warehouseId) return failField('warehouse', 'Choose an active source warehouse.')
      if (
        (intent === 'schedule' && !scheduledAt) ||
        (scheduledAt && !Number.isFinite(new Date(scheduledAt).getTime()))
      )
        return failField('scheduled-at', 'Enter a valid scheduled date and time.')
      const [freshOrder, freshWarehouses, freshPlanning] = await Promise.all([
        orderQuery.refetch(),
        warehousesQuery.refetch(),
        planningQuery.refetch(),
      ])
      if (
        freshOrder.isError ||
        freshWarehouses.isError ||
        freshPlanning.isError ||
        !freshOrder.data ||
        !freshPlanning.data
      )
        throw new Error(
          'Current planning availability could not be checked. Retry loading before saving.',
        )
      if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(freshOrder.data.status))
        return failField('sales-order', 'This Sales Order is no longer available for planning.')
      if (
        !freshWarehouses.data?.some(
          (warehouse) => warehouse.isActive && String(warehouse.id) === warehouseId,
        )
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
      if (intent === 'schedule' && !plannedItems.length)
        return failField(
          'plan',
          'Enter a positive planned quantity for at least one product before scheduling.',
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
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
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
      if (intent === 'schedule') {
        if (!persisted.scheduledAt || !persisted.warehouseId || !persisted.plannedItems?.length)
          throw new Error(
            'The saved draft is incomplete. Review its warehouse, date, and planned quantities before scheduling.',
          )
        setPhase('scheduling')
        await schedule.mutateAsync({ id: persisted.id, expectedRevision: persisted.revision })
        setCompleted('SCHEDULED')
      } else {
        toast.success(`Delivery draft "${persisted.deliveryNumber}" saved`)
        setCompleted('DRAFT')
      }
    } catch (error) {
      const conflict = axios.isAxiosError(error) ? error.response?.data : undefined
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      if (axios.isAxiosError(error) && (status === undefined || status >= 500)) {
        setReviewRequired(true)
        setErrors({
          request: 'The result is uncertain; the server may have saved or scheduled this delivery. Review the saved record before retrying. Your input is preserved.',
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
        WAREHOUSE_CAPACITY_CHANGED:
          'Warehouse planning capacity changed. Review the refreshed limits and adjust the highlighted quantities.',
        PLAN_LIMIT_EXCEEDED:
          'A planned quantity exceeds the current limit. Review the highlighted quantities.',
        INVALID_DELIVERY_STATE:
          'This delivery can no longer be edited or scheduled in its current state. Review the latest record.',
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
        ['ORDER_CAPACITY_CHANGED', 'WAREHOUSE_CAPACITY_CHANGED', 'PLAN_LIMIT_EXCEEDED'].includes(
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
    orders: eligibleOrders,
    clients: clientsQuery.data ?? [],
    products: productsQuery.data ?? [],
    activeWarehouses,
    order,
    selectedOrderId,
    warehouseId,
    quantities,
    scheduledAt,
    notes,
    setScheduledAt,
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
