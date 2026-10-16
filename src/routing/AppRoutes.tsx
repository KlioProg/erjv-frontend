import { Navigate, Route, Routes } from 'react-router'
import {
  DashboardNotFound,
  DashboardScreen,
  LegacyDashboardScreen,
  MainDashboard,
} from '@/components/dashboard/MainDashboard'
import { ROUTES } from '@/routes'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainDashboard />}>
        <Route index element={<Navigate replace to={ROUTES.default} />} />
        <Route path="customers" element={<DashboardScreen screen="clients" />} />
        <Route path="sales-orders" element={<DashboardScreen screen="orders" />} />
        <Route path="legacy/:screen" element={<LegacyDashboardScreen />} />
        <Route path="*" element={<DashboardNotFound />} />
      </Route>
    </Routes>
  )
}
