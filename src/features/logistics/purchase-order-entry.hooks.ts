import { useRef, useState, type FormEvent } from 'react'
import type { Supplier } from './suppliers.types'
import type { CreatePurchaseOrderPayload, PurchaseOrderRecord, UpdatePurchaseOrderDraftPayload } from './purchase-orders.types'
import { fetchPurchaseOrderByIdApi } from './purchase-orders.api'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import type { PurchaseLine } from './purchase-order-entry.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { decimalString, lineSubtotal, parseOrderDecimal } from '@/lib/order-amounts'
import { discountFields, lineDiscountError, orderLineAmounts, orderLineTotals, savedOrderTotals, savedLineDiscount, type LineDiscount } from '@/lib/order-line-pricing'
import {
  expectedDateError,
  priceError,
  quantityError,
  subtotalError,
} from '@/lib/order-entry.schema'
import {
  useOrderSubmission,
  wantsOrderConfirmation,
  type OrderSubmissionProps,
} from '@/hooks/use-order-submission'
import { useOrderItemFocus } from '@/hooks/use-order-item-focus'

export function usePurchaseOrderEntry({
  suppliers,
  products,
  onSubmit,
  onConfirm,
  onConfirmed,
  savedDraft,
  draftOrder,
  onUpdateDraft,
  onLoadLatest = fetchPurchaseOrderByIdApi,
  onClose,
}: {
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  onClose: () => void
  draftOrder?: PurchaseOrderRecord
  onUpdateDraft?: (
    id: number,
    payload: UpdatePurchaseOrderDraftPayload,
  ) => Promise<PurchaseOrderRecord>
  onLoadLatest?: (id: number) => Promise<PurchaseOrderRecord | null>
} & OrderSubmissionProps<CreatePurchaseOrderPayload>) {
  const [draft, setDraft] = useState(draftOrder)
  const [conflict, setConflict] = useState<{ latest?: PurchaseOrderRecord; loading: boolean; error?: string }>()
  const [supplierId, setSupplierId] = useState(
    () => (draftOrder?.supplierId != null ? String(draftOrder.supplierId) : ''),
  )
  const [reference, setReference] = useState(() => draftOrder?.externalReference ?? '')
  const [expectedAt, setExpectedAt] = useState(
    () => (draftOrder?.expectedAt ? draftOrder.expectedAt.slice(0, 10) : ''),
  )
  const [notes, setNotes] = useState(() => draftOrder?.notes ?? '')
  function draftLines(order: PurchaseOrderRecord): PurchaseLine[] {
    return order.items.map((item, index) => ({
          formId: index + 1,
          inventoryItemId: item.inventoryItemId,
          name: `Item #${item.inventoryItemId}`,
          unitCost: item.unitPrice,
          quantity: item.quantity,
          discount: savedLineDiscount(item),
          taxRate: item.taxRate,
          notes: item.notes,
        }))
  }
  const [lines, setLines] = useState<PurchaseLine[]>(() => draftOrder ? draftLines(draftOrder) : [])
  const nextFormId = useRef(lines.length)
  const signature = JSON.stringify({ supplierId, reference, expectedAt, notes, lines })
  const [initialSignature] = useState(signature)
  const [error, setError] = useState('')
  const [errorFocusId, setErrorFocusId] = useState<string>()
  const submission = useOrderSubmission({ onConfirm, onConfirmed, savedDraft, onClose })
  const focus = useOrderItemFocus(lines)
  const editUnavailable = draft && (draft.status !== 'DRAFT'
    ? 'Only a Draft purchase order can be edited. Close this form and review its current status.'
    : !Number.isInteger(draft.revision) || draft.revision < 1
      ? 'The server did not provide a valid revision. Reload this draft before editing.' : '')

  async function fetchLatestDraft() {
    if (!draft) return
    setConflict({ loading: true })
    try {
      const latest = await onLoadLatest(draft.id)
      if (!latest || latest.id !== draft.id) throw new Error('This purchase order is no longer available.')
      setConflict({ latest, loading: false })
    } catch (cause) {
      setConflict({ loading: false, error: getErrorMessage(cause) })
    }
  }

  function reloadLatestDraft() {
    const latest = conflict?.latest
    if (!latest || conflict.loading) return
    setDraft(latest)
    setSupplierId(latest.supplierId == null ? '' : String(latest.supplierId))
    setReference(latest.externalReference ?? '')
    setExpectedAt(latest.expectedAt?.slice(0, 10) ?? '')
    setNotes(latest.notes ?? '')
    setLines(draftLines(latest))
    nextFormId.current = latest.items.length
    setConflict(undefined)
    setError('')
    submission.clearError()
  }
  const amounts = submission.savedOrder?.items ? savedOrderTotals(submission.savedOrder.items)
    : orderLineTotals(lines.map((line) => ({ ...line, unitPrice: line.unitCost, ...discountFields(line.discount) })))

  function addProduct(product: InventoryItemResponse) {
    if (!product.isActive || submission.locked) return
    const existing = lines.find((line) => line.inventoryItemId === product.id)
    const formId = existing?.formId ?? ++nextFormId.current
    focus.requestQuantityFocus(formId)
    setError('')
    setLines((current) => {
      const selected = current.find((line) => line.inventoryItemId === product.id)
      if (selected) {
        const quantity = parseOrderDecimal(selected.quantity || '0')
        return current.map((line) =>
          line.formId === selected.formId && quantity !== null
            ? { ...line, quantity: decimalString(quantity + 100n).replace(/\.00$/, '') }
            : line,
        )
      }
      return [
        ...current,
        {
          formId,
          inventoryItemId: product.id,
          name: product.name,
          variety: product.variety,
          unit: product.unit,
          unitCost: '',
          quantity: '1',
          discount: { type: 'percentage', percentage: '', peso: '' },
        },
      ]
    })
  }

  function updateLine(id: number, field: 'quantity' | 'unitCost', value: string) {
    setLines((current) =>
      current.map((line) => (line.formId === id ? { ...line, [field]: value } : line)),
    )
    setError('')
  }

  function updateDiscount(id: number, discount: LineDiscount) {
    setLines((current) => current.map((line) => line.formId === id ? { ...line, discount } : line))
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submission.busy) return
    if (editUnavailable) return setError(editUnavailable)
    if (conflict) return
    setErrorFocusId(undefined)
    const confirm = wantsOrderConfirmation(event)
    if (submission.savedOrder) {
      await submission.submit(() => Promise.reject(new Error('Draft already saved.')), confirm)
      return
    }
    const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === supplierId)
    if (supplierId && !selectedSupplier)
      return setError('Choose a supplier that is available in the supplier list.')
    if (confirm && !selectedSupplier?.isActive) return setError('Select an active supplier to confirm.')
    if (!lines.length) return setError('Add at least one product to the purchase order.')
    const dateError = expectedDateError(expectedAt)
    if (dateError) return setError(dateError)
    for (const line of lines) {
      if (!products.some((product) => product.id === line.inventoryItemId && product.isActive))
        return setError(`${line.name} is no longer active. Remove it to continue.`)
      const invalid =
        quantityError(line.quantity) ||
        priceError(line.unitCost) ||
        subtotalError(lineSubtotal(line.quantity, line.unitCost))
      if (invalid) return setError(`${line.name}: ${invalid}`)
      const pricing = { ...line, unitPrice: line.unitCost, ...discountFields(line.discount) }
      const discountInvalid = lineDiscountError(pricing)
      if (discountInvalid) {
        setErrorFocusId(`purchase-discount-${line.formId}`)
        return setError(`${line.name}: ${discountInvalid}`)
      }
      const preview = orderLineAmounts(pricing)
      if (!preview) return setError(`${line.name}: Review the saved tax rate and line pricing.`)
      const totalError = subtotalError(preview.total)
      if (totalError) return setError(`${line.name}: ${totalError}`)
    }
    setError('')
    const payload: CreatePurchaseOrderPayload = {
      supplierId: supplierId ? Number(supplierId) : null,
      expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
      externalReference: reference.trim() || (draft ? null : undefined),
      notes: notes.trim() || (draft ? null : undefined),
      items: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        unitPrice: line.unitCost,
        ...discountFields(line.discount),
        ...(line.taxRate !== undefined ? { taxRate: line.taxRate } : {}),
        ...(line.notes !== undefined ? { notes: line.notes } : {}),
      })),
    }
    const updateDraft = onUpdateDraft
    if (draft && !updateDraft)
      return setError('Updating saved purchase order drafts is unavailable.')
    await submission.submit(async () => {
      if (!draft) return onSubmit(payload, confirm ? 'confirm' : 'draft')
      if (!updateDraft) return Promise.reject(new Error('Draft update is unavailable.'))
      try {
        const updated = await updateDraft(draft.id, { ...payload, expectedRevision: draft.revision })
        if (updated.id !== draft.id || updated.status !== 'DRAFT' ||
          !Number.isInteger(updated.revision) || updated.revision <= draft.revision) {
          await fetchLatestDraft()
          throw new Error('The server did not return the updated draft revision. Review the latest version before continuing.')
        }
        setDraft(updated)
        return updated
      } catch (cause) {
        if (['STALE_REVISION', 'INVALID_ORDER_STATE'].includes(getApiError(cause)?.code ?? ''))
          await fetchLatestDraft()
        throw cause
      }
    }, confirm)
  }
  return {
    hasUnsavedChanges: signature !== initialSignature,
    supplierId,
    setSupplierId,
    reference,
    setReference,
    expectedAt,
    setExpectedAt,
    notes,
    setNotes,
    lines,
    amounts,
    error: editUnavailable || error || (conflict
      ? 'This order changed on the server. Your unsaved input is preserved. Review the latest version before saving again.'
      : submission.error),
    conflict,
    fetchLatestDraft,
    reloadLatestDraft,
    submitDisabled: !!editUnavailable || !!conflict,
    errorFocusId,
    busy: submission.busy,
    submission,
    addProduct,
    updateLine,
    updateDiscount,
    submit,
    focus,
    removeLine: (id: number) => {
      setLines((current) => current.filter((line) => line.formId !== id))
      setError('')
    },
  }
}
