import {
  OrderDetailFooter,
  type OrderDetailAction,
} from '@/components/orders/shared/OrderDetailFooter'
import { formatProductUnit } from '@/lib/product-unit'
import { useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getErrorMessage } from '@/lib/api-client'
import {
  formatPurchaseMoney,
  purchaseDecimal,
  storedPurchaseTotal,
} from '@/features/logistics/purchase-pricing'
import { PurchaseReceivingProgress } from './PurchaseReceivingProgress'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getPurchaseOrderDetailProgress } from '@/features/logistics/purchase-orders.presentation'
import {
  MovementDetailHeader,
  MovementDetailFields,
} from '@/components/deliveries/shared/MovementDetailLayout'
import type {
  PurchaseOrderRecord,
  PurchaseOrderItemRecord,
} from '@/features/logistics/purchase-orders.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { InventoryItemResponse } from '@/features/products/products.types'

type Props = {
  order: PurchaseOrderRecord
  supplier?: Supplier
  products: InventoryItemResponse[]
  warehouses: Warehouse[]
  incomingDeliveries: IncomingDeliveryRecord[]
  receivingLoading?: boolean
  receivingUnavailable?: boolean
  onRetryReceiving?: () => void
  statusBadge?: ReactNode
  onClose: () => void
  onConfirm?: () => Promise<unknown> | void
  onExportReceipt?: () => void
  confirming?: boolean
  onEdit?: () => void
  onCancel?: () => void
  recordBusy?: boolean
  recordUnavailable?: boolean
  canScheduleArrival?: boolean
  onNavigateToDeliveries?: (purchaseOrderId?: number, arrange?: boolean) => void
}

const currency = (value: string | number) => formatPurchaseMoney(purchaseDecimal(String(value)))

