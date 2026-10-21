import { useState, type FormEvent } from 'react'
import type { Supplier } from './suppliers.types'
import type { CreatePurchaseOrderPayload, PurchaseOrderRecord } from './purchase-orders.types'
import type { PurchaseLine } from './purchase-order-entry.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { lineSubtotal, orderAmounts } from '@/lib/order-amounts'
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
  onClose,
}: {
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  onClose: () => void
  draftOrder?: PurchaseOrderRecord
  onUpdateDraft?: (
    id: number,
    payload: CreatePurchaseOrderPayload,
  ) => Promise<{ id: number; orderNumber: string; status: string }>
} & OrderSubmissionProps<CreatePurchaseOrderPayload>) {
  const [supplierId, setSupplierId] = useState(
    () => (draftOrder?.supplierId != null ? String(draftOrder.supplierId) : ''),
  )
  const [reference, setReference] = useState(() => draftOrder?.externalReference ?? '')
  const [expectedAt, setExpectedAt] = useState(
    () => (draftOrder?.expectedAt ? draftOrder.expectedAt.slice(0, 10) : ''),
  )
  const [notes, setNotes] = useState(() => draftOrder?.notes ?? '')
  const [lines, setLines] = useState<PurchaseLine[]>(() =>
    draftOrder
      ? draftOrder.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          name: `Item #${item.inventoryItemId}`,
          unitCost: item.unitPrice,
          quantity: item.quantity,
          discountRate: item.discountRate,
          taxRate: item.taxRate,
          notes: item.notes,
        }))
      : [],
  )
  const [error, setError] = useState('')
  const submission = useOrderSubmission({ onConfirm, onConfirmed, savedDraft, onClose })
  const focus = useOrderItemFocus(lines)
  const amounts = orderAmounts(lines.map((line) => ({ ...line, unitPrice: line.unitCost })))

  function addProduct(product: InventoryItemResponse) {
    if (!product.isActive || submission.locked) return
    focus.requestQuantityFocus(product.id)
    setError('')
    if (lines.some((line) => line.inventoryItemId === product.id)) return
    setLines((current) => [
      ...current,
      {
        inventoryItemId: product.id,
        name: product.name,
        variety: product.variety,
        unit: product.unit,
        unitCost: '',
        quantity: '1',
      },
    ])
  }

  function updateLine(id: number, field: 'quantity' | 'unitCost', value: string) {
    setLines((current) =>
      current.map((line) => (line.inventoryItemId === id ? { ...line, [field]: value } : line)),
    )
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submission.busy) return
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
    }
    setError('')
    const payload: CreatePurchaseOrderPayload = {
      supplierId: supplierId ? Number(supplierId) : null,
      expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
      externalReference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      items: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        unitPrice: line.unitCost,
        ...(line.discountRate !== undefined ? { discountRate: line.discountRate } : {}),
        ...(line.taxRate !== undefined ? { taxRate: line.taxRate } : {}),
        ...(line.notes !== undefined ? { notes: line.notes } : {}),
      })),
    }
    const updateDraft = onUpdateDraft
    if (draftOrder && !updateDraft)
      return setError('Updating saved purchase order drafts is unavailable.')
    await submission.submit(() => {
      if (!draftOrder) return onSubmit(payload, confirm ? 'confirm' : 'draft')
      if (!updateDraft) return Promise.reject(new Error('Draft update is unavailable.'))
      return updateDraft(draftOrder.id, payload)
    }, confirm)
  }
  return {
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
    error: error || submission.error,
    busy: submission.busy,
    submission,
    addProduct,
    updateLine,
    submit,
    focus,
    removeLine: (id: number) => {
      setLines((current) => current.filter((line) => line.inventoryItemId !== id))
      setError('')
    },
  }
}
