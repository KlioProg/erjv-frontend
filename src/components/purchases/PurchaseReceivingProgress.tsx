import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useMediaQuery } from '@/lib/use-media-query'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import { purchaseReceivingProgress } from '@/features/logistics/purchase-orders.presentation'
import { formatStockCents } from '@/features/logistics/stock-display'

export function PurchaseReceivingProgress({
  order,
  deliveries,
  products,
  isLoading,
  unavailable,
  onRetry,
  onNavigateToDeliveries,
}: {
  order: PurchaseOrderRecord
  deliveries: IncomingDeliveryRecord[]
  products: InventoryItemResponse[]
  isLoading: boolean
  unavailable: boolean
  onRetry: () => void
  onNavigateToDeliveries?: (purchaseOrderId: number) => void
}) {
  const desktop = useMediaQuery('(min-width: 40rem)')
  const progress = purchaseReceivingProgress(order, deliveries)
  const columns: ColumnDef<(typeof progress)[number]>[] = [
    {
      id: 'product',
      header: 'Product',
      width: desktop ? '40%' : '100%',
      cell: ({ row }) => {
        const product = products.find((product) => product.id === row.item.inventoryItemId)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <OverflowValue
              value={product?.name ?? `Product #${row.item.inventoryItemId}`}
              className="text-sm font-medium"
            />
            {product?.unit && <span className="text-xs text-muted-foreground">{product.unit}</span>}
            {!desktop && (
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                {(['ordered', 'received', 'remaining'] as const).map((key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs capitalize text-muted-foreground">{key}</dt>
                    <dd className="mt-1 tabular-nums">
                      <OverflowValue value={formatStockCents(row[key])} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )
      },
    },
    ...(['ordered', 'received', 'remaining'] as const).map((key) => ({
      id: key,
      header: key[0].toUpperCase() + key.slice(1),
      width: '20%',
      align: 'right' as const,
      cell: ({ row }: { row: (typeof progress)[number] }) => (
        <OverflowValue
          value={formatStockCents(row[key])}
          className="text-right text-sm tabular-nums"
        />
      ),
    })),
  ]
  return (
    <section
      aria-label="Receiving Progress"
      className="flex flex-col gap-3 border-t border-border pt-4"
    >
      <h2 className="text-sm font-semibold">Receiving Progress</h2>
      <p className="text-xs text-muted-foreground">
        Received quantities include completed incoming deliveries only. Scheduled shipments are not
        received stock.
      </p>
      {unavailable ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Receiving quantities could not be loaded.{' '}
            <Button type="button" variant="link" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <DataTable
            data={progress}
            columns={desktop ? columns : columns.slice(0, 1)}
            getRowKey={(row) => row.item.id}
            isLoading={isLoading}
            loadingMessage="Loading receiving quantities…"
            pagination={false}
            tableClassName="table-fixed w-full"
          />
          {!isLoading &&
            progress.some((row) => row.received === null || row.remaining === null) && (
              <p className="text-sm text-destructive">
                Some receiving quantities are unavailable. Check the linked incoming deliveries.
              </p>
            )}
        </>
      )}
      {onNavigateToDeliveries && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onNavigateToDeliveries(order.id)}
        >
          View Incoming Deliveries
        </Button>
      )}
    </section>
  )
}
