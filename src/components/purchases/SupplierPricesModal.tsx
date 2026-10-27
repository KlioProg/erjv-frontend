import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { SupplierProductPrice } from '@/features/logistics/supplier-pricing.types'
import {
  useSaveSupplierPrice,
  useSupplierPrices,
} from '@/features/logistics/supplier-pricing.hooks'
import {
  decimalString,
  formatPurchaseMoney,
  purchaseDecimal,
  supplierReferenceCost,
} from '@/features/logistics/purchase-pricing'
import { getErrorMessage } from '@/lib/api-client'

export function SupplierPricesModal({
  supplier,
  products,
  onClose,
  canEditCosts,
  productsLoading = false,
}: {
  supplier: Supplier
  products: InventoryItemResponse[]
  onClose: () => void
  canEditCosts: boolean
  productsLoading?: boolean
}) {
  const prices = useSupplierPrices(supplier.id)
  const save = useSaveSupplierPrice()
  const [productId, setProductId] = useState('')
  const [cost, setCost] = useState<string | null>(null)
  const [error, setError] = useState('')
  const referenceCost = supplierReferenceCost(prices.data ?? [], Number(productId))
  const draft = cost ?? referenceCost
  const editable = canEditCosts && supplier.isActive
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!editable || save.isPending) return
    if (!products.some((row) => row.id === Number(productId) && row.isActive))
      return setError('Select an active product.')
    const parsed = draft.trim() === '' ? null : purchaseDecimal(draft)
    if (draft.trim() !== '' && parsed === null)
      return setError(
        'Enter a non-negative cost with up to two decimals and within the supported amount.',
      )
    setError('')
    try {
      await save.mutateAsync({
        supplierId: supplier.id,
        inventoryItemId: Number(productId),
        latestUnitCost: parsed === null ? null : decimalString(parsed),
      })
      setProductId('')
      setCost(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    }
  }
  const columns: ColumnDef<SupplierProductPrice>[] = [
    {
      accessorKey: 'inventoryItemId',
      header: 'Product',
      className: 'whitespace-normal break-words',
      cell: ({ row }) =>
        products.find((product) => product.id === row.inventoryItemId)?.name ??
        `Product #${row.inventoryItemId}`,
    },
    {
      accessorKey: 'latestUnitCost',
      header: 'Reference Cost',
      align: 'right',
      cell: ({ row }) =>
        row.latestUnitCost === null
          ? 'Not set'
          : formatPurchaseMoney(purchaseDecimal(row.latestUnitCost)),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: ({ row }) =>
        editable &&
        products.some((product) => product.id === row.inventoryItemId && product.isActive) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              setProductId(String(row.inventoryItemId))
              setCost(row.latestUnitCost ?? '')
              setError('')
            }}
            aria-label={`Edit reference price for ${products.find((product) => product.id === row.inventoryItemId)?.name ?? 'product'}`}
          >
            Edit
          </Button>
        ) : null,
    },
  ]
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>Supplier Prices</DialogTitle>
          <DialogDescription>
            {supplier.name} — optional purchase-cost references. Saving a quote does not change
            existing orders or catalog selling prices.
          </DialogDescription>
        </DialogHeader>
        {(error || prices.isError) && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {error || 'Could not load supplier prices.'}
              {prices.isError && (
                <Button type="button" variant="link" onClick={() => void prices.refetch()}>
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {editable && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-price-product">Inventory Product</Label>
              <SearchableDropdown
                id="supplier-price-product"
                options={products.filter((row) => row.isActive)}
                value={productId}
                disabled={productsLoading || save.isPending || prices.isLoading || prices.isError}
                onValueChange={(value) => {
                  setProductId(value)
                  setCost(null)
                  setError('')
                }}
                getOptionValue={(row) => String(row.id)}
                getOptionLabel={(row) => row.name + (row.variety ? ` (${row.variety})` : '')}
                placeholder="Search inventory products"
                searchPlaceholder="Search by product or variety"
                emptyMessage="No active inventory products found."
                ariaLabel="Select product for supplier reference price"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-reference-cost">Reference Unit Cost (₱)</Label>
              <Input
                id="supplier-reference-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft}
                disabled={save.isPending || !productId}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Optional quoted cost"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to link the product without a saved price, or to clear an existing quote.
            </p>
            <Button
              type="submit"
              disabled={save.isPending || !productId || prices.isLoading || prices.isError}
            >
              {save.isPending ? 'Saving…' : 'Save Reference Price'}
            </Button>
          </form>
        )}
        <DataTable
          data={prices.data ?? []}
          columns={columns}
          getRowKey={(row) => row.inventoryItemId}
          isLoading={prices.isLoading}
          pagination={false}
          tableClassName="table-fixed w-full"
          emptyContent={
            <p className="py-5 text-sm text-muted-foreground">
              No products linked to this supplier yet. Purchase orders can still use any active
              inventory product.
            </p>
          }
        />
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  )
}
