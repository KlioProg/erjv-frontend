import { useMemo, useState, type ReactNode } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router'
import { ManagementPage } from '@/components/ui/ManagementPage'
import { DashboardLayout } from '../layout/DashboardLayout'
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
import {
  isNavItemKey,
  ROUTES,
  routeForScreen,
  screenFromPath,
  warehouseDetailsPath,
  type NavItemKey,
} from '@/routes'

type DashboardSummary = { label: string; value: ReactNode; hint: string }[]

export type DashboardOutletContext = {
  deliveryPurchaseOrderId?: number
  deliverySalesOrderId?: number
  arrangeDelivery: boolean
  inventoryTarget?: InventoryFocusTarget & { requestId: number }
  summary: DashboardSummary
  onOpenInventory: (target: InventoryFocusTarget) => void
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

  const requestedScreen = screenFromPath(location.pathname)
  const isStaffingScreen =
    requestedScreen === 'employees' || requestedScreen === 'jobs' || requestedScreen === 'users'
  const currentTab = isStaff && isStaffingScreen ? 'inventory' : requestedScreen

  const summary =
    currentTab === 'warehouses'
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

  const clearNavigationContext = () => {
    setInventoryTarget(undefined)
    setDeliverySalesOrderId(undefined)
    setArrangeDelivery(false)
    setDeliveryPurchaseOrderId(undefined)
  }

  const navigateToScreen = (screen: NavItemKey) => navigate(routeForScreen(screen))

  const onOpenInventory = (target: InventoryFocusTarget) => {
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
    summary,
    onOpenInventory,
    onOpenWarehouse: (id) => navigate(warehouseDetailsPath(id)),
    onNavigateToPurchases: () => navigateToScreen('purchases'),
    onNavigateFromPurchaseToDeliveries,
    onNavigateFromSalesOrderToDeliveries,
    onNavigateToInventory: () => navigateToScreen('inventory'),
  }

  return (
    <DashboardLayout
      currentTab={currentTab}
      onSelectTab={clearNavigationContext}
      onOpenInventory={onOpenInventory}
    >
      <Outlet context={outletContext} />
    </DashboardLayout>
  )
}

function useDashboardContext() {
  return useOutletContext<DashboardOutletContext>()
}

export function DashboardScreen({ screen }: { screen: NavItemKey }) {
  const context = useDashboardContext()
  const { isStaff } = useAuth()
  const isStaffingScreen = screen === 'employees' || screen === 'jobs' || screen === 'users'

  if (isStaff && isStaffingScreen) {
    return <Navigate replace to={ROUTES.default} />
  }

  return (
    <ManagementPage summary={screen === 'warehouses' ? context.summary : []}>
      {screen === 'inventory' && (
        <InventoryHub
          key={context.inventoryTarget?.requestId ?? 'browse'}
          focusTarget={context.inventoryTarget}
          onOpenWarehouse={context.onOpenWarehouse}
        />
      )}
      {screen === 'warehouses' && <WarehouseList onOpenWarehouse={context.onOpenWarehouse} />}
      {screen === 'fleet' && <VehicleList />}
      {['deliveries', 'incoming-deliveries', 'outgoing-deliveries', 'delivery-history'].includes(
        screen,
      ) && (
        <DeliveriesHub
          key={`${screen}-${context.deliveryPurchaseOrderId || context.deliverySalesOrderId || 'all'}`}
          initialTab={
            screen === 'incoming-deliveries'
              ? 'incoming'
              : screen === 'delivery-history'
                ? 'history'
                : 'outgoing'
          }
          purchaseOrderId={context.deliveryPurchaseOrderId}
          salesOrderId={context.deliverySalesOrderId}
          arrangeOrder={context.arrangeDelivery}
        />
      )}
      {(screen === 'purchases' || screen === 'suppliers') && (
        <PurchasesView
          key={screen}
          section={screen === 'suppliers' ? 'suppliers' : 'orders'}
          onNavigateToDeliveries={context.onNavigateFromPurchaseToDeliveries}
        />
      )}
      {screen === 'orders' && (
        <OrdersView
          onNavigateToPurchases={context.onNavigateToPurchases}
          onNavigateToDeliveries={context.onNavigateFromSalesOrderToDeliveries}
          onNavigateToInventory={context.onNavigateToInventory}
        />
      )}
      {screen === 'clients' && <ClientList />}
      {screen === 'employees' && <EmployeeList />}
      {screen === 'jobs' && <JobList />}
      {screen === 'users' && <UserRolesList />}
    </ManagementPage>
  )
}

export function LegacyDashboardScreen() {
  const { screen } = useParams()
  if (!isNavItemKey(screen)) return <DashboardNotFound />
  const path = routeForScreen(screen)
  if (!path.startsWith(`${ROUTES.legacyPrefix}/`)) return <Navigate replace to={path} />
  return <DashboardScreen screen={screen} />
}

export function DashboardNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
      <Link className="text-sm font-medium underline underline-offset-4" to={ROUTES.default}>
        Go to Inventory
      </Link>
    </div>
  )
}
