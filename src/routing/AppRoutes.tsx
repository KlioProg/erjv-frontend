import { Navigate, Route, Routes } from 'react-router'
import {
  DashboardNotFound,
  DashboardScreen,
  LegacyDashboardScreen,
  MainDashboard,
} from '@/components/dashboard/MainDashboard'
import { ROUTES } from '@/routes'
import { WarehouseDetailsRoute } from './WarehouseDetailsRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainDashboard />}>
        <Route index element={<Navigate replace to={ROUTES.default} />} />
        <Route path="customers" element={<DashboardScreen screen="clients" />} />
        <Route path="sales-orders" element={<DashboardScreen screen="orders" />} />
        <Route path="inventory" element={<DashboardScreen screen="inventory" />} />
        <Route path="warehouses" element={<DashboardScreen screen="warehouses" />} />
        <Route path="warehouses/:warehouseId" element={<WarehouseDetailsRoute />} />
        <Route path="vehicles" element={<DashboardScreen screen="fleet" />} />
        <Route path="deliveries" element={<Navigate replace to={ROUTES.outgoingDeliveries} />} />
        <Route
          path="deliveries/incoming"
          element={<DashboardScreen screen="incoming-deliveries" />}
        />
        <Route
          path="deliveries/outgoing"
          element={<DashboardScreen screen="outgoing-deliveries" />}
        />
        <Route path="deliveries/history" element={<DashboardScreen screen="delivery-history" />} />
        <Route path="legacy/:screen" element={<LegacyDashboardScreen />} />
        <Route path="*" element={<DashboardNotFound />} />
      </Route>
    </Routes>
  )
}
