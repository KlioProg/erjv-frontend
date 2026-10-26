import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { useStockItems } from './stock-items.hooks'
import { useWarehouses } from './warehouses.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { useCreateManualQuarantine, useRefreshQuarantine } from './quarantine.hooks'
import { fetchQuarantineLotsApi } from './stock-items.api'
import type { CreateManualQuarantinePayload } from './stock-items.types'
import { parseStockCents } from './stock-display'
import { getErrorMessage } from '@/lib/api-client'

export function useQuarantineTag(onClose: () => void, stockItemId?: number) {
  const { user, isAdmin, isManager, isStaff } = useAuth()
  const canTag =
    isAdmin ||
    isManager ||
    isStaff ||
    ['ADMIN', 'MANAGER', 'SUPERADMIN', 'STAFF'].includes(user?.role ?? '')
  const stocks = useStockItems(),
    warehouses = useWarehouses(),
    products = useProducts()
  const create = useCreateManualQuarantine(),
    refresh = useRefreshQuarantine()
  const [warehouseId, setWarehouseId] = useState('')
  const [selectedStockId, setSelectedStockId] = useState(stockItemId ? String(stockItemId) : '')
  const [condition, setCondition] = useState<'DAMAGED' | 'SPOILED'>('DAMAGED')
  const [quantity, setQuantity] = useState(''),
    [reason, setReason] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [needsReview, setNeedsReview] = useState(false)
  const [uncertain, setUncertain] = useState<CreateManualQuarantinePayload | null>(null)
  const [recorded, setRecorded] = useState(false)
  const lock = useRef(false)
  const selected = stocks.data?.find((stock) => String(stock.id) === selectedStockId)
  const currentWarehouseId = warehouseId || (selected ? String(selected.warehouseId) : '')
  const queries = [stocks, warehouses, products]
  const loading = queries.some((query) => query.isLoading),
    fetching = queries.some((query) => query.isFetching)
  const loadError = queries.find((query) => query.isError)?.error
  const options = (stocks.data ?? []).filter(
    (stock) =>
      String(stock.warehouseId) === currentWarehouseId &&
      warehouses.data?.some(
        (warehouse) => warehouse.id === stock.warehouseId && warehouse.isActive,
      ) &&
      products.data?.some((product) => product.id === stock.inventoryItemId && product.isActive),
  )
  const available = parseStockCents(selected?.availableQuantity)
  const finish = () => {
    toast.success('Stock recorded in quarantine')
    onClose()
  }
  async function refreshData() {
    if (lock.current || busy) return
    setBusy(true)
    try {
      await refresh()
      if (recorded) {
        finish()
        return
      }
      if (uncertain) {
        const lots = await fetchQuarantineLotsApi(uncertain.stockItemId)
        const lot = lots.find((lot) => lot.requestId === uncertain.requestId)
        if (
          lot &&
          lot.stockItemId === uncertain.stockItemId &&
          parseStockCents(lot.initialQuantity) === parseStockCents(uncertain.quantity) &&
          lot.reportedCondition === uncertain.condition &&
          lot.tagReason === uncertain.reason
        ) {
          finish()
          return
        }
      }
      setNeedsReview(false)
      setError(
        uncertain
          ? 'No matching tag was found in the refreshed lots. Retry the same request to avoid recording it twice.'
          : '',
      )
    } catch (cause) {
      setError(
        `Current quarantine and stock data could not be refreshed. ${getErrorMessage(cause)}`,
      )
      setNeedsReview(true)
    } finally {
      setBusy(false)
    }
  }
  async function submit() {
    if (
      lock.current ||
      busy ||
      loading ||
      fetching ||
      loadError ||
      !canTag ||
      needsReview ||
      recorded
    )
      return
    let payload = uncertain
    if (!payload) {
      const amount = parseStockCents(quantity)
      if (
        !selected ||
        !options.some((stock) => stock.id === selected.id) ||
        amount === null ||
        amount <= 0n ||
        available === null ||
        amount > available ||
        !reason.trim()
      ) {
        setError(
          'Select an active warehouse and product, enter a positive quantity within its available stock, and provide an inspection reason.',
        )
        return
      }
      payload = {
        stockItemId: selected.id,
        condition,
        quantity: quantity.trim(),
        reason: reason.trim(),
        requestId,
      }
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await create.mutateAsync(payload)
      setRecorded(true)
      try {
        await refresh()
        finish()
      } catch {
        setNeedsReview(true)
        setError(
          'Quarantine was recorded, but inventory could not be refreshed. Refresh the data before recording another tag.',
        )
      }
    } catch (cause) {
      const uncertainResult =
        !isAxiosError(cause) || !cause.response || cause.response.status >= 500
      if (uncertainResult) setUncertain(payload)
      setNeedsReview(true)
      setError(
        `${getErrorMessage(cause)} Refresh the lots and stock before continuing${uncertainResult ? '; the tag may already have been recorded' : ''}.`,
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return {
    canTag,
    warehouseId: currentWarehouseId,
    setWarehouseId: (value: string) => {
      setWarehouseId(value)
      setSelectedStockId('')
    },
    stockId: selectedStockId,
    setStockId: setSelectedStockId,
    condition,
    setCondition,
    quantity,
    setQuantity,
    reason,
    setReason,
    warehouses: (warehouses.data ?? []).filter((warehouse) => warehouse.isActive),
    stocks: options,
    selected,
    available,
    error: loadError ? `Stock data could not be loaded. ${getErrorMessage(loadError)}` : error,
    loading,
    fetching,
    busy,
    canEdit: canTag && !busy && !loading && !fetching && !loadError && !uncertain && !recorded,
    canSubmit: canTag && !busy && !loading && !fetching && !loadError && !needsReview && !recorded,
    retrying: !!uncertain,
    submit,
    refreshData,
  }
}
