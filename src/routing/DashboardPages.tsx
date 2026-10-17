import { Link, Navigate, Outlet, useOutletContext, useParams } from 'react-router'
import type { DashboardOutletContext } from '@/components/dashboard/MainDashboard'
import { InventoryHub } from '@/components/inventory/InventoryHub'
import { WarehouseList } from '@/components/operations/WarehouseList'
import { OrdersView } from '@/components/orders/OrdersView'
import { PurchasesView, type PurchaseSection } from '@/components/purchases/PurchasesView'
import { DeliveriesHub } from '@/components/deliveries/DeliveriesHub'
import type { DeliveryView } from '@/features/logistics/delivery-workflow'
import { useAuth } from '@/features/auth/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isNavItemKey, ROUTES, routeForScreen } from '@/routes'

export function InventoryRoute() {
  const context = useOutletContext<DashboardOutletContext>()
  return (
    <InventoryHub
      key={context.inventoryTarget?.requestId ?? 'browse'}
      focusTarget={context.inventoryTarget}
      onOpenWarehouse={context.onOpenWarehouse}
    />
  )
}

export function WarehousesRoute() {
  const context = useOutletContext<DashboardOutletContext>()
  return <WarehouseList onOpenWarehouse={context.onOpenWarehouse} />
}

export function SalesOrdersRoute() {
  const context = useOutletContext<DashboardOutletContext>()
  return (
    <OrdersView
      onNavigateToPurchases={context.onNavigateToPurchases}
      onNavigateToDeliveries={context.onNavigateFromSalesOrderToDeliveries}
      onNavigateToInventory={context.onNavigateToInventory}
    />
  )
}

export function PurchasesRoute({ section }: { section: PurchaseSection }) {
  const context = useOutletContext<DashboardOutletContext>()
  return (
    <PurchasesView
      key={section}
      section={section}
      onNavigateToDeliveries={context.onNavigateFromPurchaseToDeliveries}
    />
  )
}

export function DeliveriesRoute({ view }: { view: DeliveryView }) {
  const context = useOutletContext<DashboardOutletContext>()
  return (
    <DeliveriesHub
      key={`${view}-${context.deliveryPurchaseOrderId || context.deliverySalesOrderId || 'all'}`}
      initialTab={view}
      purchaseOrderId={context.deliveryPurchaseOrderId}
      salesOrderId={context.deliverySalesOrderId}
      arrangeOrder={context.arrangeDelivery}
    />
  )
}

export function DefaultRoute() {
  const { isAdmin, isManager, isStaff } = useAuth()
  // Inventory is the existing landing page for every recognized role.
  if (isAdmin || isManager || isStaff) return <Navigate replace to={ROUTES.inventory} />
  return (
    <Alert variant="destructive">
      <AlertDescription>
        Access denied. Contact your administrator to verify your account role.
      </AlertDescription>
    </Alert>
  )
}

export function StaffingAccess() {
  const { isAdmin, isManager } = useAuth()
  return isAdmin || isManager ? <Outlet /> : <Navigate replace to={ROUTES.home} />
}

export function LegacyRedirect() {
  const { screen } = useParams()
  return isNavItemKey(screen) ? (
    <Navigate replace to={routeForScreen(screen)} />
  ) : (
    <DashboardNotFound />
  )
}

export function DashboardNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
      <Link className="text-sm font-medium underline underline-offset-4" to={ROUTES.home}>
        Go to home
      </Link>
    </div>
  )
}
