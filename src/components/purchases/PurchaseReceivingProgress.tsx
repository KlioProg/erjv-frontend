import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useMediaQuery } from '@/lib/use-media-query'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import { purchaseReceivingProgress } from '@/features/logistics/purchase-orders.presentation'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

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
  const progress = purchaseReceivingProgress(order, deliveries).map((row) => {
    const lines = deliveries
      .filter(
        (delivery) => delivery.purchaseOrderId === order.id && delivery.status === 'COMPLETED',
      )
      .flatMap((delivery) => delivery.items ?? [])
      .filter((item) => item.purchaseOrderItemId === row.item.id)
    const sumRecorded = (field: 'receivedQuantity' | 'damagedQuantity') => {
      if (row.received === null) return null
      let total = 0n
      for (const line of lines) {
        const value = parseStockCents(line[field])
        if (value === null) return null
        total += value
      }
      return total
    }
    return {
      ...row,
      physicalReceived: sumRecorded('receivedQuantity'),
      damaged: sumRecorded('damagedQuantity'),
    }
  })
  const quantities = ['ordered', 'physicalReceived', 'remaining'] as const
  const hasReceipts = deliveries.some(
    (delivery) => delivery.purchaseOrderId === order.id && delivery.status === 'COMPLETED',
  )
  const quantityLabels = {
    ordered: 'Ordered',
    physicalReceived: 'Received',
    received: 'Accepted',
    damaged: 'Damaged',
    remaining: 'Remaining',
  }
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
                {quantities.map((key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{quantityLabels[key]}</dt>
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
    ...quantities.map((key) => ({
      id: key,
      header: quantityLabels[key],
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
      <h2 className="text-sm font-semibold">Ordered items</h2>
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
          {!isLoading && hasReceipts && (
            <details>
              <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Accepted and damaged quantities
              </summary>
              <p className="my-3 text-xs text-muted-foreground">
                Damaged goods do not reduce the remaining quantity.
              </p>
              <DataTable
                data={progress}
                columns={[
                  {
                    id: 'product',
                    header: 'Product',
                    cell: ({ row }) => (
                      <OverflowValue
                        value={
                          products.find((product) => product.id === row.item.inventoryItemId)
                            ?.name ?? `Product #${row.item.inventoryItemId}`
                        }
                      />
                    ),
                  },
                  ...(['received', 'damaged'] as const).map((key) => ({
                    id: key,
                    header: quantityLabels[key],
                    align: 'right' as const,
                    cell: ({ row }: { row: (typeof progress)[number] }) => (
                      <OverflowValue
                        value={formatStockCents(row[key])}
                        className="text-right tabular-nums"
                      />
                    ),
                  })),
                ]}
                getRowKey={(row) => row.item.id}
                pagination={false}
                tableClassName="min-w-[360px] table-fixed tabular-nums"
              />
            </details>
          )}
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
