import { useState, type FormEvent } from 'react'
import type { Supplier } from './suppliers.types'
import type { CreatePurchaseOrderPayload } from './purchase-orders.types'
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
  onClose,
}: {
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  onClose: () => void
} & OrderSubmissionProps<CreatePurchaseOrderPayload>) {
  const [supplierId, setSupplierId] = useState('')
  const [reference, setReference] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([])
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
    if (!suppliers.some((supplier) => supplier.isActive && String(supplier.id) === supplierId))
      return setError('Select an active supplier.')
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
    await submission.submit(
      () =>
        onSubmit(
          {
            supplierId: Number(supplierId),
            expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
            externalReference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
            items: lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              unitPrice: line.unitCost,
            })),
          },
          confirm ? 'confirm' : 'draft',
        ),
      confirm,
    )
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
