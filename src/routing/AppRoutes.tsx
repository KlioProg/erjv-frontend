import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { MainDashboard } from '@/components/dashboard/MainDashboard'
import { Spinner } from '@/components/ui/spinner'
import {
  DashboardNotFound,
  DefaultRoute,
  DeliveriesRoute,
  InventoryRoute,
  LegacyRedirect,
  PurchasesRoute,
  SalesOrdersRoute,
  StaffingAccess,
  FinancialReportsAccess,
  WarehousesRoute,
} from './DashboardPages'
import { ROUTES } from '@/routes'

const WarehouseTransfersPage = lazy(() =>
  import('@/components/warehouse-transfers/WarehouseTransfersPage').then((module) => ({
    default: module.WarehouseTransfersPage,
  })),
)
const FinancialReportsPage = lazy(() =>
  import('@/components/financial-reports/FinancialReportsPage').then((module) => ({
    default: module.FinancialReportsPage,
  })),
)
const ClientList = lazy(() =>
  import('@/components/crm/ClientList').then((module) => ({ default: module.ClientList })),
)
const VehicleList = lazy(() =>
  import('@/components/operations/VehicleList').then((module) => ({
    default: module.VehicleList,
  })),
)
const EmployeeList = lazy(() =>
  import('@/components/staffing/EmployeeList').then((module) => ({
    default: module.EmployeeList,
  })),
)
const JobList = lazy(() =>
  import('@/components/staffing/JobList').then((module) => ({ default: module.JobList })),
)
const UserRolesList = lazy(() =>
  import('@/components/staffing/UserRolesList').then((module) => ({
    default: module.UserRolesList,
  })),
)
const WarehouseDetailsRoute = lazy(() =>
  import('./WarehouseDetailsRoute').then((module) => ({
    default: module.WarehouseDetailsRoute,
  })),
)
const DeliveryRunsHub = lazy(() =>
  import('@/components/deliveries/DeliveryRunsHub').then((module) => ({
    default: module.DeliveryRunsHub,
  })),
)

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-[40svh] items-center justify-center">
          <span className="sr-only">Loading page...</span>
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        element={
          <RouteBoundary>
            <MainDashboard />
          </RouteBoundary>
        }
      >
        <Route
          index
          element={
            <RouteBoundary>
              <DefaultRoute />
            </RouteBoundary>
          }
        />
        <Route
          path="customers"
          element={
            <RouteBoundary>
              <ClientList />
            </RouteBoundary>
          }
        />
        <Route
          path="sales-orders"
          element={
            <RouteBoundary>
              <SalesOrdersRoute />
            </RouteBoundary>
          }
        />
        <Route
          path="suppliers"
          element={
            <RouteBoundary>
              <PurchasesRoute section="suppliers" />
            </RouteBoundary>
          }
        />
        <Route
          path="purchase-orders"
          element={
            <RouteBoundary>
              <PurchasesRoute section="orders" />
            </RouteBoundary>
          }
        />
        <Route
          path="inventory"
          element={
            <RouteBoundary>
              <InventoryRoute />
            </RouteBoundary>
          }
        />
        <Route
          path="inventory/quarantined"
          element={
            <RouteBoundary>
              <InventoryRoute quarantine />
            </RouteBoundary>
          }
        />
        <Route
          path="warehouses"
          element={
            <RouteBoundary>
              <WarehousesRoute />
            </RouteBoundary>
          }
        />
        <Route
          path="warehouses/:warehouseId"
          element={
            <RouteBoundary>
              <WarehouseDetailsRoute />
            </RouteBoundary>
          }
        />
        <Route
          path="warehouse-transfers"
          element={
            <RouteBoundary>
              <WarehouseTransfersPage key="active" />
            </RouteBoundary>
          }
        />
        <Route
          path="vehicles"
          element={
            <RouteBoundary>
              <VehicleList />
            </RouteBoundary>
          }
        />
        <Route path="deliveries" element={<Navigate replace to={ROUTES.outgoingDeliveries} />} />
        <Route
          path="deliveries/incoming"
          element={
            <RouteBoundary>
              <DeliveriesRoute view="incoming" />
            </RouteBoundary>
          }
        />
        <Route
          path="deliveries/outgoing"
          element={
            <RouteBoundary>
              <DeliveriesRoute view="outgoing" />
            </RouteBoundary>
          }
        />
        <Route
          path="warehouse-transfers/history"
          element={
            <RouteBoundary>
              <WarehouseTransfersPage key="history" view="history" />
            </RouteBoundary>
          }
        />
        <Route
          path="deliveries/history"
          element={
            <RouteBoundary>
              <DeliveriesRoute view="history" />
            </RouteBoundary>
          }
        />
        <Route
          path="deliveries/runs"
          element={
            <RouteBoundary>
              <DeliveryRunsHub />
            </RouteBoundary>
          }
        />
        <Route element={<FinancialReportsAccess />}>
          <Route
            path="financial-reports"
            element={
              <RouteBoundary>
                <FinancialReportsPage />
              </RouteBoundary>
            }
          />
        </Route>
        <Route element={<StaffingAccess />}>
          <Route
            path="staff-directory"
            element={
              <RouteBoundary>
                <EmployeeList />
              </RouteBoundary>
            }
          />
          <Route
            path="job-positions"
            element={
              <RouteBoundary>
                <JobList />
              </RouteBoundary>
            }
          />
          <Route
            path="user-roles"
            element={
              <RouteBoundary>
                <UserRolesList />
              </RouteBoundary>
            }
          />
        </Route>
        <Route path="legacy/:screen" element={<LegacyRedirect />} />
        <Route
          path="*"
          element={
            <RouteBoundary>
              <DashboardNotFound />
            </RouteBoundary>
          }
        />
      </Route>
    </Routes>
  )
}
