import { useState, type FormEvent } from 'react'
import { ClipboardList, Minus, Package, Plus, Trash2, UserRound } from 'lucide-react'
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
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'

export type OrderFormValues = {
  invoiceNo: string
  clientName: string
  itemSummary: string
  total: number
  status: 'Completed' | 'Pending'
  cashier: string
}

type OrderModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: OrderFormValues) => void
  clients: Client[]
  products: InventoryItemResponse[]
  cashier: string
}

type OrderLine = {
  productId: number
  name: string
  variety?: string | null
  unitPrice: number
  quantity: number
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
  cashier,
}: OrderModalProps) {
  const [invoiceNo, setInvoiceNo] = useState('POS-NEW')
  const [customerType, setCustomerType] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('none')
  const [lines, setLines] = useState<OrderLine[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  const grossTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const subtotal = grossTotal * (1 - VAT_RATE)
  const vat = grossTotal * VAT_RATE

  const handleAddProduct = () => {
    const selectedProduct = products.find((product) => String(product.id) === selectedProductId)
    if (!selectedProduct) return

    setLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.productId === selectedProduct.id)
      if (existingLine) {
        return currentLines.map((line) =>
          line.productId === selectedProduct.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      }

      return [
        ...currentLines,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          variety: selectedProduct.variety,
          unitPrice: selectedProduct.unitPrice,
          quantity: 1,
        },
      ]
    })
    setSelectedProductId('none')
    setErrorMessage('')
  }

  const changeQuantity = (productId: number, change: number) => {
    setLines((currentLines) =>
      currentLines
        .map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.max(0, line.quantity + change) }
            : line,
        )
        .filter((line) => line.quantity > 0),
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanInvoiceNo = invoiceNo.trim()
    const cleanCustomerName = customerName.trim()

    if (!cleanInvoiceNo || !customerType || !cleanCustomerName) {
      setErrorMessage('Complete the invoice and customer fields.')
      return
    }

    if (lines.length === 0) {
      setErrorMessage('Add at least one inventory item to the order.')
      return
    }

    onSubmit({
      invoiceNo: cleanInvoiceNo,
      clientName: cleanCustomerName,
      itemSummary: lines
        .map((line) => `${line.name}${line.variety ? ` - ${line.variety}` : ''} x${line.quantity}`)
        .join(', '),
      total: grossTotal,
      status: 'Pending',
      cashier,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(860px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
            <ClipboardList className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Create POS Order</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Build the receipt, adjust quantities, and post the order when it is ready.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-invoice" className="text-xs font-semibold text-foreground/90">
              Invoice No <span className="text-primary">*</span>
            </Label>
            <Input
              id="order-invoice"
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              className="h-10 text-sm"
              required
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Order items
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Prices are fixed from inventory.</p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 text-xs sm:w-64 sm:flex-none">
                    <SelectValue placeholder="Choose inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose inventory item</SelectItem>
                    {products.filter((product) => product.isActive).map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        <span className="flex items-center gap-2">
                          <Package className="size-3.5 text-primary" />
                          {product.name} {product.variety ? `- ${product.variety}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddProduct}
                  disabled={selectedProductId === 'none'}
                  className="h-9 shrink-0 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Add an inventory item to start the receipt.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right">Unit price</th>
                      <th className="px-3 py-2.5 text-center">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => (
                      <tr key={line.productId}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {line.name}
                          {line.variety && <span className="ml-1 font-normal text-muted-foreground">{line.variety}</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{formatCurrency(line.unitPrice)}</td>
                        <td className="px-3 py-3">
                          <div className="mx-auto flex w-fit items-center rounded-lg border border-border bg-background">
                            <button
                              type="button"
                              aria-label={`Decrease ${line.name} quantity`}
                              onClick={() => changeQuantity(line.productId, -1)}
                              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold">{line.quantity}</span>
                            <button
                              type="button"
                              aria-label={`Increase ${line.name} quantity`}
                              onClick={() => changeQuantity(line.productId, 1)}
                              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(line.unitPrice * line.quantity)}</td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            aria-label={`Remove ${line.name}`}
                            onClick={() => setLines((currentLines) => currentLines.filter((item) => item.productId !== line.productId))}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-border/70 bg-background/60 px-4 py-3">
              <div className="ml-auto flex max-w-xs flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal (88%)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (12%)</span>
                  <span>{formatCurrency(vat)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border/70 pt-2 text-sm font-extrabold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(grossTotal)}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-customer-type" className="text-xs font-semibold text-foreground/90">
              Client / Customer <span className="text-primary">*</span>
            </Label>
            <Select value={customerType} onValueChange={handleCustomerChange}>
              <SelectTrigger id="order-customer-type">
                <SelectValue placeholder="Choose an existing client or walk-in customer" />
              </SelectTrigger>
              <SelectContent>
                {clients.filter((client) => client.isActive).map((client) => (
                  <SelectItem key={client.id} value={`client:${client.id}`}>
                    {client.name}
                  </SelectItem>
                ))}
                <SelectItem value="walk-in">Walk-in customer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-customer-name" className="text-xs font-semibold text-foreground/90">
              Customer Name <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="order-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={customerType === 'walk-in' ? 'e.g. Walk-in Customer' : 'Select a client above'}
                className="h-10 pl-9 text-sm"
                disabled={!customerType || customerType.startsWith('client:')}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-cashier" className="text-xs font-semibold text-foreground/90">
              Processed By
            </Label>
            <Input id="order-cashier" value={cashier} readOnly className="h-10 bg-muted/40 text-sm" />
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="font-semibold">
              <ClipboardList className="size-4" />
              Post Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
