import { XCircle } from 'lucide-react'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'

export function SalesOrderCancelModal({
  order,
  onClose,
  onConfirm,
}: {
  order: SalesOrderRecord
  onClose: () => void
  onConfirm: (id: number) => Promise<unknown>
}) {
  return (
    <ConfirmDeleteModal
      open
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm(order.id)
      }}
      title="Cancel Sales Order"
      description="Cancel this sales order? Physical stock will not change. Orders with active deliveries or stock movements cannot be cancelled."
      itemName={order.orderNumber}
      confirmText="Cancel Order"
      cancelText="Keep Order"
      icon={<XCircle className="size-6" />}
    />
  )
}