export function PurchaseOrderDetailModal({
  order,
  supplier,
  products,
  warehouses,
  incomingDeliveries,
  receivingLoading = false,
  receivingUnavailable = false,
  onRetryReceiving = () => {},
  onClose,
  onConfirm,
  onExportReceipt,
  confirming,
  onNavigateToDeliveries,
  onEdit,
  onCancel,
  recordBusy = false,
  recordUnavailable = false,
  canScheduleArrival = false,
}: Props) {
  const [confirmationError, setConfirmationError] = useState('')
  const [pending, setPending] = useState(false)
  const confirmationLock = useRef(false)
  const launcherRef = useRef<HTMLElement | null>(null)
  const busy = confirming || pending
  const blocked = busy || recordBusy || recordUnavailable
  const progress = getPurchaseOrderDetailProgress(
    order,
    incomingDeliveries,
    !receivingLoading && !receivingUnavailable,
  )
  async function confirm() {
    if (confirmationLock.current || blocked || !onConfirm) return
    if (order.supplierId == null || !order.items.length) {
      setConfirmationError('Confirmation requires a supplier and at least one item. Use More Actions to edit the draft.')
      return
    }
    confirmationLock.current = true
    setPending(true)
    setConfirmationError('')
    try {
      await onConfirm()
    } catch (error) {
      setConfirmationError(getErrorMessage(error))
    } finally {
      confirmationLock.current = false
      setPending(false)
    }
  }
  const linkedDeliveries = incomingDeliveries.filter(
    (delivery) => delivery.purchaseOrderId === order.id && delivery.status !== 'CANCELLED',
  )
  const warehouseNames = [
    ...new Set(
      linkedDeliveries.map(
        (delivery) =>
          warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ||
          `Warehouse #${delivery.warehouseId}`,
      ),
    ),
  ]
  const columns: ColumnDef<PurchaseOrderItemRecord>[] = [
    {
      accessorKey: 'inventoryItemId',
      header: 'Product / Material',
      cell: ({ row }) => (
        <OverflowValue
          value={
            products.find((product) => product.id === row.inventoryItemId)?.name ||
            `Item #${row.inventoryItemId}`
          }
        />
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      align: 'right',
      cell: ({ row }) => (
        <span>
          {row.quantity}{' '}
          {formatProductUnit(products.find((product) => product.id === row.inventoryItemId)?.unit)}
        </span>
      ),
    },
    {
      accessorKey: 'unitPrice',
      header: 'Unit Price',
      align: 'right',
      cell: ({ row }) => currency(row.unitPrice),
    },
    {
      accessorKey: 'discountAmount',
      header: 'Discount',
      align: 'right',
      cell: ({ row }) => currency(row.discountAmount),
    },
    {
      accessorKey: 'taxAmount',
      header: 'Tax',
      align: 'right',
      cell: ({ row }) => currency(row.taxAmount),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Amount',
      align: 'right',
      cell: ({ row }) => currency(row.totalAmount),
    },
  ]

  const secondaryActions: OrderDetailAction[] = []
  if (onEdit && order.status === 'DRAFT')
    secondaryActions.push({ label: 'Edit Draft', disabled: blocked, onSelect: onEdit })
  if (onNavigateToDeliveries)
    secondaryActions.push({
      label: 'View Incoming Deliveries',
      onSelect: () => onNavigateToDeliveries(order.id),
    })
  if (onExportReceipt && !['DRAFT', 'CANCELLED'].includes(order.status))
    secondaryActions.push({
      label: 'Print / Download Purchase Order',
      disabled: blocked,
      onSelect: onExportReceipt,
    })
  if (onCancel && ['DRAFT', 'CONFIRMED'].includes(order.status))
    secondaryActions.push({
      label: 'Cancel Order',
      disabled: blocked,
      destructive: true,
      onSelect: onCancel,
    })
  const primaryAction: OrderDetailAction | undefined =
    onConfirm && order.status === 'DRAFT'
      ? {
          label: busy ? 'Confirming...' : 'Confirm Purchase Order',
          disabled: blocked,
          onSelect: () => void confirm(),
        }
      : canScheduleArrival &&
          onNavigateToDeliveries &&
          ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status)
        ? {
            label: 'Schedule Arrival',
            disabled: blocked,
            onSelect: () => onNavigateToDeliveries(order.id, true),
          }
        : undefined
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        closeDisabled={busy}
        onOpenAutoFocus={() => {
          const target = document.activeElement
          if (target instanceof HTMLElement && !target.closest('[role="dialog"], [role="menu"]'))
            launcherRef.current = target
        }}
        onCloseAutoFocus={(event) => {
          if (launcherRef.current?.isConnected) {
            event.preventDefault()
            launcherRef.current.focus({ preventScroll: true })
          }
        }}
        className="flex h-auto min-h-0 max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-4xl sm:p-5"
      >
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2">
          <MovementDetailHeader
            title={order.orderNumber}
            description={
              'Purchase order · ' +
              new Date(order.orderedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
            }
            status={<StatusBadge label={progress.label} tone={progress.tone} />}
          />
          <LifecycleProgress label="Purchase order lifecycle" milestones={progress.milestones} />
          <p className="text-sm text-muted-foreground">{progress.explanation}</p>
        </div>
        <div
          role="region"
          aria-label="Purchase order content"
          tabIndex={0}
          className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {recordUnavailable && (
            <Alert variant="destructive">
              <AlertDescription>
                The latest purchase order could not be loaded. Reopen this record before making
                changes.
              </AlertDescription>
            </Alert>
          )}
          <MovementDetailFields
            fields={[
              {
                label: 'Supplier',
                value:
                  supplier?.name ||
                  (order.supplierId == null
                    ? 'No supplier assigned'
                    : 'Supplier #' + order.supplierId),
              },
              ...(order.expectedAt
                ? [
                    {
                      label: 'Expected Date',
                      value: new Date(order.expectedAt).toLocaleDateString('en-PH', {
                        timeZone: 'Asia/Manila',
                      }),
                    },
                  ]
                : []),
              ...(warehouseNames.length
                ? [{ label: 'Destination Warehouse', value: warehouseNames.join(', ') }]
                : []),
              ...(order.externalReference
                ? [{ label: 'Supplier Reference', value: order.externalReference }]
                : []),
            ]}
          />
          {order.notes && (
            <section>
              <h2 className="text-sm font-semibold">Notes</h2>
              <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
            </section>
          )}
          <PurchaseReceivingProgress
            order={order}
            deliveries={incomingDeliveries}
            products={products}
            isLoading={receivingLoading}
            unavailable={receivingUnavailable}
            onRetry={onRetryReceiving}
          />
          <details>
            <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Prices and totals
            </summary>
            <div className="mt-3">
              <DataTable
                data={order.items || []}
                columns={columns}
                pagination={false}
                tableClassName="min-w-[640px] table-fixed tabular-nums"
              />
            </div>
          </details>
          <p className="text-right text-sm font-semibold tabular-nums">
            Total: {formatPurchaseMoney(storedPurchaseTotal(order.items || []))}
          </p>
          {confirmationError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{confirmationError}</AlertDescription>
            </Alert>
          )}
          {!receivingLoading && !receivingUnavailable && linkedDeliveries.length > 0 && (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Incoming Deliveries:{' '}
              {linkedDeliveries.map((delivery) => delivery.deliveryNumber).join(', ')}
            </p>
          )}
        </div>
        <OrderDetailFooter
          label="Purchase order actions"
          secondaryActions={secondaryActions}
          primaryAction={primaryAction}
          onClose={onClose}
          busy={busy}
        />
      </DialogContent>
    </Dialog>
  )
}
