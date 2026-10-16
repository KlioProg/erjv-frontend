import { useState, useMemo } from 'react'
import { ManagementPage } from '@/components/ui/ManagementPage'
import { DashboardLayout, type NavItemKey } from '../layout/DashboardLayout'
import { InventoryHub } from '../inventory/InventoryHub'
import { WarehouseList } from '../operations/WarehouseList'
import { VehicleList } from '../operations/VehicleList'
import { ClientList } from '../crm/ClientList'
import { EmployeeList } from '../staffing/EmployeeList'
import { JobList } from '../staffing/JobList'
import { OrdersView } from '../orders/OrdersView'
import { DeliveriesHub } from '../deliveries/DeliveriesHub'
import { PurchasesView } from '../purchases/PurchasesView'
import { UserRolesList } from '../staffing/UserRolesList'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryFocusTarget } from '@/features/logistics/stock-warnings'

export function MainDashboard() {
  const [currentTab, setCurrentTab] = useState<NavItemKey>('inventory')
  const [warehouseToOpen, setWarehouseToOpen] = useState<number | null>(null)
  const [deliveryPurchaseOrderId, setDeliveryPurchaseOrderId] = useState<number | undefined>()
  const [deliverySalesOrderId, setDeliverySalesOrderId] = useState<number | undefined>()
  const [arrangeDelivery, setArrangeDelivery] = useState(false)
  const [inventoryTarget, setInventoryTarget] = useState<
    (InventoryFocusTarget & { requestId: number }) | undefined
  >()
  const { isStaff } = useAuth()

  const { data: warehouses = [] } = useWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const { data: products = [] } = useProducts()
  const totalStockUnits = useMemo(
    () => stockItems.reduce((acc, s) => acc + parseFloat(s.quantity || '0'), 0),
    [stockItems],
  )

  const isOperationsTab = currentTab === 'warehouses'

  const isStaffingTab =
    currentTab === 'employees' || currentTab === 'jobs' || currentTab === 'users'

  // Safety fallback if staff clicks restricted tab
  const effectiveTab = isStaff && isStaffingTab ? 'inventory' : currentTab

  const summary = isOperationsTab
    ? [
        {
          label: 'Warehouse Locations',
          value: <> {warehouses.length} </>,
          hint: 'Active facilities & storage hubs',
        },
        {
          label: 'Total Stored Units',
          value: <> {totalStockUnits.toLocaleString()} units </>,
          hint: 'Inventory across storage hubs',
        },
        {
          label: 'Catalog Products',
          value: <> {products.length} </>,
          hint: 'Active product catalog items',
        },
      ]
    : []

  return (
    <DashboardLayout
      currentTab={effectiveTab}
      onOpenInventory={(target) => {
        setInventoryTarget((previous) => ({ ...target, requestId: (previous?.requestId ?? 0) + 1 }))
        setCurrentTab('inventory')
      }}
      onSelectTab={(tab) => {
        setInventoryTarget(undefined)
        setWarehouseToOpen(null)
        setDeliverySalesOrderId(undefined)
        setArrangeDelivery(false)
        setDeliveryPurchaseOrderId(undefined)
        setCurrentTab(tab)
      }}
    >
      <ManagementPage summary={summary}>
        {effectiveTab === 'inventory' && (
          <InventoryHub
            key={inventoryTarget?.requestId ?? 'browse'}
            focusTarget={inventoryTarget}
            onOpenWarehouse={(id) => {
              setWarehouseToOpen(id)
              setCurrentTab('warehouses')
            }}
          />
        )}
        {effectiveTab === 'warehouses' && (
          <WarehouseList key={warehouseToOpen ?? 'list'} initialWarehouseId={warehouseToOpen} />
        )}
        {effectiveTab === 'fleet' && <VehicleList />}
        {['deliveries', 'incoming-deliveries', 'outgoing-deliveries', 'delivery-history'].includes(
          effectiveTab,
        ) && (
          <DeliveriesHub
            key={`${effectiveTab}-${deliveryPurchaseOrderId || deliverySalesOrderId || 'all'}`}
            initialTab={
              effectiveTab === 'incoming-deliveries'
                ? 'incoming'
                : effectiveTab === 'delivery-history'
                  ? 'history'
                  : 'outgoing'
            }
            purchaseOrderId={deliveryPurchaseOrderId}
            salesOrderId={deliverySalesOrderId}
            arrangeOrder={arrangeDelivery}
          />
        )}
        {(effectiveTab === 'purchases' || effectiveTab === 'suppliers') && (
          <PurchasesView
            key={effectiveTab}
            section={effectiveTab === 'suppliers' ? 'suppliers' : 'orders'}
            onNavigateToDeliveries={(purchaseOrderId, arrange) => {
              setDeliveryPurchaseOrderId(purchaseOrderId)
              setDeliverySalesOrderId(undefined)
              setArrangeDelivery(!!arrange)
              setCurrentTab('incoming-deliveries')
            }}
          />
        )}
        {effectiveTab === 'orders' && (
          <OrdersView
            onNavigateToPurchases={() => setCurrentTab('purchases')}
            onNavigateToDeliveries={(tab, salesOrderId, arrange) => {
              setDeliveryPurchaseOrderId(undefined)
              setDeliverySalesOrderId(salesOrderId)
              setArrangeDelivery(!!arrange)
              setCurrentTab(
                tab === 'history'
                  ? 'delivery-history'
                  : tab === 'incoming'
                    ? 'incoming-deliveries'
                    : 'outgoing-deliveries',
              )
            }}
            onNavigateToInventory={() => setCurrentTab('inventory')}
          />
        )}
        {effectiveTab === 'clients' && <ClientList />}
        {effectiveTab === 'employees' && <EmployeeList />}
        {effectiveTab === 'jobs' && <JobList />}
        {effectiveTab === 'users' && <UserRolesList />}
      </ManagementPage>
    </DashboardLayout>
  )
}
