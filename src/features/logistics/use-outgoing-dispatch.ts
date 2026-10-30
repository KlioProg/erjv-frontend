import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchSalesOrderByIdApi } from '@/features/crm/sales-orders.api'
import { fetchEmployeeByIdApi } from '@/features/staffing/staffing.api'
import { getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import { fetchOutgoingDeliveryByIdApi } from './outgoing-deliveries.api'
import { fetchVehicleByIdApi } from './delivery-vehicles.api'
import { fetchStockItemByPairApi } from './stock-items.api'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { fetchDeliveryRunsPageApi } from './delivery-runs.api'
import { useDeliveryRunById, useDispatchDeliveryRun } from './delivery-runs.hooks'
import { fetchWarehouseByIdApi } from './warehouses.api'
import type { DeliveryRunRecord } from './delivery-runs.types'
import { validateRunLoad, type RunLoadRow } from './run-load-validation'
import { parseStockCents } from './stock-display'

export function useOutgoingDispatch(runId: number, onSuccess: () => void) {
  const { isAdmin, isManager, isStaff } = useAuth()
  const runQuery = useDeliveryRunById(runId)
  const run = runQuery.data
  const queryClient = useQueryClient()
  const mutation = useDispatchDeliveryRun()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [loadedWeightKg, setLoadedWeightKg] = useState('')
  const [reviewed, setReviewed] = useState<string | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [refreshing, setRefreshing] = useState(false)
  const lock = useRef(false)
  const contextKey = (current: DeliveryRunRecord | undefined) => [
    'delivery-runs',
    'load-context',
    runId,
    current?.revision,
    current?.deliveries.map((member) => `${member.id}:${member.revision}`).join(','),
  ]
  async function loadContext(run: DeliveryRunRecord) {
    const [deliveries, vehicle, driver, activeDriverRuns, warehouse] = await Promise.all([
      Promise.all(run.deliveries.map((member) => fetchOutgoingDeliveryByIdApi(member.id))),
      run.deliveryVehicleId ? fetchVehicleByIdApi(run.deliveryVehicleId) : null,
      run.driverEmployeeId ? fetchEmployeeByIdApi(run.driverEmployeeId) : null,
      run.driverEmployeeId
        ? fetchDeliveryRunsPageApi({
            driverEmployeeId: run.driverEmployeeId,
            statuses: ['DISPATCHED'],
            limit: 1,
          })
        : null,
      fetchWarehouseByIdApi(run.warehouseId),
    ])
    const orders = await Promise.all(
      deliveries.map((delivery) =>
        delivery ? fetchSalesOrderByIdApi(delivery.salesOrderId) : null,
      ),
    )
    const productIds = [
      ...new Set(
        deliveries.flatMap(
          (delivery, index) =>
            delivery?.plannedItems
              .map(
                (plan) =>
                  orders[index]?.items.find((item) => item.id === plan.salesOrderItemId)
                    ?.inventoryItemId,
              )
              .filter((id): id is number => id !== undefined) ?? [],
        ),
      ),
    ]
    const sources = await Promise.all(
      productIds.map(async (id) => ({
        id,
        stock: await fetchStockItemByPairApi(id, run.warehouseId),
        product: await fetchProductByIdApi(id),
      })),
    )
    const rows: RunLoadRow[] = []
    deliveries.forEach((delivery, index) => {
      const order = orders[index]
      const member = run.deliveries[index]
      if (
        !delivery ||
        delivery.id !== member.id ||
        delivery.runId !== runId ||
        delivery.status !== 'READY' ||
        delivery.revision !== member.revision ||
        delivery.warehouseId !== run.warehouseId ||
        !order ||
        !['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status) ||
        !delivery.plannedItems.length
      )
        throw Error(
          'A member plan, revision, source warehouse, or order status changed. Refresh and review the run.',
        )
      for (const plan of delivery.plannedItems) {
        const line = order.items.find((item) => item.id === plan.salesOrderItemId)
        const source = sources.find((source) => source.id === line?.inventoryItemId)
        if (
          !line ||
          !source?.stock ||
          source.stock.inventoryItemId !== line.inventoryItemId ||
          source.stock.warehouseId !== run.warehouseId ||
          !source.product?.name ||
          !source.product.unit ||
          parseStockCents(source.stock.availableQuantity) === null
        )
          throw Error(
            'A planned product cannot be matched to unique source stock. Refresh before departure.',
          )
        rows.push({
          key: `${delivery.id}:${plan.salesOrderItemId}`,
          deliveryId: delivery.id,
          deliveryNumber: delivery.deliveryNumber,
          expectedRevision: delivery.revision,
          salesOrderItemId: plan.salesOrderItemId,
          stockItemId: source.stock.id,
          productName: source.product.name,
          unit: source.product.unit,
          plannedQuantity: plan.plannedQuantity,
          availableQuantity: source.stock.availableQuantity!,
        })
      }
    })
    return { deliveries, rows, vehicle, driver, activeDriverRuns, warehouse }
  }
  const context = useQuery({
    queryKey: contextKey(run),
    enabled: !!run,
    staleTime: 0,
    queryFn: () => {
      if (!run) throw Error('Run details are unavailable.')
      return loadContext(run)
    },
  })
  const rows = context.data?.rows ?? []
  const signature =
    run && context.data
      ? JSON.stringify([
          run.revision,
          run.deliveries.map((member) => [member.id, member.revision]),
          context.data.deliveries.map((delivery) => [delivery?.id, delivery?.revision]),
        ])
      : null
  if (signature && reviewed === null && runQuery.isFetchedAfterMount && context.isFetchedAfterMount)
    setReviewed(signature)
  const warehouse = context.data?.warehouse
  const vehicle = context.data?.vehicle
  const driver = context.data?.driver
  const fetching = runQuery.isFetching || context.isFetching
  const busy = mutation.isPending || refreshing
  let issue: string | undefined
  if (!(isAdmin || isManager || isStaff)) issue = 'You do not have permission to dispatch runs.'
  else if (runQuery.isError || context.isError)
    issue = getErrorMessage(runQuery.error ?? context.error)
  else if (!run || !context.data || !warehouse)
    issue = 'Loading current run, member plans, stock, and assignments...'
  else if (run.status !== 'DRAFT') issue = 'Only a draft run can depart. Review its current status.'
  else if (reviewed !== signature)
    issue = 'The run or a member revision changed. Refresh and review the updated loads.'
  else if (!warehouse.isActive || !run.scheduledDepartureAt || !run.deliveries.length)
    issue = 'An active source warehouse, departure schedule, and members are required.'
  else if (
    !vehicle?.isActive ||
    vehicle.operationalStatus !== 'SERVICEABLE' ||
    !vehicle.isAvailable ||
    vehicle.activeRunId !== null
  )
    issue = 'The assigned vehicle is unavailable. Edit the run assignments before departure.'
  else if (!driver?.isActive || !driver.canDrive || context.data.activeDriverRuns?.items.length)
    issue =
      'The assigned driver is ineligible or already on a dispatched run. Edit the run assignments.'
  else if (
    parseStockCents(vehicle.capacityKg) === null ||
    parseStockCents(vehicle.capacityKg)! <= 0n
  )
    issue = 'Configure a positive vehicle capacity in kilograms before departure.'
  const canSubmit = !issue && !fetching && !busy && !needsRefresh
  async function refresh() {
    if (lock.current || busy) return
    setRefreshing(true)
    try {
      const result = await runQuery.refetch()
      const latest = result.data
      if (result.isError || !latest)
        throw Error('Run details could not be refreshed. Your entries have been kept.')
      const details = await queryClient.fetchQuery({
        queryKey: contextKey(latest),
        queryFn: () => loadContext(latest),
        staleTime: 0,
      })
      setReviewed(
        JSON.stringify([
          latest.revision,
          latest.deliveries.map((member) => [member.id, member.revision]),
          details.deliveries.map((delivery) => [delivery?.id, delivery?.revision]),
        ]),
      )
      setNeedsRefresh(false)
      setMessage('')
    } catch (cause) {
      setNeedsRefresh(true)
      setMessage(getErrorMessage(cause))
    } finally {
      setRefreshing(false)
    }
  }
  async function submit() {
    if (lock.current || !canSubmit || !run) return
    setMessage('')
    setFieldErrors({})
    let payload
    try {
      const weight = parseStockCents(loadedWeightKg)
      const capacity = parseStockCents(vehicle?.capacityKg)
      if (
        weight === null ||
        weight <= 0n ||
        weight > 999_999_999_999n ||
        capacity === null ||
        weight > capacity
      )
        throw Error(
          'Enter a positive actual loaded weight within the vehicle capacity, with up to two decimals.',
        )
      payload = {
        expectedRevision: run.revision,
        loadedWeightKg: loadedWeightKg.trim(),
        ...validateRunLoad(run.deliveries, rows, quantities),
      }
    } catch (cause) {
      setMessage(getErrorMessage(cause))
      return
    }
    lock.current = true
    try {
      const saved = await mutation.mutateAsync({ id: runId, payload })
      if (
        saved?.id !== runId ||
        saved.status !== 'DISPATCHED' ||
        !Number.isSafeInteger(saved.revision) ||
        saved.revision <= payload.expectedRevision
      )
        throw Error('The server did not confirm run departure. Refresh and review before retrying.')
      onSuccess()
    } catch (cause) {
      setNeedsRefresh(true)
      const issues = getApiFieldErrors(cause)
      const mapped: Record<string, string> = {}
      if (issues.loadedWeightKg) mapped.loadedWeightKg = issues.loadedWeightKg
      payload.loads.forEach((load, loadIndex) => load.items.forEach((item, itemIndex) => {
        const issue = issues[`loads.${loadIndex}.items.${itemIndex}.loadedQuantity`]
        if (issue) mapped[`${load.deliveryId}:${item.salesOrderItemId}`] = issue
      }))
      setFieldErrors(mapped)
      setMessage(
        `${getErrorMessage(cause)} Refresh and review before trying again. Your entries have been kept.`,
      )
    } finally {
      lock.current = false
    }
  }
  return {
    run,
    rows,
    warehouse,
    vehicle,
    driver,
    quantities,
    loadedWeightKg,
    fieldErrors,
    setLoadedWeightKg,
    busy,
    canSubmit,
    fetching,
    error: message || issue,
    refresh,
    submit,
    setQuantity: (key: string, value: string) =>
      setQuantities((current) => ({ ...current, [key]: value })),
    usePlannedQuantities: () => {
      if (!canSubmit || !run) return
      const proposed = Object.fromEntries(rows.map((row) => [row.key, row.plannedQuantity]))
      try {
        validateRunLoad(run.deliveries, rows, proposed)
        setQuantities(proposed)
        setMessage('')
      } catch (cause) {
        setMessage(getErrorMessage(cause))
      }
    },
  }
}
