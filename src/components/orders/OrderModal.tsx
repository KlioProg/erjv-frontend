import type { OrderSubmissionProps } from '@/hooks/use-order-submission'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ColumnDef } from '@/components/ui/data-table'
import { OrderEntryDialog } from '@/components/order-entry/OrderEntryDialog'
import {
  OrderDecimalInput,
  ProductIdentity,
  RemoveOrderItem,
} from '@/components/order-entry/OrderEntryFields'
import { OrderItemsTable } from '@/components/order-entry/OrderItemsTable'
import { OrderLineAmounts, OrderLineDiscount } from '@/components/order-entry/OrderLineDiscount'
import { discountFields } from '@/lib/order-line-pricing'
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
  SalesOrderFormLine,
  SalesOrderDraftProps,
} from '@/features/crm/sales-order-entry.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import { formatOrderCurrency } from '@/lib/order-amounts'
import { priceError, quantityError } from '@/lib/order-entry.schema'

export type {
  OrderFormValues,
  OrderLine,
  OrderStatus,
} from '@/features/crm/sales-order-entry.types'

type OrderModalProps = OrderSubmissionProps<OrderFormValues> &
  SalesOrderDraftProps & {
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
  draftOrder,
  onUpdateDraft,
  onLoadLatest,
}: OrderModalProps) {
  const form = useSalesOrderEntry({
    clients,
    products,
    cashier,
    order,
    draftOrder,
    onUpdateDraft,
    onLoadLatest,
    onSubmit,
    onConfirm,
    onConfirmed,
    savedDraft,
    onClose,
  })
  const columns: ColumnDef<SalesOrderFormLine>[] = [
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
        <>
          <OrderDecimalInput
            mobileLabel="Quantity"
            id={`order-quantity-${row.formId}`}
            aria-label={`Quantity for ${row.name}`}
            value={row.quantity}
            placeholder="0"
            aria-describedby={
              quantityError(row.quantity) ? `order-quantity-error-${row.formId}` : undefined
            }
            aria-invalid={!!quantityError(row.quantity)}
            ref={(input) => form.focus.quantityRef(row.formId, input)}
            onChange={(event) => form.updateLine(row.formId, 'quantity', event.target.value)}
          />
          {quantityError(row.quantity) && (
            <p id={`order-quantity-error-${row.formId}`} className="mt-1 text-xs text-destructive">
              {quantityError(row.quantity)}
            </p>
          )}
        </>
      ),
    },
    {
      id: 'price',
      header: 'Unit Price',
      align: 'right',
      width: 120,
      cell: ({ row }) => (
        <>
          <OrderDecimalInput
            currency
            mobileLabel="Unit Price"
            aria-label={`Unit price for ${row.name}`}
            id={`order-price-${row.formId}`}
            value={row.unitPrice}
            aria-invalid={!!priceError(row.unitPrice)}
            aria-describedby={
              priceError(row.unitPrice) ? `order-price-error-${row.formId}` : undefined
            }
            onChange={(event) => form.updateLine(row.formId, 'unitPrice', event.target.value)}
          />
          {priceError(row.unitPrice) && (
            <p id={`order-price-error-${row.formId}`} className="mt-1 text-xs text-destructive">
              {priceError(row.unitPrice)}
            </p>
          )}
        </>
      ),
    },
    {
      id: 'discount',
      header: 'Discount',
      width: 112,
      cell: ({ row }) => (
        <OrderLineDiscount
          id={`order-discount-${row.formId}`}
          name={row.name}
          value={row.discount}
          line={row}
          compact
          onChange={(discount) => form.updateDiscount(row.formId, discount)}
        />
      ),
    },
    {
      id: 'subtotal',
      header: 'Line Total',
      width: 112,
      align: 'right',
      cell: ({ row }) => (
        <OrderLineAmounts
          name={row.name}
          line={{ ...row, ...discountFields(row.discount) }}
          saved={
            form.submission.savedOrder?.items?.[
              form.lines.findIndex((line) => line.formId === row.formId)
            ]
          }
        />
      ),
    },
    {
      id: 'remove',
      header: 'Remove',
      width: 56,
      align: 'center',
      className: 'order-entry-remove',
      headerClassName: 'order-entry-remove-header',
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
        savedDraft
          ? 'Confirm Sales Order'
          : draftOrder
            ? `Edit Draft ${draftOrder.orderNumber}`
            : 'Create Sales Order'
      }
      description="Choose a customer, add products, and review the order."
      submission={form.submission}
      hasUnsavedChanges={form.hasUnsavedChanges}
      busy={form.busy}
      error={form.error}
      errorFocusId={form.errorFocusId}
      itemCount={form.lines.length}
      submitDisabled={form.submitDisabled}
      readOnly={form.submitDisabled && !form.conflict}
      catalog={(returnToEditor) => (
        <OrderProductCatalog
          products={products}
          stockItems={stockItems}
          state={catalogState}
          busy={form.submission.locked || (form.submitDisabled && !form.conflict)}
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
          {form.conflict && (
            <Alert>
              <AlertDescription className="flex flex-col gap-3">
                {form.conflict.loading ? (
                  <p role="status">Loading the latest server version…</p>
                ) : form.conflict.error ? (
                  <>
                    <p>{form.conflict.error}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void form.fetchLatestDraft()}
                    >
                      Retry loading latest version
                    </Button>
                  </>
                ) : (
                  form.conflict.latest && (
                    <>
                      <details>
                        <summary className="cursor-pointer font-medium">
                          Review latest server values (revision {form.conflict.latest.revision})
                        </summary>
                        <dl className="mt-2 grid gap-2 text-sm">
                          <div>
                            <dt>Customer</dt>
                            <dd>
                              {clients.find(
                                (client) => client.id === form.conflict?.latest?.clientId,
                              )?.name ?? `Customer #${form.conflict.latest.clientId}`}
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>{form.conflict.latest.status}</dd>
                          </div>
                          <div>
                            <dt>Delivery address</dt>
                            <dd>{form.conflict.latest.deliveryAddress}</dd>
                          </div>
                          <div>
                            <dt>Expected date</dt>
                            <dd>{form.conflict.latest.expectedAt?.slice(0, 10) ?? 'Not set'}</dd>
                          </div>
                          <div>
                            <dt>Reference</dt>
                            <dd>{form.conflict.latest.externalReference || 'Not set'}</dd>
                          </div>
                          <div>
                            <dt>Notes</dt>
                            <dd className="whitespace-pre-wrap wrap-break-word">
                              {form.conflict.latest.notes || 'Not set'}
                            </dd>
                          </div>
                          {form.conflict.latest.items.map((item) => (
                            <div key={item.id}>
                              <dt>
                                {products.find((product) => product.id === item.inventoryItemId)
                                  ?.name ?? `Product #${item.inventoryItemId}`}
                              </dt>
                              <dd>
                                {item.quantity} × {formatOrderCurrency(item.unitPrice)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                      <p>
                        Your edits below remain unsaved. Reloading replaces them with the server
                        values.
                      </p>
                      <Button type="button" variant="outline" onClick={form.reloadLatestDraft}>
                        Reload latest draft and discard my edits
                      </Button>
                    </>
                  )
                )}
              </AlertDescription>
            </Alert>
          )}
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
              Discounts apply to each entire line. VAT is calculated after the discount.
            </p>
            <OrderItemsTable
              className="sales-order-items"
              data={form.lines}
              columns={columns}
              getRowKey={(line) => line.formId}
            />
          </section>
          <SalesOrderTotals form={form} />
          <SalesOrderAdditionalDetails form={form} />
        </>
      )}
    </OrderEntryDialog>
  )
}
