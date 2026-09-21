import { useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, Minus, Plus, Trash2 } from 'lucide-react'
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

export type PurchaseStatus = 'Active' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid'

export type PurchaseLine = {
  productId: number
  name: string
  variety?: string | null
  unit?: string
  unitCost?: number
  quantity: number
}

export type PurchaseFormValues = {
  supplierName: string
  referenceNo: string
  purchaseDate: string
  expectedDeliveryDate: string
  lines: PurchaseLine[]
  total: number
  status: PurchaseStatus
  paymentStatus: PaymentStatus
  processedBy: string
}

type PurchaseModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: PurchaseFormValues) => void
  processedBy: string
  purchase?: PurchaseFormValues & { id: number }
}

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function PurchaseModal({
  open,
  onClose,
  onSubmit,
  processedBy,
  purchase,
}: PurchaseModalProps) {
  const [supplierName, setSupplierName] = useState(purchase?.supplierName || '')
  const [referenceNo, setReferenceNo] = useState(purchase?.referenceNo || '')
  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchaseDate || today())
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    purchase?.expectedDeliveryDate || '',
  )
  const [lines, setLines] = useState<PurchaseLine[]>(purchase?.lines || [])
  const [status, setStatus] = useState<PurchaseStatus>(purchase?.status || 'Active')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    purchase?.paymentStatus || 'Unpaid',
  )
  const [errorMessage, setErrorMessage] = useState('')

  const total = lines.reduce((sum, line) => sum + (line.unitCost || 0) * line.quantity, 0)

  const handleAddProduct = () => {
    setLines((currentLines) => [
      ...currentLines,
      {
        productId: -(Date.now() + currentLines.length),
        name: '',
        variety: '',
        unit: '',
        unitCost: undefined,
        quantity: 1,
      },
    ])
    setErrorMessage('')
  }

  const updateLine = <K extends keyof PurchaseLine>(
    productId: number,
    field: K,
    value: PurchaseLine[K],
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) => (line.productId === productId ? { ...line, [field]: value } : line)),
    )
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

  const changeCost = (productId: number, value: string) => {
    const unitCost = Number(value)
    if (!Number.isFinite(unitCost) || unitCost < 0) return
    setLines((currentLines) =>
      currentLines.map((line) => (line.productId === productId ? { ...line, unitCost } : line)),
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanSupplierName = supplierName.trim()

    if (!cleanSupplierName || !purchaseDate) {
      setErrorMessage('Complete the supplier and purchase date fields.')
      return
    }

    if (lines.length === 0) {
      setErrorMessage('Add at least one product to the purchase.')
      return
    }

    if (lines.some((line) => !line.name.trim() || line.quantity <= 0 || (line.unitCost !== undefined && line.unitCost < 0))) {
      setErrorMessage('Complete each product name, quantity, and unit cost.')
      return
    }

    onSubmit({
      supplierName: cleanSupplierName,
      referenceNo: referenceNo.trim(),
      purchaseDate,
      expectedDeliveryDate,
      lines,
      total,
      status,
      paymentStatus,
      processedBy,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(860px,calc(100vh-2rem))] overflow-y-auto gap-5 p-6 sm:max-w-3xl">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
            <ClipboardList className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {purchase ? 'Edit Purchase' : 'Create Purchase'}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Record incoming products, supplier costs, delivery timing, and payment status.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-supplier" className="text-xs font-semibold">
                Supplier <span className="text-primary">*</span>
              </Label>
              <Input
                id="purchase-supplier"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Supplier or vendor name"
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-reference" className="text-xs font-semibold">
                PO / Reference No.
              </Label>
              <Input
                id="purchase-reference"
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Optional purchase reference"
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-date" className="text-xs font-semibold">
                Purchase Date <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="h-10 pl-9 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-delivery-date" className="text-xs font-semibold">
                Expected Delivery Date
              </Label>
              <Input
                id="purchase-delivery-date"
                type="date"
                value={expectedDeliveryDate}
                onChange={(event) => setExpectedDeliveryDate(event.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/10">
            <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Purchased products
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Costs default from the product catalog and can be adjusted per purchase.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddProduct}
                className="h-9 shrink-0 gap-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Add Product
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Add a product to start the purchase.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-3 py-2.5">Unit</th>
                      <th className="px-3 py-2.5 text-right">Unit cost</th>
                      <th className="px-3 py-2.5 text-center">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((line) => (
                      <tr key={line.productId}>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex flex-col gap-1.5">
                            <Input
                              aria-label="Purchased product name"
                              value={line.name}
                              onChange={(event) => updateLine(line.productId, 'name', event.target.value)}
                              placeholder="Product name"
                              className="h-8 w-44 text-xs"
                            />
                            <Input
                              aria-label="Purchased product variety"
                              value={line.variety || ''}
                              onChange={(event) => updateLine(line.productId, 'variety', event.target.value)}
                              placeholder="Variety / grade (optional)"
                              className="h-8 w-44 text-xs"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Input
                            aria-label={`${line.name || ''} `}
                            value={line.unit || ''}
                            onChange={(event) => updateLine(line.productId, 'unit', event.target.value)}
                            placeholder="unit"
                            className="h-8 w-20 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Input
                            aria-label={`${line.name} unit cost`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost}
                            onChange={(event) => changeCost(line.productId, event.target.value)}
                            placeholder="0.00"
                            className="ml-auto h-8 w-24 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </td>
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
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatCurrency(line.unitCost || 0 * line.quantity)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            aria-label={`Remove ${line.name}`}
                            onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}
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

            <div className="flex items-center justify-between border-t border-border/70 bg-background/60 px-4 py-3 text-sm font-extrabold">
              <span>Total Purchase Cost</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-status" className="text-xs font-semibold">Purchase Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as PurchaseStatus)}>
                <SelectTrigger id="purchase-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-payment-status" className="text-xs font-semibold">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}>
                <SelectTrigger id="purchase-payment-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase-processed-by" className="text-xs font-semibold">Processed By</Label>
              <Input id="purchase-processed-by" value={processedBy} readOnly className="h-10 bg-muted/40 text-sm" />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="font-semibold">
              <ClipboardList className="size-4" />
              {purchase ? 'Save Changes' : 'Record Purchase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
