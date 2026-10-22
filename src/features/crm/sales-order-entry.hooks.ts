import { useState, type FormEvent } from 'react'
import type { Client } from './clients.types'
import type { EditableSalesOrder, OrderFormValues, OrderLine } from './sales-order-entry.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { lineSubtotal, orderAmounts } from '@/lib/order-amounts'
import {
  discountError,
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

export function useSalesOrderEntry({
  clients,
  products,
  cashier,
  order,
  onSubmit,
  onConfirm,
  onConfirmed,
  savedDraft,
  onClose,
}: {
  clients: Client[]
  products: InventoryItemResponse[]
  cashier: string
  order?: EditableSalesOrder
  onClose: () => void
} & OrderSubmissionProps<OrderFormValues>) {
  const initialClient =
    order && clients.find((client) => client.isActive && client.name === order.clientName)
  const [clientId, setClientId] = useState(initialClient ? String(initialClient.id) : '')
  const [deliveryAddress, setDeliveryAddress] = useState(
    order?.deliveryAddress ?? initialClient?.address ?? '',
  )
  const [expectedAt, setExpectedAt] = useState(order?.expectedAt ?? '')
  const [reference, setReference] = useState(order?.externalReference ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [lines, setLines] = useState<OrderLine[]>(
    (order?.lines ?? []).map(({ productId, name, variety, unit, unitPrice, quantity }) => ({
      productId,
      name,
      variety,
      unit,
      unitPrice,
      quantity,
    })),
  )
  const [discountType, setDiscountType] = useState<'peso' | 'percentage'>(
    order?.discountType ?? 'peso',
  )
  const [discountValue, setDiscountValue] = useState(order?.discountValue ?? '')
  const [error, setError] = useState('')
  const [errorFocusId, setErrorFocusId] = useState<string | undefined>()
  const submission = useOrderSubmission({ onConfirm, onConfirmed, savedDraft, onClose })
  const focus = useOrderItemFocus(lines)
  const amounts = orderAmounts(lines, discountType, discountValue, '12.00')

  function changeClient(id: string) {
    const client = clients.find((client) => String(client.id) === id && client.isActive)
    setClientId(id)
    setDeliveryAddress(client?.address ?? '')
    setError('')
  }

  function addProduct(product: InventoryItemResponse) {
    if (!product.isActive || submission.locked) return
    if (lines.some((line) => line.productId === product.id)) {
      focus.requestQuantityFocus(product.id)
      setError('')
      return
    }
    focus.requestQuantityFocus(product.id)
    setLines((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        variety: product.variety,
        unit: product.unit,
        unitPrice: String(product.unitPrice),
        quantity: '1',
      },
    ])
    setError('')
  }

  function updateLine(id: number, field: 'quantity' | 'unitPrice', value: string) {
    setLines((current) =>
      current.map((line) =>
        line.productId === id
          ? { ...line, [field]: value }
          : line,
      ),
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
    setErrorFocusId(undefined)
    const client = clients.find((client) => String(client.id) === clientId && client.isActive)
    if (!client) return setError('Select an active customer.')
    if (!deliveryAddress.trim()) return setError('Enter the delivery address.')
    if (!lines.length) return setError('Add at least one product to the sales order.')
    const metadataError =
      expectedDateError(expectedAt) ||
      discountError(discountValue, discountType, amounts.subtotal, amounts.discount)
    if (metadataError) return setError(metadataError)
    for (const line of lines) {
      if (!products.some((product) => product.id === line.productId && product.isActive))
        return setError(`${line.name} is no longer active. Remove it to continue.`)
      const invalid =
        quantityError(line.quantity) ||
        priceError(line.unitPrice) ||
        subtotalError(lineSubtotal(line.quantity, line.unitPrice))
      if (invalid) return setError(`${line.name}: ${invalid}`)
      // Tax is applied after discount, matching calculateLineAmounts in main.
      const lineAmounts = orderAmounts([line], 'percentage', amounts.discountRate, amounts.taxRate)
      if (subtotalError(lineAmounts.total))
        return setError(`${line.name}: Total with VAT exceeds the supported limit.`)
    }
    setError('')
    await submission.submit(
      () =>
        onSubmit(
          {
            clientId: client.id,
            clientName: client.name,
            deliveryAddress: deliveryAddress.trim(),
            expectedAt: expectedAt ? new Date(expectedAt).toISOString() : undefined,
            externalReference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
            itemSummary: lines
              .map(
                (line) =>
                  `${line.name}${line.variety ? ` - ${line.variety}` : ''} x${line.quantity}`,
              )
              .join(', '),
            lines,
            discountType,
            discountValue: discountValue || '0',
            discountRate: amounts.discountRate,
            taxRate: amounts.taxRate,
            total: amounts.total,
            status: order?.status ?? 'Active',
            cashier,
          },
          confirm ? 'confirm' : 'draft',
        ),
      confirm,
    )
  }
  return {
    clientId,
    changeClient,
    deliveryAddress,
    setDeliveryAddress,
    expectedAt,
    setExpectedAt,
    reference,
    setReference,
    notes,
    setNotes,
    lines,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    error: error || submission.error,
    errorFocusId,
    busy: submission.busy,
    submission,
    focus,
    amounts,
    addProduct,
    updateLine,
    submit,
    removeLine: (id: number) => {
      setLines((current) => current.filter((line) => line.productId !== id))
      setError('')
    },
  }
}
