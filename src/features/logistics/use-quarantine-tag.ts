import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { useWarehouseStock } from './stock-items.hooks'
import { useStockMetadata } from './use-stock-metadata'
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import type { Warehouse } from './warehouses.types'
import { useWarehouse } from './warehouses.hooks'
import { useCreateManualQuarantine, useRefreshQuarantine } from './quarantine.hooks'
import { fetchQuarantineLotsApi } from './quarantine.api'
import type { CreateManualQuarantinePayload } from './quarantine.types'
import { parseStockCents } from './stock-display'
import { getErrorMessage } from '@/lib/api-client'

export function useQuarantineTag(onClose: () => void, stockItemId?: number) {
  const { user, isAdmin, isManager, isStaff } = useAuth()
  const canTag =
    isAdmin ||
    isManager ||
    isStaff ||
    ['ADMIN', 'MANAGER', 'SUPERADMIN', 'STAFF'].includes(user?.role ?? '')
  const [stockSearch, setStockSearch] = useState('')
  const [warehouseSearch, setWarehouseSearch] = useState('')
  const warehouses = useCursorLookup<Warehouse>('/warehouses', {
    includeInactive: 'false',
    ...(warehouseSearch.trim() ? { q: warehouseSearch.trim() } : {}),
  })
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
  const metadata = useStockMetadata(Number(selectedStockId) || undefined)
  const selected = metadata.data
  const currentWarehouseId = warehouseId || (selected ? String(selected.warehouseId) : '')
  const warehouse = useWarehouse(Number(currentWarehouseId) || undefined)
  const stocks = useWarehouseStock(Number(currentWarehouseId) || undefined, {
    q: stockSearch.trim() || undefined,
  })
  const loading = Boolean(selectedStockId) && metadata.isPending
  const fetching = Boolean(selectedStockId) && (metadata.isFetching || warehouse.isFetching)
  const loadError = selectedStockId ? metadata.error ?? warehouse.error : null
  const options = stocks.data
  const selectedValid =
    !!selected &&
    selected.id === Number(selectedStockId) &&
    String(selected.warehouseId) === currentWarehouseId &&
    selected.inventoryItem.isActive &&
    selected.warehouse.isActive &&
    !warehouse.isError &&
    warehouse.data?.id === selected.warehouseId &&
    warehouse.data.isActive
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
      if (selectedStockId) {
        const checked = await metadata.refetch()
        if (checked.isError) throw checked.error
      }
      if (currentWarehouseId) await warehouse.refetch()
      if (recorded) {
        finish()
        return
      }
      if (uncertain) {
        let page = await fetchQuarantineLotsApi({ stockItemId: uncertain.stockItemId })
        let lot = page.items.find((lot) => lot.requestId === uncertain.requestId)
        const cursors = new Set<string>()
        while (!lot && page.nextCursor) {
          if (cursors.has(page.nextCursor))
            throw Error('The server repeated a cursor. Reload quarantine lots.')
          cursors.add(page.nextCursor)
          page = await fetchQuarantineLotsApi({
            stockItemId: uncertain.stockItemId,
            cursor: page.nextCursor,
          })
          lot = page.items.find((lot) => lot.requestId === uncertain.requestId)
        }
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
      warehouse.isFetching ||
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
        !selectedValid ||
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
    setStockSearch,
    setWarehouseSearch,
    warehousesHaveMore: warehouses.hasNextPage,
    loadMoreWarehouses: () => warehouses.fetchNextPage(),
    warehousesFetching: warehouses.isFetching,
    warehousesLoading: warehouses.isPending,
    warehousesError: warehouses.error,
    reloadWarehouses: warehouses.reload,
    stocksLoading: !!currentWarehouseId && stocks.isPending,
    stocksFetching: stocks.isFetching,
    stocksError: stocks.error,
    reloadStocks: stocks.reload,
    warehouseLabel: warehouse.data?.name ?? selected?.warehouse.name,
    selectionIssue:
      selectedStockId &&
      !loading &&
      !fetching &&
      !loadError &&
      (!selectedValid || available === null || available <= 0n)
        ? 'The selected stock record is inactive, unavailable, or outside the selected warehouse. Choose another record or refresh its details.'
        : '',
    stocksHaveMore: stocks.hasNextPage,
    loadMoreStocks: () => stocks.fetchNextPage(),
    warehouseId: currentWarehouseId,
    setWarehouseId: (value: string) => {
      if (value === currentWarehouseId) return
      setWarehouseId(value)
      setSelectedStockId('')
      setStockSearch('')
      setQuantity('')
      setError('')
    },
    stockId: selectedStockId,
    setStockId: (value: string) => {
      if (value === selectedStockId) return
      setSelectedStockId(value)
      setQuantity('')
      setError('')
    },
    condition,
    setCondition,
    quantity,
    setQuantity,
    reason,
    setReason,
    warehouses: warehouses.items.filter((warehouse) => warehouse.isActive),
    stocks: options,
    selected,
    available,
    error: loadError ? `Stock data could not be loaded. ${getErrorMessage(loadError)}` : error,
    loading,
    fetching,
    busy,
    canEdit: canTag && !busy && !uncertain && !recorded,
    canSubmit:
      canTag &&
      !busy &&
      !loading &&
      !fetching &&
      !loadError &&
      !warehouse.isFetching &&
      !needsReview &&
      !recorded &&
      (!!uncertain || (!!selectedValid && available !== null && available > 0n)),
    retrying: !!uncertain,
    submit,
    refreshData,
  }
}
