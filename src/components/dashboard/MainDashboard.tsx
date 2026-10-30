import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router'
import { ManagementPage } from '@/components/ui/ManagementPage'
import { DashboardLayout } from '../layout/DashboardLayout'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useProducts } from '@/features/products/products.hooks'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { routeForScreen, screenFromPath, warehouseDetailsPath, type NavItemKey } from '@/routes'

export type DashboardOutletContext = {
  deliveryPurchaseOrderId?: number
  deliverySalesOrderId?: number
  arrangeDelivery: boolean
  inventoryTarget?: InventoryNavigationTarget & { requestId: number }
  onOpenWarehouse: (id: number) => void
  onNavigateToPurchases: () => void
  onNavigateFromPurchaseToDeliveries: (purchaseOrderId?: number, arrange?: boolean) => void
  onNavigateFromSalesOrderToDeliveries: (
    tab?: 'schedule' | 'status' | 'completed' | 'incoming' | 'outgoing' | 'history',
    salesOrderId?: number,
    arrange?: boolean,
  ) => void
  onNavigateToInventory: () => void
}

export function MainDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(location.pathname)
  useLayoutEffect(() => {
    // Leave POP navigation to the browser's native scroll restoration.
    if (previousPath.current !== location.pathname && navigationType !== 'POP') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    previousPath.current = location.pathname
  }, [location.pathname, navigationType])
  const [deliveryPurchaseOrderId, setDeliveryPurchaseOrderId] = useState<number | undefined>()
  const [deliverySalesOrderId, setDeliverySalesOrderId] = useState<number | undefined>()
  const [arrangeDelivery, setArrangeDelivery] = useState(false)
  const [inventoryTarget, setInventoryTarget] = useState<
    (InventoryNavigationTarget & { requestId: number }) | undefined
  >()

  const { data: warehouses = [] } = useWarehouses()
  const stockQuery = useStockItems()
  const stockItems = stockQuery.data
  const { data: products = [] } = useProducts()


  const currentScreen = screenFromPath(location.pathname)

  const summary =
    currentScreen === 'warehouses'
      ? [
          {
            label: 'Warehouse Locations',
            value: <> {warehouses.length} </>,
            hint: 'Active facilities & storage hubs',
          },
          {
            label: 'Loaded Stock Records',
            value: <> {stockQuery.isPending || stockQuery.isError ? '\u2014' : stockItems.length.toLocaleString()} </>,
            hint: 'Product allocations across storage hubs',
          },
          {
            label: 'Catalog Products',
            value: <> {products.length} </>,
            hint: 'Active product catalog items',
          },
        ]
      : []

  const clearNavigationContext = () => {
    setInventoryTarget(undefined)
    setDeliverySalesOrderId(undefined)
    setArrangeDelivery(false)
    setDeliveryPurchaseOrderId(undefined)
  }

  const navigateToScreen = (screen: NavItemKey) => navigate(routeForScreen(screen))

  const onOpenInventory = (target: InventoryNavigationTarget) => {
    setInventoryTarget((previous) => ({ ...target, requestId: (previous?.requestId ?? 0) + 1 }))
    navigateToScreen('inventory')
  }

  const onNavigateFromPurchaseToDeliveries = (purchaseOrderId?: number, arrange = false) => {
    setDeliveryPurchaseOrderId(purchaseOrderId)
    setDeliverySalesOrderId(undefined)
    setArrangeDelivery(arrange)
    navigateToScreen('incoming-deliveries')
  }

  const onNavigateFromSalesOrderToDeliveries: DashboardOutletContext['onNavigateFromSalesOrderToDeliveries'] =
    (tab, salesOrderId, arrange = false) => {
      setDeliveryPurchaseOrderId(undefined)
      setDeliverySalesOrderId(salesOrderId)
      setArrangeDelivery(arrange)
      navigateToScreen(
        tab === 'history'
          ? 'delivery-history'
          : tab === 'incoming'
            ? 'incoming-deliveries'
            : 'outgoing-deliveries',
      )
    }

  const outletContext: DashboardOutletContext = {
    deliveryPurchaseOrderId,
    deliverySalesOrderId,
    arrangeDelivery,
    inventoryTarget,
    onOpenWarehouse: (id) => navigate(warehouseDetailsPath(id)),
    onNavigateToPurchases: () => navigateToScreen('purchases'),
    onNavigateFromPurchaseToDeliveries,
    onNavigateFromSalesOrderToDeliveries,
    onNavigateToInventory: () => navigateToScreen('inventory'),
  }

  return (
    <DashboardLayout
      currentScreen={currentScreen}
      onNavigate={clearNavigationContext}
      onOpenInventory={onOpenInventory}
    >
      <ManagementPage summary={summary}>
        <Outlet context={outletContext} />
      </ManagementPage>
    </DashboardLayout>
  )
}
