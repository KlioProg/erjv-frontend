import { useState, useMemo, type FormEvent } from 'react'
import {
  ClipboardList,
  Minus,
  Package,
  Plus,
  Trash2,
  UserRound,
  Warehouse as WarehouseIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getErrorMessage } from '@/lib/api-client'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'

export type OrderFormValues = {
  clientId: number
  clientName: string
  deliveryAddress: string
  notes?: string
  itemSummary: string
  lines: OrderLine[]
  discountType: 'peso' | 'percentage'
  discountValue: number
  total: number
  status: OrderStatus
  cashier: string
}

export type OrderStatus = 'Completed' | 'Active' | 'Cancelled'

type OrderModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: OrderFormValues) => Promise<void> | void
  clients: Client[]
  products: InventoryItemResponse[]
  warehouses?: Warehouse[]
  stockItems?: StockItem[]
  cashier: string
  order?: {
    clientName: string
    lines: OrderLine[]
    discountType: 'peso' | 'percentage'
    discountValue: number
    status: OrderStatus
  }
}

export type OrderLine = {
  productId: number
  name: string
  variety?: string | null
  unit?: string | null
  unitPrice: number
  quantity: number
  stockItemId?: number
  warehouseId?: number
}

const VAT_RATE = 0.12

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export function OrderModal({
  open,
  onClose,
  onSubmit,
  clients,
  products,
  warehouses = [],
  stockItems = [],
  cashier,
  order,
}: OrderModalProps) {
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])

  // Helper to get available unreserved stock for a stock item
  const getAvailableStock = (stock?: StockItem | null): number => {
    if (!stock) return 0
    const physical = parseFloat(stock.quantity || '0')
    const reserved = parseFloat(stock.reservedQuantity || '0')
    return Math.max(0, physical - reserved)
  }

  // Helper to get total available stock across all warehouses for an inventory item
  const getTotalAvailableStock = (inventoryItemId: number): number => {
    return stockItems
      .filter((s) => s.inventoryItemId === inventoryItemId)
      .reduce((sum, s) => sum + getAvailableStock(s), 0)
  }

  const initialClient = order && clients.find((client) => client.name === order.clientName)
  const [customerType, setCustomerType] = useState(
    initialClient ? `client:${initialClient.id}` : order ? 'walk-in' : '',
  )
  const [customerName, setCustomerName] = useState(order?.clientName || '')
  const [selectedProductId, setSelectedProductId] = useState('none')
  const [lines, setLines] = useState<OrderLine[]>(order?.lines || [])
  const [discountType, setDiscountType] = useState<'peso' | 'percentage'>(
    order?.discountType || 'peso',
  )
  const [discountValue, setDiscountValue] = useState(
    order && order.discountValue > 0 ? String(order.discountValue) : '',
  )
  const status: OrderStatus = order?.status || 'Active'
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const grossTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const subtotal = grossTotal * (1 - VAT_RATE)
  const vat = grossTotal * VAT_RATE
  const numericDiscountValue = Number(discountValue) || 0
  const discountAmount =
    discountType === 'percentage'
      ? grossTotal * (numericDiscountValue / 100)
      : Math.min(numericDiscountValue, grossTotal)
  const totalAfterDiscount = Math.max(0, grossTotal - discountAmount)

  const setDiscount = (value: string) => {
    if (value === '') {
      setErrorMessage('')
      setDiscountValue('')
      return
    }

    const numericValue = Number(value)
    const maximum = discountType === 'percentage' ? 100 : grossTotal
    if (numericValue < 0) {
      setErrorMessage('Discount cannot be negative.')
      return
    }
    if (numericValue > maximum) {
      setErrorMessage(
        discountType === 'percentage'
          ? 'Discount cannot exceed 100%.'
          : 'Discount cannot exceed the gross total.',
      )
      return
    }
    setErrorMessage('')
    setDiscountValue(value)
  }

  const selectedProduct = useMemo(() => {
    if (selectedProductId === 'none') return null
    return products.find((product) => String(product.id) === selectedProductId) || null
  }, [selectedProductId, products])

  const selectedProductTotalAvailable = useMemo(() => {
    if (!selectedProduct) return 0
    return stockItems
      .filter((s) => s.inventoryItemId === selectedProduct.id)
      .reduce((sum, s) => sum + getAvailableStock(s), 0)
  }, [selectedProduct, stockItems])

  const selectedProductExistingLine = useMemo(() => {
    if (!selectedProduct) return null
    return lines.find((l) => l.productId === selectedProduct.id) || null
  }, [selectedProduct, lines])

  const isSelectedProductFullyAdded = useMemo(() => {
    if (!selectedProduct) return false
    if (!selectedProductExistingLine) return false
    const stock = stockItems.find((s) => s.id === selectedProductExistingLine.stockItemId)
    const maxAvail = getAvailableStock(stock)
    return selectedProductExistingLine.quantity >= maxAvail
  }, [selectedProduct, selectedProductExistingLine, stockItems])

  const handleAddProduct = () => {
    const selectedProduct = products.find((product) => String(product.id) === selectedProductId)
    if (!selectedProduct) return

    // Find all stock items with positive available stock
    const matchingStocks = stockItems
      .filter((s) => s.inventoryItemId === selectedProduct.id)
      .map((s) => ({
        stock: s,
        available: getAvailableStock(s),
      }))
      .filter((s) => s.available > 0)
      .sort((a, b) => b.available - a.available)

    if (matchingStocks.length === 0) {
      setErrorMessage(
        `"${selectedProduct.name}" has 0 available stock in all warehouses. Purchase stock from a supplier first.`,
      )
      return
    }

    const chosenStock = matchingStocks[0].stock
    const availableQty = matchingStocks[0].available

    const existingLine = lines.find((line) => line.productId === selectedProduct.id)
    if (existingLine) {
      if (existingLine.quantity >= availableQty) {
        setErrorMessage(
          `All available warehouse stock (${availableQty} ${selectedProduct.unit || 'units'}) for "${selectedProduct.name}" has already been allocated to this order.`,
        )
        return
      }

      setLines((currentLines) =>
        currentLines.map((line) =>
          line.productId === selectedProduct.id
            ? { ...line, quantity: Math.min(line.quantity + 1, availableQty) }
            : line,
        ),
      )
    } else {
      setLines((currentLines) => [
        ...currentLines,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          variety: selectedProduct.variety,
          unit: selectedProduct.unit,
          unitPrice: selectedProduct.unitPrice,
          quantity: 1,
          stockItemId: chosenStock.id,
          warehouseId: chosenStock.warehouseId,
        },
      ])
    }

    setSelectedProductId('none')
    setErrorMessage('')
  }

  const changeQuantity = (productId: number, change: number) => {
    setErrorMessage('')
    setLines((currentLines) =>
      currentLines
        .map((line) => {
          if (line.productId !== productId) return line
          const stock = stockItems.find((s) => s.id === line.stockItemId)
          const maxAvailable = getAvailableStock(stock)
          const targetQty = line.quantity + change

          if (change > 0 && targetQty > maxAvailable) {
            setErrorMessage(
              `Cannot exceed available warehouse stock (${maxAvailable} ${line.unit || 'units'}) for "${line.name}".`,
            )
            return { ...line, quantity: maxAvailable }
          }
          return { ...line, quantity: Math.max(1, targetQty) }
        })
        .filter((line) => line.quantity > 0),
    )
  }

  const handleDirectQuantityChange = (productId: number, valStr: string) => {
    setErrorMessage('')
    const parsed = parseInt(valStr, 10)
    setLines((currentLines) =>
      currentLines.map((line) => {
        if (line.productId !== productId) return line
        const stock = stockItems.find((s) => s.id === line.stockItemId)
        const maxAvailable = getAvailableStock(stock)

        if (valStr === '' || isNaN(parsed) || parsed < 1) {
          return { ...line, quantity: 1 }
        }
        if (parsed > maxAvailable) {
          setErrorMessage(
            `Quantity for "${line.name}" capped at maximum available stock (${maxAvailable} ${line.unit || 'units'}).`,
          )
          return { ...line, quantity: maxAvailable }
        }
        return { ...line, quantity: parsed }
      }),
    )
  }

  const handleWarehouseSwitch = (productId: number, newStockItemId: number) => {
    setErrorMessage('')
    const newStock = stockItems.find((s) => s.id === newStockItemId)
    if (!newStock) return
    const maxAvail = getAvailableStock(newStock)

    setLines((currentLines) =>
      currentLines.map((line) => {
        if (line.productId !== productId) return line
        return {
          ...line,
          stockItemId: newStock.id,
          warehouseId: newStock.warehouseId,
          quantity: Math.min(line.quantity, Math.max(1, maxAvail)),
        }
      }),
    )
  }

  const handleCustomerChange = (value: string) => {
    setCustomerType(value)
    if (value === 'walk-in') {
      setCustomerName('')
      return
    }

    const selectedClient = clients.find((client) => `client:${client.id}` === value)
    setCustomerName(selectedClient?.name || '')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanCustomerName = customerName.trim()

    if (!customerType || !cleanCustomerName) {
      setErrorMessage('Complete the customer fields.')
      return
    }

    if (lines.length === 0) {
      setErrorMessage('Add at least one inventory item to the order.')
      return
    }

    // Validate that no line exceeds available warehouse stock
    for (const line of lines) {
      const stock = stockItems.find((s) => s.id === line.stockItemId)
      const maxAvailable = getAvailableStock(stock)

      if (maxAvailable <= 0) {
        setErrorMessage(
          `"${line.name}" has 0 available stock in the selected warehouse. Please select another warehouse or remove this item.`,
        )
        return
      }

      if (line.quantity > maxAvailable) {
        setErrorMessage(
          `Quantity for "${line.name}" (${line.quantity}) exceeds available stock (${maxAvailable} ${line.unit || 'units'}).`,
        )
        return
      }
    }

    let clientId = 0
    let deliveryAddress = 'Store Counter / Pick-up'
    if (customerType.startsWith('client:')) {
      clientId = Number(customerType.replace('client:', ''))
      const foundClient = clients.find((c) => c.id === clientId)
      if (foundClient?.address) {
        deliveryAddress = foundClient.address
      }
    } else if (clients.length > 0) {
      clientId = clients[0].id
      deliveryAddress = clients[0].address || 'Store Counter / Pick-up'
    }

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await onSubmit({
        clientId,
        clientName: cleanCustomerName,
        deliveryAddress,
        itemSummary: lines
          .map((line) => `${line.name}${line.variety ? ` - ${line.variety}` : ''} x${line.quantity}`)
          .join(', '),
        lines,
        discountType,
        discountValue: numericDiscountValue,
        total: totalAfterDiscount,
        status,
        cashier,
      })
      setIsSubmitting(false)
      onClose()
    } catch (err) {
      setIsSubmitting(false)
      setErrorMessage(getErrorMessage(err) || 'Failed to create sales order. Please verify items and try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[94vw] max-w-3xl sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-5 gap-3 overflow-hidden shadow-2xl">
        <DialogHeader className="pb-0 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <ClipboardList className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight">
                {order ? 'Edit Sales Order' : 'Create Sales Order'}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Select customer, choose inventory items, and allocate warehouse stock.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-1.5 px-3 text-xs shrink-0">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 min-h-0 flex-1">
          {/* Customer 3-Column Compact Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 bg-muted/20 p-2.5 rounded-xl border border-border/70">
            <div className="flex flex-col gap-1">
              <Label htmlFor="order-customer-type" className="text-[11px] font-semibold text-foreground/90">
                Client / Customer <span className="text-primary">*</span>
              </Label>
              <Select value={customerType} onValueChange={handleCustomerChange}>
                <SelectTrigger id="order-customer-type" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Choose client or walk-in" />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter((client) => client.isActive)
                    .map((client) => (
                      <SelectItem key={client.id} value={`client:${client.id}`} className="text-xs">
                        {client.name}
                      </SelectItem>
                    ))}
                  <SelectItem value="walk-in" className="text-xs">Walk-in customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="order-customer-name" className="text-[11px] font-semibold text-foreground/90">
                Customer Name <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="order-customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder={customerType === 'walk-in' ? 'e.g. Walk-in Customer' : 'Select client'}
                  className="h-8 pl-8 text-xs bg-background"
                  disabled={!customerType || customerType.startsWith('client:')}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="order-cashier" className="text-[11px] font-semibold text-foreground/90">
                Processed By
              </Label>
              <Input
                id="order-cashier"
                value={cashier}
                readOnly
                className="h-8 bg-muted/50 text-xs font-medium text-muted-foreground"
              />
            </div>
          </div>

          {/* Order items section */}
          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10 flex flex-col min-h-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 p-2.5 bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Package className="size-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Order Items
                </span>
                {selectedProduct && (
                  <span className="text-[11px] ml-1">
                    {selectedProductTotalAvailable > 0 ? (
                      <span className="text-muted-foreground">
                        (<strong className="text-emerald-600 font-semibold">{selectedProductTotalAvailable} {selectedProduct.unit || 'units'}</strong> available)
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold">Out of stock</span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="h-8 text-xs w-64 bg-background">
                    <SelectValue placeholder="Choose inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Choose inventory item</SelectItem>
                    {products
                      .filter((product) => product.isActive)
                      .map((product) => {
                        const totalAvail = getTotalAvailableStock(product.id)
                        const isOut = totalAvail <= 0
                        return (
                          <SelectItem
                            key={product.id}
                            value={String(product.id)}
                            disabled={isOut}
                            className="text-xs"
                          >
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="flex items-center gap-1.5 truncate">
                                <span>{product.name}</span>
                                {product.variety && (
                                  <span className="text-muted-foreground">
                                    ({product.variety})
                                  </span>
                                )}
                              </span>
                              {isOut ? (
                                <span className="shrink-0 text-[10px] font-semibold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  Out of stock (0)
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  {totalAvail} {product.unit || 'units'} available
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddProduct}
                  disabled={
                    selectedProductId === 'none' ||
                    selectedProductTotalAvailable <= 0 ||
                    isSelectedProductFullyAdded
                  }
                  className="h-8 text-xs font-semibold shrink-0 gap-1"
                >
                  <Plus className="size-3" />
                  {isSelectedProductFullyAdded ? 'All Added' : '+ Add'}
                </Button>
              </div>
            </div>

            {/* Items Table container */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {lines.length === 0 ? (
                <div className="flex min-h-[100px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  Select an inventory item above to add to this sales order.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2">Product & Warehouse Source</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-center">Quantity (Stock Limit)</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="w-8 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => {
                      const currentStock = stockItems.find((s) => s.id === line.stockItemId)
                      const maxAvailable = getAvailableStock(currentStock)
                      const isMaxReached = line.quantity >= maxAvailable
                      const isDepleted = maxAvailable <= 0

                      const availableWarehouses = stockItems
                        .filter(
                          (s) => s.inventoryItemId === line.productId && getAvailableStock(s) > 0,
                        )
                        .map((s) => ({
                          stock: s,
                          avail: getAvailableStock(s),
                          warehouse: warehouseMap.get(s.warehouseId),
                        }))

                      return (
                        <tr key={line.productId} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{line.name}</span>
                              {line.variety && (
                                <span className="font-normal text-muted-foreground text-[11px]">
                                  ({line.variety})
                                </span>
                              )}
                            </div>

                            {/* Warehouse fulfillment selector */}
                            {availableWarehouses.length > 1 ? (
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <WarehouseIcon className="size-3 text-primary shrink-0" />
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  Warehouse:
                                </span>
                                <select
                                  value={line.stockItemId}
                                  onChange={(e) =>
                                    handleWarehouseSwitch(line.productId, Number(e.target.value))
                                  }
                                  className="h-5 rounded border border-border bg-background px-1 text-[10px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                  {availableWarehouses.map(({ stock, avail, warehouse }) => (
                                    <option key={stock.id} value={stock.id}>
                                      {warehouse?.name || `Warehouse #${stock.warehouseId}`} ({avail}{' '}
                                      {line.unit || 'units'} avail)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 font-normal">
                                <WarehouseIcon className="size-3 text-primary/70 shrink-0" />
                                {line.warehouseId ? (
                                  <span>
                                    Fulfilling from:{' '}
                                    <strong className="text-foreground font-medium">
                                      {warehouseMap.get(line.warehouseId)?.name ||
                                        `Warehouse #${line.warehouseId}`}
                                    </strong>
                                    <span className="ml-1 text-emerald-600 font-semibold">
                                      ({maxAvailable} {line.unit || 'units'} avail)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    <AlertCircle className="size-2.5" />
                                    No warehouse stock record
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-center gap-0.5">
                              <div
                                className={`mx-auto flex w-fit items-center rounded-md border bg-background transition-colors ${
                                  isMaxReached ? 'border-amber-500/50 shadow-2xs' : 'border-border'
                                }`}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease ${line.name} quantity`}
                                  onClick={() => changeQuantity(line.productId, -1)}
                                  disabled={line.quantity <= 1}
                                  className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Minus className="size-3" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxAvailable}
                                  value={line.quantity}
                                  onChange={(e) =>
                                    handleDirectQuantityChange(line.productId, e.target.value)
                                  }
                                  className="h-6 w-10 border-0 bg-transparent text-center text-xs font-bold text-foreground focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase ${line.name} quantity`}
                                  onClick={() => changeQuantity(line.productId, 1)}
                                  disabled={isMaxReached || isDepleted}
                                  title={
                                    isMaxReached
                                      ? `All available stock (${maxAvailable} ${line.unit || 'units'}) taken`
                                      : 'Increase quantity'
                                  }
                                  className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Plus className="size-3" />
                                </button>
                              </div>

                              {isMaxReached ? (
                                <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  All stock taken ({maxAvailable})
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-muted-foreground">
                                  Max: <strong className="text-foreground">{maxAvailable}</strong>{' '}
                                  {line.unit || 'units'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-foreground font-mono">
                            {formatCurrency(line.unitPrice * line.quantity)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              aria-label={`Remove ${line.name}`}
                              onClick={() =>
                                setLines((currentLines) =>
                                  currentLines.filter((item) => item.productId !== line.productId),
                                )
                              }
                              className="text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Horizontal totals & discount bar */}
            <div className="border-t border-border/70 bg-background/80 px-3 py-2 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {lines.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-medium">Discount:</span>
                    <Select
                      value={discountType}
                      onValueChange={(value) => {
                        setDiscountType(value as 'peso' | 'percentage')
                        setDiscountValue('')
                        setErrorMessage('')
                      }}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="peso" className="text-xs">₱</SelectItem>
                        <SelectItem value="percentage" className="text-xs">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Discount amount"
                      type="number"
                      min={0}
                      max={discountType === 'percentage' ? 100 : grossTotal}
                      step="0.01"
                      value={discountValue}
                      onChange={(event) => setDiscount(event.target.value)}
                      placeholder={discountType === 'percentage' ? '0' : '0.00'}
                      inputMode="decimal"
                      className="h-7 w-20 text-right text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                )}

                <div className="ml-auto flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground text-[11px]">
                    Subtotal: <strong className="font-semibold text-foreground">{formatCurrency(subtotal)}</strong>
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    VAT: <strong className="font-semibold text-foreground">{formatCurrency(vat)}</strong>
                  </span>
                  <span className="text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                    Total: {formatCurrency(totalAfterDiscount)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Dialog Footer */}
          <DialogFooter className="pt-1 shrink-0 flex items-center justify-end gap-2 border-t border-border/50">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs font-semibold gap-1.5 shadow-xs">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{order ? 'Saving...' : 'Creating Order...'}</span>
                </>
              ) : (
                <>
                  <ClipboardList className="size-3.5" />
                  <span>{order ? 'Save Changes' : 'Create Sales Order'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
