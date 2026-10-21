import type { OrderSubmissionProps } from '@/hooks/use-order-submission'
import { Button } from '@/components/ui/button'
import type { ColumnDef } from '@/components/ui/data-table'
import { OrderEntryDialog } from '@/components/order-entry/OrderEntryDialog'
import {
  OrderDecimalInput,
  ProductIdentity,
  RemoveOrderItem,
} from '@/components/order-entry/OrderEntryFields'
import { OrderItemsTable } from '@/components/order-entry/OrderItemsTable'
import {
  OrderProductCatalog,
  type OrderCatalogState,
} from '@/components/order-entry/OrderProductCatalog'
import { useSalesOrderEntry } from '@/features/crm/sales-order-entry.hooks'
import { SalesOrderCustomerInformation, SalesOrderAdditionalDetails } from './SalesOrderDetails'
import { SalesOrderTotals } from './SalesOrderTotals'
import type {
  EditableSalesOrder,
  OrderFormValues,
  OrderLine,
} from '@/features/crm/sales-order-entry.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import { formatOrderCurrency, lineSubtotal } from '@/lib/order-amounts'
import { priceError, quantityError } from '@/lib/order-entry.schema'

export type {
  OrderFormValues,
  OrderLine,
  OrderStatus,
} from '@/features/crm/sales-order-entry.types'

type OrderModalProps = OrderSubmissionProps<OrderFormValues> & {
  open: boolean
  onClose: () => void
  clients: Client[]
  products: InventoryItemResponse[]
  warehouses?: Warehouse[]
  stockItems?: StockItem[]
  catalogState?: OrderCatalogState
  cashier: string
  order?: EditableSalesOrder
  onNavigateToPurchases?: () => void
  onNavigateToDeliveries?: () => void
  onNavigateToInventory?: () => void
}

export function OrderModal({
  open,
  onClose,
  onSubmit,
  onConfirm,
  onConfirmed,
  savedDraft,
  clients,
  products,
  stockItems = [],
  catalogState,
  cashier,
  order,
}: OrderModalProps) {
  const form = useSalesOrderEntry({
    clients,
    products,
    cashier,
    order,
    onSubmit,
    onConfirm,
    onConfirmed,
    savedDraft,
    onClose,
  })
  const columns: ColumnDef<OrderLine>[] = [
    {
      id: 'product',
      header: 'Product',
      className: 'order-entry-product',
      cell: ({ row }) => (
        <ProductIdentity name={row.name} variety={row.variety} unit={row.unit} />
      ),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      width: 100,
      cell: ({ row }) => (
        <OrderDecimalInput
          mobileLabel="Quantity"
          id={`order-quantity-${row.productId}`}
          aria-label={`Quantity for ${row.name}`}
          value={row.quantity}
          aria-invalid={!!quantityError(row.quantity)}
          ref={(input) => form.focus.quantityRef(row.productId, input)}
          onChange={(event) => form.updateLine(row.productId, 'quantity', event.target.value)}
        />
      ),
    },
    {
      id: 'price',
      header: 'Unit Price',
      align: 'right',
      width: 130,
      cell: ({ row }) => (
        <OrderDecimalInput
          currency
          mobileLabel="Unit Price"
          aria-label={`Unit price for ${row.name}`}
          value={row.unitPrice}
          aria-invalid={!!priceError(row.unitPrice)}
          onChange={(event) => form.updateLine(row.productId, 'unitPrice', event.target.value)}
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
            {formatOrderCurrency(lineSubtotal(row.quantity, row.unitPrice))}
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
        <RemoveOrderItem name={row.name} onRemove={() => form.removeLine(row.productId)} />
      ),
    },
  ]
  return (
    <OrderEntryDialog
      open={open}
      onClose={onClose}
      onSubmit={form.submit}
      title={savedDraft ? 'Confirm Sales Order' : 'Create Sales Order'}
      description="Choose a customer, add products, and review the order."
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
          sales
          onAdd={(product) => {
            form.addProduct(product)
            returnToEditor()
          }}
        />
      )}
    >
      {(openCatalog) => (
        <>
          <SalesOrderCustomerInformation clients={clients} cashier={cashier} form={form} />
          <section aria-label="Sales order items" className="flex min-w-0 flex-col gap-2">
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
              Quantities and prices support two decimal places.
            </p>
            <OrderItemsTable
              data={form.lines}
              columns={columns}
              getRowKey={(line) => line.productId}
            />
          </section>
          <SalesOrderTotals form={form} />
          <SalesOrderAdditionalDetails form={form} />
        </>
      )}
    </OrderEntryDialog>
  )
}
