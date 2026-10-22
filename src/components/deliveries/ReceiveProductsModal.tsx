import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCompleteIncomingDelivery } from '@/features/logistics/incoming-deliveries.hooks'
import { useDeliveryWorkspace } from '@/features/logistics/use-delivery-workspace'
import { committedIncoming } from '@/features/logistics/delivery-quantities'
import { parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/AuthContext'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import { DeliveryItemsTable } from './shared/DeliveryItemsTable'

export function ReceiveProductsModal({
  delivery,
  onClose,
}: {
  delivery: IncomingDeliveryRecord
  onClose: () => void
}) {
  const workspace = useDeliveryWorkspace()
  const complete = useCompleteIncomingDelivery()
  const { canManageOperations } = useAuth()
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const order = workspace.purchaseOrders.find((order) => order.id === delivery.purchaseOrderId)
  const unavailable = workspace.incomingQuery.isError || workspace.purchaseQuery.isError
  const loading = workspace.incomingQuery.isLoading || workspace.purchaseQuery.isLoading
  const rows = delivery.items.map((item) => {
    const line = order?.items.find((line) => line.id === item.purchaseOrderItemId)
    const product = workspace.products.find((product) => product.id === line?.inventoryItemId)
    const ordered = parseStockCents(line?.quantity)
    const committed = committedIncoming(item.purchaseOrderItemId, workspace.incoming, delivery.id)
    const available =
      ordered !== null && committed !== null && committed <= ordered ? ordered - committed : null
    return {
      id: item.purchaseOrderItemId,
      product: product?.name ?? `Order Item #${item.purchaseOrderItemId}`,
      unit: product?.unit,
      available,
      quantity: quantities[item.purchaseOrderItemId] ?? item.receivedQuantity,
    }
  })
  return (
    <Dialog open onOpenChange={(open) => !open && !complete.isPending && onClose()}>
      <DialogContent className="flex max-h-[90svh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle>Receive {delivery.deliveryNumber}</DialogTitle>
          <DialogDescription>
            Confirm actual quantities received at{' '}
            {workspace.warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)
              ?.name ?? `Warehouse #${delivery.warehouseId}`}
            . Only these quantities will be added to stock.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault()
            setError('')
            try {
              if (!canManageOperations || unavailable || loading || delivery.status !== 'SCHEDULED')
                throw Error('Receiving is unavailable. Reload the delivery and try again.')
              const actual = rows.map((row) => ({ row, quantity: parseStockCents(row.quantity) }))
              if (
                actual.some(
                  ({ row, quantity }) =>
                    quantity === null || row.available === null || quantity > row.available,
                ) ||
                !actual.some(({ quantity }) => quantity !== null && quantity > 0n)
              )
                throw Error(
                  'Confirm valid quantities within the outstanding balance. At least one product must be received; use zero for products that did not arrive.',
                )
              await complete.mutateAsync({
                id: delivery.id,
                items: actual.map(({ row, quantity }) => ({
                  purchaseOrderItemId: row.id,
                  receivedQuantity: decimalString(quantity!),
                })),
              })
              onClose()
            } catch (error) {
              setError(getErrorMessage(error))
            }
          }}
        >
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
            {(error || unavailable) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error || 'Receiving quantities could not be loaded. Close and retry.'}
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">
              Enter zero for products that did not arrive. The outstanding quantity remains
              available for a later shipment.
            </p>
            <DeliveryItemsTable
              rows={rows}
              quantityLabel="Actual received"
              onChange={(id, quantity) =>
                setQuantities((current) => ({ ...current, [id]: quantity }))
              }
              disabled={complete.isPending || loading || unavailable}
            />
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={complete.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={complete.isPending || loading || unavailable || !canManageOperations}
            >
              {complete.isPending ? 'Receiving…' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
