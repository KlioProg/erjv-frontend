import { useState } from 'react'
import { ScheduleDeliveryModal } from '@/components/deliveries/ScheduleDeliveryModal'
import { DispatchDeliveryModal } from '@/components/deliveries/shared/DispatchDeliveryModal'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

interface QuickDispatchModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  order: SalesOrderRecord
  vehicles: DeliveryVehicle[]
  employees: Employee[]
  warehouses: Warehouse[]
  stockItems: StockItem[]
}

export function QuickDispatchModal({ open, onClose, onSuccess, order }: QuickDispatchModalProps) {
  const [scheduled, setScheduled] = useState<OutgoingDeliveryRecord | null>(null)
  return scheduled ? (
    <DispatchDeliveryModal
      key={scheduled.id}
      delivery={scheduled}
      open={open}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  ) : (
    <ScheduleDeliveryModal
      open={open}
      preselectedOrderId={order.id}
      onClose={onClose}
      onScheduled={setScheduled}
    />
  )
}
