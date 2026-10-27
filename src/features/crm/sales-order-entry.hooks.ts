import { useRef, useState, type FormEvent } from 'react'
import type { Client } from './clients.types'
import type {
  EditableSalesOrder,
  OrderFormValues,
  SalesOrderDraftProps,
  SalesOrderFormLine,
} from './sales-order-entry.types'
import type { SalesOrderRecord } from './sales-orders.types'
import { fetchSalesOrderByIdApi, isStaleSalesOrderRevision } from './sales-orders.api'
import {
  buildSalesOrderDraftPayload,
  salesDraftLines,
} from './sales-order-entry.utils'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { decimalString, lineSubtotal, parseOrderDecimal } from '@/lib/order-amounts'
import { discountFields, lineDiscountError, orderLineAmounts, orderLineTotals, savedOrderTotals, type LineDiscount } from '@/lib/order-line-pricing'
import { getErrorMessage } from '@/lib/api-client'
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

export function useSalesOrderEntry({
  clients,
  products,
  cashier,
  order,
  draftOrder,
  onUpdateDraft,
  onLoadLatest = fetchSalesOrderByIdApi,
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
} & SalesOrderDraftProps &
  OrderSubmissionProps<OrderFormValues>) {
  const [draft, setDraft] = useState(draftOrder)
  const [conflict, setConflict] = useState<{
    latest?: SalesOrderRecord
    loading: boolean
    error?: string
  }>()
  const initialClient =
    order && clients.find((client) => client.isActive && client.name === order.clientName)
  const [clientId, setClientId] = useState(
    draft ? String(draft.clientId) : initialClient ? String(initialClient.id) : '',
  )
  const [deliveryAddress, setDeliveryAddress] = useState(
    draft?.deliveryAddress ?? order?.deliveryAddress ?? initialClient?.address ?? '',
  )
  const [expectedAt, setExpectedAt] = useState(
    draft?.expectedAt?.slice(0, 10) ?? order?.expectedAt ?? '',
  )
  const [reference, setReference] = useState(
    draft?.externalReference ?? order?.externalReference ?? '',
  )
  const [notes, setNotes] = useState(draft?.notes ?? order?.notes ?? '')
  const [storedLines, setLines] = useState<SalesOrderFormLine[]>(() =>
    draft
      ? salesDraftLines(draft, products)
      : (order?.lines ?? []).map(
          ({ productId, name, variety, unit, unitPrice, quantity, discount, taxRate }, index) => ({
            formId: index + 1,
            productId,
            name,
            variety,
            unit,
            unitPrice,
            quantity,
            discount: discount ?? { type: 'percentage', percentage: '', peso: '' },
            taxRate,
          }),
        ),
  )
  const [taxExemption, setTaxExemption] = useState(order?.taxRate === '0.00')
  const defaultTaxRate = taxExemption ? '0.00' : '12.00'
  const signature = JSON.stringify({ clientId, deliveryAddress, expectedAt, reference, notes, storedLines, taxExemption })
  const [initialSignature] = useState(signature)
  const lines = storedLines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.productId)
    return { ...line, taxRate: line.taxRate ?? defaultTaxRate,
      ...(product ? { name: product.name, variety: product.variety, unit: product.unit } : {}) }
  })
  const nextFormId = useRef(lines.length)
  const [error, setError] = useState('')
  const [errorFocusId, setErrorFocusId] = useState<string | undefined>()
  const submission = useOrderSubmission({ onConfirm, onConfirmed, savedDraft, onClose })
  const focus = useOrderItemFocus(lines)
  const amounts = submission.savedOrder?.items ? savedOrderTotals(submission.savedOrder.items)
    : orderLineTotals(lines.map((line) => ({ ...line, ...discountFields(line.discount) })))
  const editUnavailable =
    draft &&
    (draft.status !== 'DRAFT'
      ? 'Only a Draft sales order can be edited. Close this form and review its current status.'
      : !Number.isInteger(draft.revision) || draft.revision < 0
        ? 'The server did not provide a revision. Draft editing requires the updated backend contract.'
        : '')

  async function fetchLatestDraft() {
    if (!draft) return
    setConflict({ loading: true })
    try {
      const latest = await onLoadLatest(draft.id)
      if (!latest || latest.id !== draft.id)
        throw new Error('This sales order is no longer available.')
      setConflict({ latest, loading: false })
    } catch (cause) {
      setConflict({ loading: false, error: getErrorMessage(cause) })
    }
  }

  function reloadLatestDraft() {
    const latest = conflict?.latest
    if (!latest || conflict.loading) return
    setDraft(latest)
    setClientId(String(latest.clientId))
    setDeliveryAddress(latest.deliveryAddress)
    setExpectedAt(latest.expectedAt?.slice(0, 10) ?? '')
    setReference(latest.externalReference ?? '')
    setNotes(latest.notes ?? '')
    setLines(salesDraftLines(latest, products))
    nextFormId.current = latest.items.length
    setConflict(undefined)
    setError('')
    setErrorFocusId(undefined)
    submission.clearError()
  }

  function changeClient(id: string) {
    const client = clients.find((client) => String(client.id) === id && client.isActive)
    setClientId(id)
    if (!draft) setDeliveryAddress(client?.address ?? '')
    setError('')
  }

  function addProduct(product: InventoryItemResponse) {
    if (!product.isActive || submission.locked) return
    const existing = lines.find((line) => line.productId === product.id)
    const formId = existing?.formId ?? ++nextFormId.current
    focus.requestQuantityFocus(formId)
    setLines((current) => {
      const selected = current.find((line) => line.productId === product.id)
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
          productId: product.id,
          name: product.name,
          variety: product.variety,
          unit: product.unit,
          unitPrice: String(product.unitPrice),
          quantity: '1',
          discount: { type: 'percentage', percentage: '0.00', peso: '' },
        },
      ]
    })
    setError('')
  }

  function updateLine(id: number, field: 'quantity' | 'unitPrice', value: string) {
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
    const confirm = wantsOrderConfirmation(event)
    if (submission.savedOrder) {
      await submission.submit(() => Promise.reject(new Error('Draft already saved.')), confirm)
      return
    }
    setErrorFocusId(undefined)
    const client = clients.find((client) => String(client.id) === clientId && client.isActive)
    if (!client && (!draft || String(draft.clientId) !== clientId)) {
      setErrorFocusId('order-customer')
      return setError('Select an active customer.')
    }
    if (!deliveryAddress.trim()) {
      setErrorFocusId('order-address')
      return setError('Enter the delivery address.')
    }
    if (!lines.length) return setError('Add at least one product to the sales order.')
    const metadataError = expectedDateError(expectedAt)
    if (metadataError) return setError(metadataError)
    for (const line of lines) {
      if (
        !products.some((product) => product.id === line.productId && product.isActive) &&
        !line.terms
      )
        return setError(`${line.name} is no longer active. Remove it to continue.`)
      const invalid =
        quantityError(line.quantity) ||
        priceError(line.unitPrice) ||
        subtotalError(lineSubtotal(line.quantity, line.unitPrice))
      if (invalid) {
        setErrorFocusId(
          `${quantityError(line.quantity) ? 'order-quantity' : 'order-price'}-${line.formId}`,
        )
        return setError(`${line.name}: ${invalid}`)
      }
      const pricing = { ...line, ...discountFields(line.discount) }
      const discountInvalid = lineDiscountError(pricing)
      if (discountInvalid) {
        setErrorFocusId(`order-discount-${line.formId}`)
        return setError(`${line.name}: ${discountInvalid}`)
      }
      const lineAmounts = orderLineAmounts(pricing)
      if (!lineAmounts) return setError(`${line.name}: Review the saved tax rate and line pricing.`)
      if (subtotalError(lineAmounts.total))
        return setError(`${line.name}: Total with VAT exceeds the supported limit.`)
    }
    setError('')
    await submission.submit(async () => {
      const values: OrderFormValues = {
        clientId: Number(clientId),
        clientName: client?.name ?? `Customer #${clientId}`,
        deliveryAddress: deliveryAddress.trim(),
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : undefined,
        externalReference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        itemSummary: lines
          .map(
            (line) => `${line.name}${line.variety ? ` - ${line.variety}` : ''} x${line.quantity}`,
          )
          .join(', '),
        lines,
        discountType: 'percentage',
        discountValue: '0',
        discountRate: '0.00',
        taxRate: defaultTaxRate,
        total: amounts!.total,
        status: order?.status ?? 'Active',
        cashier,
      }
      if (!draft) return onSubmit(values, confirm ? 'confirm' : 'draft')
      if (!onUpdateDraft) throw new Error('Updating saved sales order drafts is unavailable.')
      try {
        const updated = await onUpdateDraft(draft.id, buildSalesOrderDraftPayload(draft, values))
        if (
          updated.id !== draft.id ||
          updated.orderNumber !== draft.orderNumber ||
          updated.status !== 'DRAFT' ||
          !Number.isInteger(updated.revision) ||
          updated.revision <= draft.revision
        )
          throw new Error(
            'The server did not return the updated draft revision. Close and reload this order before continuing.',
          )
        setDraft(updated)
        return updated
      } catch (cause) {
        if (isStaleSalesOrderRevision(cause)) await fetchLatestDraft()
        throw cause
      }
    }, confirm)
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
    taxExemption,
    setTaxExemption,
    error:
      editUnavailable ||
      error ||
      (conflict
        ? 'Another user or process updated this order. Your unsaved input is preserved. Review the latest version before saving again.'
        : submission.error),
    errorFocusId,
    busy: submission.busy,
    submission,
    focus,
    amounts,
    hasUnsavedChanges: signature !== initialSignature,
    editing: !!draft,
    submitDisabled: !!editUnavailable || !!conflict,
    conflict,
    fetchLatestDraft,
    reloadLatestDraft,
    addProduct,
    updateLine,
    updateDiscount,
    submit,
    removeLine: (id: number) => {
      setLines((current) => current.filter((line) => line.formId !== id))
      setError('')
    },
  }
}
