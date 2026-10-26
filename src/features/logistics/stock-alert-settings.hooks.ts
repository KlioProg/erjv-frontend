import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useSetReorderThreshold } from './stock-items.hooks'
import type { StockItem } from './stock-items.types'
import { parseStockCents } from './stock-display'
import { getErrorMessage } from '@/lib/api-client'

type ThresholdDraft = {
  value: string
  status: 'editing' | 'pending' | 'saved' | 'error'
  error?: string
}

export function thresholdChanged(value: string, current: string | null | undefined) {
  if (!value.trim()) return current != null
  return parseStockCents(value) === null || parseStockCents(value) !== parseStockCents(current)
}

function thresholdError(value: string) {
  if (!value.trim()) return undefined
  const cents = parseStockCents(value)
  if (cents === null) return 'Enter zero or a positive number with up to two decimal places.'
  // The backend stores thresholds as Decimal(12, 2).
  if (cents > 999_999_999_999n) return 'Enter a threshold no greater than 9,999,999,999.99.'
  return undefined
}

function saveError(error: unknown) {
  if (isAxiosError(error)) {
    if (!error.response)
      return 'We could not confirm the save. Check your connection and review the threshold before trying again.'
    if (error.response.status === 403)
      return 'You do not have permission to change stock alert settings.'
    if (error.response.status === 404)
      return 'This warehouse stock record is no longer available. Refresh the stock list.'
    if (error.response.status === 409)
      return 'The stock record changed. Refresh the stock list, then review and save your threshold again.'
  }
  return getErrorMessage(error)
}

/** Drafts live above the table so pagination and warehouse changes retain unsaved input. */
export function useStockAlertEditors(canEdit: boolean) {
  const [drafts, setDrafts] = useState<Record<number, ThresholdDraft>>({})
  const inFlight = useRef(new Set<number>())
  const mutation = useSetReorderThreshold()

  const change = (id: number, value: string) => {
    if (!canEdit || inFlight.current.has(id)) return
    setDrafts((current) => ({ ...current, [id]: { value, status: 'editing' } }))
  }

  const save = async (stock: StockItem) => {
    if (!canEdit || inFlight.current.has(stock.id)) return
    const value = drafts[stock.id]?.value ?? stock.reorderThreshold ?? ''
    const error = thresholdError(value)
    if (error) {
      setDrafts((current) => ({ ...current, [stock.id]: { value, status: 'error', error } }))
      return
    }
    if (!thresholdChanged(value, stock.reorderThreshold)) return
    inFlight.current.add(stock.id)
    setDrafts((current) => ({ ...current, [stock.id]: { value, status: 'pending' } }))
    try {
      const saved = await mutation.mutateAsync({
        id: stock.id,
        payload: { reorderThreshold: value.trim() || null },
      })
      setDrafts((current) => ({
        ...current,
        [stock.id]: { value: saved.reorderThreshold ?? '', status: 'saved' },
      }))
    } catch (cause) {
      setDrafts((current) => ({
        ...current,
        [stock.id]: { value, status: 'error', error: saveError(cause) },
      }))
    } finally {
      inFlight.current.delete(stock.id)
    }
  }

  return {
    drafts,
    change,
    save,
    pending: Object.values(drafts).some((draft) => draft.status === 'pending'),
  }
}
