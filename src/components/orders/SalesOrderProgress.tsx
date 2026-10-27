import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useMediaQuery } from '@/lib/use-media-query'
import { salesDeliveryProgress } from '@/features/crm/sales-orders.presentation'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { DeliveryStatusBadge } from '@/components/deliveries/shared/DeliveryStatusBadge'

export function SalesOrderProgress({
  order,
  deliveries,
  products,
  isLoading,
  unavailable,
  onNavigateToDeliveries,
}: {
  order: SalesOrderRecord
  deliveries: OutgoingDeliveryRecord[]
  products: InventoryItemResponse[]
  isLoading: boolean
  unavailable: boolean
  onNavigateToDeliveries?: () => void
}) {
  const wide = useMediaQuery('(min-width: 40rem)')
  const progress = salesDeliveryProgress(order, deliveries)
  const linked = deliveries.filter((delivery) => delivery.salesOrderId === order.id)
  const columns: ColumnDef<(typeof progress)[number]>[] = [
    {
      id: 'product',
      header: 'Product',
      width: wide ? '40%' : '100%',
      cell: ({ row }) => {
        const product = products.find((product) => product.id === row.item.inventoryItemId)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <OverflowValue
              value={product?.name ?? `Product #${row.item.inventoryItemId}`}
              className="text-sm font-medium"
            />
            {product?.unit && <span className="text-xs text-muted-foreground">{product.unit}</span>}
            {!wide && (
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                {(['ordered', 'delivered', 'remaining'] as const).map((key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs capitalize text-muted-foreground">{key}</dt>
                    <dd className="mt-1">
                      <OverflowValue value={formatStockCents(row[key])} className="tabular-nums" />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )
      },
    },
    ...(['ordered', 'delivered', 'remaining'] as const).map((key) => ({
      id: key,
      header: key[0].toUpperCase() + key.slice(1),
      width: '20%',
      align: 'right' as const,
      cell: ({ row }: { row: (typeof progress)[number] }) => (
        <OverflowValue value={formatStockCents(row[key])} className="text-right tabular-nums" />
      ),
    })),
  ]
  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-4"
      aria-label="Fulfillment Progress"
    >
      <h2 className="text-sm font-semibold">Fulfillment Progress</h2>
      <p className="text-xs text-muted-foreground">
        Delivered quantities include completed outgoing deliveries only. Scheduling and dispatch are
        managed in Deliveries.
      </p>
      {unavailable ? (
        <Alert variant="destructive">
          <AlertDescription>
            Fulfillment quantities could not be loaded. Reopen this order to retry.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <DataTable
            data={progress}
            columns={wide ? columns : columns.slice(0, 1)}
            getRowKey={(row) => row.item.id}
            pagination={false}
            isLoading={isLoading}
            tableClassName="table-fixed w-full"
          />
          {!isLoading &&
            progress.some((row) => row.delivered === null || row.remaining === null) && (
              <p className="text-sm text-destructive">
                Some delivery quantities are unavailable. Check the linked outgoing deliveries.
              </p>
            )}
        </>
      )}
      {onNavigateToDeliveries && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={onNavigateToDeliveries}
        >
          View Outgoing Deliveries
        </Button>
      )}
      {!unavailable && linked.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm" aria-label="Linked Outgoing Deliveries">
          {linked.map((delivery) => (
            <li key={delivery.id} className="flex flex-wrap items-center gap-2">
              <span>{delivery.deliveryNumber}</span>
              <DeliveryStatusBadge status={delivery.status} showDot={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
