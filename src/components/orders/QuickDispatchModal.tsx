import { useNavigate } from 'react-router'
import { ScheduleDeliveryModal } from '@/components/deliveries/ScheduleDeliveryModal'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'

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
  const navigate = useNavigate()
  return (
    <ScheduleDeliveryModal
      open={open}
      preselectedOrderId={order.id}
      onClose={onClose}
      onScheduled={() => { onSuccess?.(); onClose(); navigate('/deliveries/runs') }}
    />
  )
}
