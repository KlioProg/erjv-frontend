import { Navigate, Route, Routes } from 'react-router'
import { MainDashboard } from '@/components/dashboard/MainDashboard'
import { ClientList } from '@/components/crm/ClientList'
import { VehicleList } from '@/components/operations/VehicleList'
import { EmployeeList } from '@/components/staffing/EmployeeList'
import { JobList } from '@/components/staffing/JobList'
import { UserRolesList } from '@/components/staffing/UserRolesList'
import {
  DashboardNotFound,
  DefaultRoute,
  DeliveriesRoute,
  InventoryRoute,
  LegacyRedirect,
  PurchasesRoute,
  SalesOrdersRoute,
  StaffingAccess,
  WarehousesRoute,
} from './DashboardPages'
import { ROUTES } from '@/routes'
import { WarehouseDetailsRoute } from './WarehouseDetailsRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainDashboard />}>
        <Route index element={<DefaultRoute />} />
        <Route path="customers" element={<ClientList />} />
        <Route path="sales-orders" element={<SalesOrdersRoute />} />
        <Route path="suppliers" element={<PurchasesRoute section="suppliers" />} />
        <Route path="purchase-orders" element={<PurchasesRoute section="orders" />} />
        <Route path="inventory" element={<InventoryRoute />} />
        <Route path="warehouses" element={<WarehousesRoute />} />
        <Route path="warehouses/:warehouseId" element={<WarehouseDetailsRoute />} />
        <Route path="vehicles" element={<VehicleList />} />
        <Route path="deliveries" element={<Navigate replace to={ROUTES.outgoingDeliveries} />} />
        <Route path="deliveries/incoming" element={<DeliveriesRoute view="incoming" />} />
        <Route path="deliveries/outgoing" element={<DeliveriesRoute view="outgoing" />} />
        <Route path="deliveries/history" element={<DeliveriesRoute view="history" />} />
        <Route element={<StaffingAccess />}>
          <Route path="staff-directory" element={<EmployeeList />} />
          <Route path="job-positions" element={<JobList />} />
          <Route path="user-roles" element={<UserRolesList />} />
        </Route>
        <Route path="legacy/:screen" element={<LegacyRedirect />} />
        <Route path="*" element={<DashboardNotFound />} />
      </Route>
    </Routes>
  )
}
