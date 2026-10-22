import { useRef, useState, type FormEvent } from 'react'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { getErrorMessage } from '@/lib/api-client'
import type { Supplier } from './suppliers.types'
import type { CreatePurchaseOrderPayload } from './purchase-orders.types'
import { useSupplierPrices } from './supplier-pricing.hooks'
import {
  decimalString,
  purchaseDecimal,
  purchaseLineTotal,
  purchaseTotal,
  repricePurchaseLines,
  supplierReferenceCost,
  type PurchaseLine,
} from './purchase-pricing'

export function usePurchaseOrderForm({
  suppliers,
  products,
  onSubmit,
  onClose,
  canEditCosts,
}: {
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  onSubmit: (payload: CreatePurchaseOrderPayload) => Promise<void>
  onClose: () => void
  canEditCosts: boolean
}) {
  const [supplierId, setSupplierId] = useState(
    String(suppliers.find((row) => row.isActive)?.id ?? ''),
  )
  const [referenceNo, setReferenceNo] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [productId, setProductId] = useState('')
  const [manualCost, setManualCost] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const nextLineId = useRef(0)
  const [needsPriceReview, setNeedsPriceReview] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pricing = useSupplierPrices(Number(supplierId))
  // A manual draft takes precedence over refetches and delayed quote responses.
  const referenceCost = pricing.isError
    ? ''
    : supplierReferenceCost(pricing.data ?? [], Number(productId))
  const cost = manualCost ?? referenceCost
  const total = purchaseTotal(lines)

  function changeSupplier(value: string) {
    if (value === supplierId) return
    setSupplierId(value)
    setProductId('')
    setManualCost(null)
    setNeedsPriceReview(lines.length > 0)
    setError('')
  }

  function selectProduct(value: string) {
    setProductId(value)
    setManualCost(null)
    setError('')
  }

  function reviewPrices(keepAgreedCosts: boolean) {
    if (!keepAgreedCosts) {
      if (!pricing.isSuccess || pricing.isFetching) return
      setLines((current) => repricePurchaseLines(current, pricing.data))
    }
    setNeedsPriceReview(false)
    setError('')
  }

  function addItem() {
    const product = products.find((row) => row.id === Number(productId) && row.isActive)
    if (!supplierId || needsPriceReview)
      return setError('Select a supplier and review the agreed costs first.')
    if (!product) return setError('Select an active inventory product.')
    if (purchaseLineTotal({ quantity, unitCost: cost }) === null) {
      return setError(
        'Enter a positive quantity and a non-negative purchase cost, with at most two decimals and within the supported amount.',
      )
    }
    const lineId = String(++nextLineId.current)
    setLines((current) => [
      ...current,
      {
        id: lineId,
        inventoryItemId: product.id,
        name: product.name,
        variety: product.variety,
        unit: product.unit || 'unit',
        quantity: decimalString(purchaseDecimal(quantity, 12)!),
        unitCost: decimalString(purchaseDecimal(cost)!),
      },
    ])
    setProductId('')
    setManualCost(null)
    setQuantity('1')
    setError('')
  }

  function editLine(id: string, field: 'quantity' | 'unitCost', value: string) {
    if (field === 'unitCost' && !canEditCosts) return
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (!canEditCosts)
      return setError('Only administrators and managers can create purchase orders.')
    if (!suppliers.some((row) => row.id === Number(supplierId) && row.isActive))
      return setError('Select an active supplier.')
    if (needsPriceReview)
      return setError('Review the prices for the new supplier before creating this order.')
    if (!lines.length || total === null)
      return setError('Add products and enter a valid quantity and purchase cost for every item.')
    if (
      lines.some((line) => !products.some((row) => row.id === line.inventoryItemId && row.isActive))
    )
      return setError('An item is no longer available. Remove it before creating this order.')
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit({
        supplierId: Number(supplierId),
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        externalReference: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: decimalString(purchaseDecimal(line.quantity, 12)!),
          unitPrice: decimalString(purchaseDecimal(line.unitCost)!),
        })),
      })
      onClose()
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    supplierId,
    changeSupplier,
    referenceNo,
    setReferenceNo,
    expectedAt,
    setExpectedAt,
    notes,
    setNotes,
    productId,
    selectProduct,
    cost,
    setManualCost,
    referenceCost,
    quantity,
    setQuantity,
    lines,
    editLine,
    removeLine: (id: string) => setLines((current) => current.filter((line) => line.id !== id)),
    needsPriceReview,
    reviewPrices,
    addItem,
    total,
    pricing,
    error,
    isSubmitting,
    submit,
  }
}
