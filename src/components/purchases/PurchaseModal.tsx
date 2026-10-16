import type { OrderSubmissionProps } from '@/hooks/use-order-submission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import type { ColumnDef } from '@/components/ui/data-table'
import { OrderEntryDialog } from '@/components/order-entry/OrderEntryDialog'
import {
  OrderDecimalInput,
  OrderField,
  ProductIdentity,
  RemoveOrderItem,
} from '@/components/order-entry/OrderEntryFields'
import { OrderAdditionalDetails } from '@/components/order-entry/OrderAdditionalDetails'
import { OrderItemsTable } from '@/components/order-entry/OrderItemsTable'
import {
  OrderProductCatalog,
  type OrderCatalogState,
} from '@/components/order-entry/OrderProductCatalog'
import { usePurchaseOrderEntry } from '@/features/logistics/purchase-order-entry.hooks'
import type { PurchaseLine } from '@/features/logistics/purchase-order-entry.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'
import { formatOrderCurrency, lineSubtotal } from '@/lib/order-amounts'
import { priceError, quantityError } from '@/lib/order-entry.schema'

export type { PurchaseLine } from '@/features/logistics/purchase-order-entry.types'

type PurchaseModalProps = OrderSubmissionProps<CreatePurchaseOrderPayload> & {
  open: boolean
  onClose: () => void
  suppliers: Supplier[]
  products: InventoryItemResponse[]
  stockItems?: StockItem[]
  catalogState?: OrderCatalogState
  processedBy: string
}

export function PurchaseModal({
  open,
  onClose,
  onSubmit,
  onConfirm,
  onConfirmed,
  savedDraft,
  suppliers,
  products,
  stockItems = [],
  catalogState,
  processedBy,
}: PurchaseModalProps) {
  const form = usePurchaseOrderEntry({
    suppliers,
    products,
    onSubmit,
    onConfirm,
    onConfirmed,
    savedDraft,
    onClose,
  })
  const columns: ColumnDef<PurchaseLine>[] = [
    {
      id: 'product',
      header: 'Product',
      className: 'order-entry-product',
      cell: ({ row }) => <ProductIdentity name={row.name} variety={row.variety} unit={row.unit} />,
    },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      width: 100,
      cell: ({ row }) => (
        <OrderDecimalInput
          mobileLabel="Quantity"
          aria-label={`Quantity for ${row.name}`}
          value={row.quantity}
          aria-invalid={!!quantityError(row.quantity)}
          ref={(input) => form.focus.quantityRef(row.inventoryItemId, input)}
          onChange={(event) => form.updateLine(row.inventoryItemId, 'quantity', event.target.value)}
        />
      ),
    },
    {
      id: 'cost',
      header: 'Unit Cost',
      align: 'right',
      width: 130,
      cell: ({ row }) => (
        <OrderDecimalInput
          currency
          mobileLabel="Unit Cost"
          aria-label={`Unit cost for ${row.name}`}
          value={row.unitCost}
          placeholder="0.00"
          aria-invalid={row.unitCost !== '' && !!priceError(row.unitCost)}
          onChange={(event) => form.updateLine(row.inventoryItemId, 'unitCost', event.target.value)}
        />
      ),
    },
    {
      id: 'subtotal',
      header: 'Subtotal',
      width: 116,
      align: 'right',
      cell: ({ row }) => (
        <>
          <span aria-hidden="true" className="order-entry-mobile-label">
            Subtotal
          </span>
          <span className="tabular-nums">
            {formatOrderCurrency(lineSubtotal(row.quantity, row.unitCost))}
          </span>
        </>
      ),
    },
    {
      id: 'remove',
      header: 'Remove',
      width: 64,
      align: 'right',
      className: 'order-entry-remove',
      cell: ({ row }) => (
        <RemoveOrderItem name={row.name} onRemove={() => form.removeLine(row.inventoryItemId)} />
      ),
    },
  ]
  const complete = form.lines.every(
    (line) => !quantityError(line.quantity) && !priceError(line.unitCost),
  )
  return (
    <OrderEntryDialog
      open={open}
      onClose={onClose}
      onSubmit={form.submit}
      title={savedDraft ? 'Confirm Purchase Order' : 'Create Purchase Order'}
      description="Choose catalog products, then enter the supplier's cost and quantity."
      submission={form.submission}
      busy={form.busy}
      error={form.error}
      itemCount={form.lines.length}
      catalog={(returnToEditor) => (
        <OrderProductCatalog
          products={products}
          stockItems={stockItems}
          state={catalogState}
          busy={form.submission.locked}
          onAdd={(product) => {
            form.addProduct(product)
            returnToEditor()
          }}
        />
      )}
    >
      {(openCatalog) => (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OrderField id="po-supplier" label="Supplier" required>
              <SearchableDropdown
                id="po-supplier"
                options={suppliers.filter((supplier) => supplier.isActive)}
                value={form.supplierId}
                onValueChange={form.setSupplierId}
                getOptionValue={(supplier) => String(supplier.id)}
                getOptionLabel={(supplier) => `${supplier.name} (${supplier.code})`}
                getOptionSearchText={(supplier) =>
                  [
                    supplier.name,
                    supplier.code,
                    supplier.contactPerson,
                    supplier.email,
                    supplier.phone,
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                placeholder="Search suppliers"
                searchPlaceholder="Search supplier name or contact..."
                emptyMessage="No active suppliers found."
                ariaLabel="Search and choose a supplier"
                className="h-9 text-sm"
              />
            </OrderField>
            <OrderField id="po-expected" label="Expected Delivery Date">
              <Input
                id="po-expected"
                type="date"
                className="h-9 min-w-0 text-sm"
                value={form.expectedAt}
                onChange={(event) => form.setExpectedAt(event.target.value)}
              />
            </OrderField>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Processed by: {processedBy}
            </p>
          </div>
          <section className="flex min-w-0 flex-col gap-2" aria-label="Purchase order items">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Selected Order Items</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="order-composer-open-catalog h-9"
                onClick={openCatalog}
              >
                Add Products
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter supplier cost per unit. Quantities and costs support two decimal places.
            </p>
            <OrderItemsTable
              data={form.lines}
              columns={columns}
              getRowKey={(line) => line.inventoryItemId}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
              <span className="text-xs text-muted-foreground">
                {form.lines.length} {form.lines.length === 1 ? 'item' : 'items'}
              </span>
              <span>
                Total:{' '}
                <strong className="font-semibold tabular-nums">
                  {formatOrderCurrency(complete ? form.amounts.total : null)}
                </strong>
              </span>
            </div>
          </section>
          <OrderAdditionalDetails
            prefix="po"
            reference={form.reference}
            onReferenceChange={form.setReference}
            notes={form.notes}
            onNotesChange={form.setNotes}
            referenceLabel="Supplier Invoice / External Ref"
            referencePlaceholder="e.g. INV-9872"
            notesPlaceholder="Delivery terms, payment terms, or remarks"
          />
        </>
      )}
    </OrderEntryDialog>
  )
}
