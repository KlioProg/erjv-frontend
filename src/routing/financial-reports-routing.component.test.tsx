import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'
import { routeForScreen, screenFromPath } from '@/routes'
const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/components/dashboard/MainDashboard', () => ({ MainDashboard: () => <Outlet context={{}} /> }))
vi.mock('@/components/dashboard/DashboardPage', () => ({ DashboardPage: () => <h1>Dashboard landing</h1> }))
vi.mock('@/components/financial-reports/FinancialReportsPage', () => ({
  FinancialReportsPage: () => <h1>Report feature</h1>,
}))
vi.mock('@/components/inventory/InventoryHub', () => ({
  InventoryHub: () => <h1>Inventory landing</h1>,
}))
it.each(['ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF', 'UNKNOWN'])(
  'guards report route for %s',
  (role) => {
    auth.isAdmin = role === 'ADMIN' || role === 'SUPERADMIN'
    auth.isManager = role === 'MANAGER'
    auth.isStaff = role === 'STAFF'
    render(
      <MemoryRouter initialEntries={['/financial-reports']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    if (auth.isAdmin) expect(screen.getByText('Report feature')).toBeTruthy()
    else expect(screen.queryByText('Report feature')).toBeNull()
  },
)
it('maps report navigation both ways', () => {
  expect(routeForScreen('financial-reports')).toBe('/financial-reports')
  expect(screenFromPath('/financial-reports')).toBe('financial-reports')
})
