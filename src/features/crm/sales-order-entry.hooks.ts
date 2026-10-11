import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { Client } from './clients.types'
import type { EditableSalesOrder, OrderFormValues, OrderLine } from './sales-order-entry.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import {
  availableStock,
  decimalString,
  lineSubtotal,
  orderAmounts,
  parseOrderDecimal,
} from '@/lib/order-amounts'
import {
  allocatedQuantity,
  eligibleSalesSources,
  salesAllocationError,
} from './sales-order-entry.schema'
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
  stockItems,
  warehouses,
  sourcesKnown = true,
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
  stockItems: StockItem[]
  warehouses: Warehouse[]
  sourcesKnown?: boolean
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
    (order?.lines ?? []).map(
      ({ productId, name, variety, unit, unitPrice, quantity, allocations }) => ({
        productId,
        name,
        variety,
        unit,
        unitPrice,
        quantity,
        allocations: allocations?.map((source, index) => ({ ...source, key: index + 1 })),
      }),
    ),
  )
  const [discountType, setDiscountType] = useState<'peso' | 'percentage'>(
    order?.discountType ?? 'peso',
  )
  const [discountValue, setDiscountValue] = useState(order?.discountValue ?? '')
  const [unavailableProduct, setUnavailableProduct] = useState<InventoryItemResponse | null>(null)
  const [error, setError] = useState('')
  const [errorFocusId, setErrorFocusId] = useState<string | undefined>()
  const [expandedSource, setExpandedSource] = useState<number | null>(null)
  const [reviewedSources, setReviewedSources] = useState<Set<number>>(new Set())
  const allocationKey = useRef(
    Math.max(0, ...lines.flatMap((line) => (line.allocations ?? []).map((source) => source.key))) +
      1,
  )
  const [sourceFocus, setSourceFocus] = useState<{ id: string }>()
  useLayoutEffect(() => {
    if (sourceFocus) document.getElementById(sourceFocus.id)?.focus({ preventScroll: true })
  }, [sourceFocus])
  const submission = useOrderSubmission({ onConfirm, onConfirmed, savedDraft, onClose })
  const focus = useOrderItemFocus(lines)
  const amounts = orderAmounts(lines, discountType, discountValue, '12.00')
  const totalAvailable = (productId: number) =>
    stockItems
      .filter((stock) => stock.inventoryItemId === productId)
      .reduce((total, stock) => total + availableStock(stock), 0n)

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
    if (totalAvailable(product.id) <= 0n) {
      setUnavailableProduct(product)
      setError(product.name + ' has no available warehouse stock. Receive stock before adding it.')
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
    setUnavailableProduct(null)
    setError('')
  }

  function updateLine(id: number, field: 'quantity' | 'unitPrice', value: string) {
    setLines((current) =>
      current.map((line) =>
        line.productId === id
          ? {
              ...line,
              [field]: value,
              allocations:
                field === 'quantity' && line.allocations?.length === 1
                  ? [{ ...line.allocations[0], quantity: value }]
                  : line.allocations,
            }
          : line,
      ),
    )
    setError('')
  }

  function openSources(line: OrderLine) {
    setExpandedSource(line.productId)
    setSourceFocus({ id: `order-source-${line.productId}-${line.allocations?.[0]?.key ?? 0}` })
  }
  function updateSource(
    line: OrderLine,
    key: number,
    field: 'stockItemId' | 'quantity',
    value: number | string,
  ) {
    if (submission.locked) return
    setLines((current) =>
      current.map((item) => {
        if (item.productId !== line.productId) return item
        const sources = item.allocations?.length
          ? item.allocations
          : [{ key: 0, quantity: item.quantity }]
        return {
          ...item,
          allocations: sources.map((source) =>
            source.key === key ? { ...source, [field]: value } : source,
          ),
        }
      }),
    )
    setError('')
  }
  function addSource(line: OrderLine) {
    if (submission.locked) return
    const key = allocationKey.current++
    const remainder = (parseOrderDecimal(line.quantity) ?? 0n) - allocatedQuantity(line)
    setLines((current) =>
      current.map((item) =>
        item.productId === line.productId
          ? {
              ...item,
              allocations: [
                ...(item.allocations?.length
                  ? item.allocations
                  : [{ key: 0, quantity: item.quantity }]),
                { key, quantity: remainder > 0n ? decimalString(remainder) : '' },
              ],
            }
          : item,
      ),
    )
    setSourceFocus({ id: `order-source-${line.productId}-${key}` })
    setError('')
  }
  function removeSource(line: OrderLine, key: number) {
    if (submission.locked) return
    setLines((current) =>
      current.map((item) => {
        if (item.productId !== line.productId) return item
        const remaining = (item.allocations ?? []).filter((source) => source.key !== key)
        return {
          ...item,
          allocations:
            remaining.length === 1 ? [{ ...remaining[0], quantity: item.quantity }] : remaining,
        }
      }),
    )
    const remainingKey = line.allocations?.find((source) => source.key !== key)?.key ?? 0
    setSourceFocus({ id: `order-source-${line.productId}-${remainingKey}` })
    setError('')
  }
  function closeSources(line: OrderLine) {
    const invalid = salesAllocationError(line, stockItems, warehouses)
    if (invalid) {
      setReviewedSources((current) => new Set(current).add(line.productId))
      setSourceFocus({ id: invalid.focusId })
      return
    }
    setExpandedSource(null)
    setSourceFocus({ id: `order-source-summary-${line.productId}` })
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
      if ((confirm || line.allocations?.length) && !sourcesKnown)
        return setError(
          'Stock information is unavailable. Retry loading the catalog before saving sources.',
        )
      const sourceError = salesAllocationError(line, stockItems, warehouses, confirm)
      if (sourceError) {
        setReviewedSources((current) => new Set(current).add(line.productId))
        setExpandedSource(line.productId)
        setErrorFocusId(sourceError.focusId)
        setSourceFocus({ id: sourceError.focusId })
        return setError(`${line.name}: ${sourceError.message}`)
      }
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
    unavailableProduct,
    error: error || submission.error,
    errorFocusId,
    busy: submission.busy,
    submission,
    focus,
    amounts,
    totalAvailable,
    addProduct,
    updateLine,
    expandedSource,
    openSources,
    closeSources,
    updateSource,
    addSource,
    removeSource,
    sourceError: (line: OrderLine) =>
      reviewedSources.has(line.productId)
        ? salesAllocationError(line, stockItems, warehouses)
        : undefined,
    eligibleSources: (line: OrderLine) =>
      sourcesKnown ? eligibleSalesSources(line.productId, stockItems, warehouses) : [],
    submit,
    removeLine: (id: number) => {
      setLines((current) => current.filter((line) => line.productId !== id))
      if (expandedSource === id) setExpandedSource(null)
      setReviewedSources((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setError('')
    },
  }
}
