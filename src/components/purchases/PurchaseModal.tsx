import { formatProductUnit } from '@/lib/product-unit'
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
import { OrderLineAmounts, OrderLineDiscount, OrderPricingSummary } from '@/components/order-entry/OrderLineDiscount'
import { discountFields } from '@/lib/order-line-pricing'
import {
  OrderProductCatalog,
  type OrderCatalogState,
} from '@/components/order-entry/OrderProductCatalog'
import { usePurchaseOrderEntry } from '@/features/logistics/purchase-order-entry.hooks'
import type { PurchaseLine } from '@/features/logistics/purchase-order-entry.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderRecord,
} from '@/features/logistics/purchase-orders.types'
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
  draftOrder?: PurchaseOrderRecord
  onUpdateDraft?: (
    id: number,
    payload: CreatePurchaseOrderPayload,
  ) => Promise<PurchaseOrderRecord>
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
  draftOrder,
  onUpdateDraft,
}: PurchaseModalProps) {
  const form = usePurchaseOrderEntry({
    suppliers,
    products,
    onSubmit,
    onConfirm,
    onConfirmed,
    savedDraft,
    draftOrder,
    onUpdateDraft,
    onClose,
  })
  const displayLines = form.lines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.inventoryItemId)
    return {
      ...line,
      name: product?.name || line.name,
      variety: product?.variety ?? line.variety,
      unit: product?.unit ?? line.unit,
    }
  })
  const columns: ColumnDef<PurchaseLine>[] = [
    {
      id: 'product',
      header: 'Product',
      className: 'order-entry-product',
      cell: ({ row }) => <ProductIdentity name={row.name} variety={row.variety} />,
    },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      width: 140,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span
            aria-hidden="true"
            className="order-entry-mobile-label text-xs text-muted-foreground"
          >
            Quantity
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <OrderDecimalInput
                mobileLabel=""
                aria-label={`Quantity for ${row.name}`}
                aria-describedby={`purchase-quantity-unit-${row.formId}`}
                value={row.quantity}
                aria-invalid={!!quantityError(row.quantity)}
                ref={(input) => form.focus.quantityRef(row.formId, input)}
                onChange={(event) =>
                  form.updateLine(row.formId, 'quantity', event.target.value)
                }
              />
            </div>
            <span
              id={`purchase-quantity-unit-${row.formId}`}
              className="max-w-16 text-left text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]"
            >
              {formatProductUnit(row.unit)}
            </span>
          </div>
        </div>
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
          onChange={(event) => form.updateLine(row.formId, 'unitCost', event.target.value)}
        />
      ),
    },
    {
      id: 'discount',
      header: 'Line Discount',
      width: 148,
      cell: ({ row }) => <OrderLineDiscount id={`purchase-discount-${row.formId}`} name={row.name}
        value={row.discount} line={{ quantity: row.quantity, unitPrice: row.unitCost }}
        onChange={(discount) => form.updateDiscount(row.formId, discount)} />,
    },
    {
      id: 'subtotal',
      header: 'Amounts',
      width: 140,
      align: 'right',
      cell: ({ row }) => <OrderLineAmounts line={{ ...row, unitPrice: row.unitCost, ...discountFields(row.discount) }}
        saved={form.submission.savedOrder?.items?.[form.lines.findIndex((line) => line.formId === row.formId)]} />,
    },
    {
      id: 'remove',
      header: 'Remove',
      width: 64,
      align: 'right',
      className: 'order-entry-remove',
      cell: ({ row }) => (
        <RemoveOrderItem name={row.name} onRemove={() => form.removeLine(row.formId)} />
      ),
    },
  ]
  return (
    <OrderEntryDialog
      open={open}
      onClose={onClose}
      onSubmit={form.submit}
      title={
        draftOrder
          ? `Edit Draft ${draftOrder.orderNumber}`
          : savedDraft
            ? 'Confirm Purchase Order'
            : 'Create Purchase Order'
      }
      description={
        draftOrder
          ? 'Update the saved draft, then save it or confirm the purchase order.'
          : "Choose catalog products, then enter the supplier's cost and quantity. A supplier is required only when confirming."
      }
      submission={form.submission}
      busy={form.busy}
      error={form.error}
      errorFocusId={form.errorFocusId}
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
            <OrderField id="po-supplier" label="Supplier (optional for drafts)">
              <SearchableDropdown
                id="po-supplier"
                options={suppliers.filter(
                  (supplier) =>
                    supplier.isActive || String(supplier.id) === form.supplierId,
                )}
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
              Enter supplier cost per unit. Discounts apply to each entire line, before VAT.
            </p>
            <OrderItemsTable
              data={displayLines}
              columns={columns}
              getRowKey={(line) => line.formId}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
              <span className="text-xs text-muted-foreground">
                {form.lines.length} {form.lines.length === 1 ? 'item' : 'items'}
              </span>
              <OrderPricingSummary amounts={form.amounts} />
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
