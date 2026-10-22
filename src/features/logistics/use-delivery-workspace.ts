import { useIncomingDeliveries } from './incoming-deliveries.hooks'
import { useOutgoingDeliveries } from './outgoing-deliveries.hooks'
import { useAllDeliveryVehicles } from './delivery-vehicles.hooks'
import { useSalesOrders } from '../crm/sales-orders.hooks'
import { useClients } from '../crm/clients.hooks'
import { usePurchaseOrders } from './purchase-orders.hooks'
import { useSuppliers } from './suppliers.hooks'
import { useAllWarehouses } from './warehouses.hooks'
import { useAllProducts } from '../products/products.hooks'
import { useEmployees } from '../staffing/staffing.hooks'
import { useStockItems } from './stock-items.hooks'
import { buildDeliveryRows } from './delivery-workflow'

export function useDeliveryWorkspace() {
  const incomingQuery = useIncomingDeliveries()
  const outgoingQuery = useOutgoingDeliveries()
  const purchaseQuery = usePurchaseOrders()
  const salesQuery = useSalesOrders()
  const supplierQuery = useSuppliers({ includeInactive: 'true' })
  const clientQuery = useClients({ includeInactive: 'true' })
  const warehouseQuery = useAllWarehouses()
  const vehicleQuery = useAllDeliveryVehicles()
  const employeeQuery = useEmployees({ includeInactive: 'true' })
  const productQuery = useAllProducts()
  const stockQuery = useStockItems()
  const data = {
    incoming: incomingQuery.data ?? [],
    outgoing: outgoingQuery.data ?? [],
    purchaseOrders: purchaseQuery.data ?? [],
    salesOrders: salesQuery.data ?? [],
    suppliers: supplierQuery.data ?? [],
    clients: clientQuery.data ?? [],
    warehouses: warehouseQuery.data ?? [],
    vehicles: vehicleQuery.data ?? [],
    employees: employeeQuery.data ?? [],
    products: productQuery.data ?? [],
    stockItems: stockQuery.data ?? [],
  }
  return {
    ...data,
    rows: buildDeliveryRows(data),
    incomingQuery,
    outgoingQuery,
    purchaseQuery,
    salesQuery,
    warehouseQuery,
    productQuery,
    stockQuery,
  }
}
