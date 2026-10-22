import { StatusBadge } from '@/components/ui/StatusBadge'
import { PURCHASE_ORDER_STATUS } from '@/features/logistics/purchase-orders.presentation'
import type { PurchaseOrderStatus } from '@/features/logistics/purchase-orders.types'

export function PurchaseOrderStatusBadge({ status }: { status: string }) {
  const config = PURCHASE_ORDER_STATUS[status as PurchaseOrderStatus]
  return <StatusBadge label={config?.label ?? status} tone={config?.tone} />
}
