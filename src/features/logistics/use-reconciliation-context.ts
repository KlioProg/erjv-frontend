import { useQuery } from '@tanstack/react-query'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { fetchClientByIdApi } from '@/features/crm/clients.api'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import { fetchWarehouseByIdApi } from './warehouses.api'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'

export function useReconciliationContext(
  delivery: OutgoingDeliveryRecord | null | undefined,
  order: SalesOrderRecord | null | undefined,
) {
  const productIds = [...new Set((delivery?.items ?? []).flatMap((item) => {
    const line = order?.items.find((line) => line.id === item.salesOrderItemId)
    return line ? [line.inventoryItemId] : []
  }))].sort((left, right) => left - right)
  const warehouseIds = [...new Set((delivery?.items ?? []).flatMap((item) => {
    const id = delivery?.warehouseId ?? item.stockItem?.warehouseId
    return id ? [id] : []
  }))].sort((left, right) => left - right)
  const products = useQuery({
    queryKey: ['products', 'reconciliation', productIds],
    enabled: !!order && productIds.length > 0,
    queryFn: async () => (await Promise.all(productIds.map(fetchProductByIdApi))).filter((product) => product !== null),
  })
  const warehouses = useQuery({
    queryKey: ['warehouses', 'reconciliation', warehouseIds],
    enabled: warehouseIds.length > 0,
    queryFn: async () => (await Promise.all(warehouseIds.map(fetchWarehouseByIdApi))).filter((warehouse) => warehouse !== null),
  })
  const clients = useQuery({
    queryKey: ['clients', 'reconciliation', order?.clientId],
    enabled: !!order?.clientId,
    queryFn: async () => {
      const client = await fetchClientByIdApi(order!.clientId)
      return client ? [client] : []
    },
  })
  return { products, warehouses, clients }
}
