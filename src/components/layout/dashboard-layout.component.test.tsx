import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN', fullName: 'Admin' }, isAdmin: true, isManager: false, logout: vi.fn() }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
afterEach(() => { auth.isAdmin = true; auth.isManager = false })
vi.mock('./StockNotifications', () => ({ StockNotifications: () => null }))

it('hides financial navigation from managers while preserving their staffing access', () => {
  auth.isAdmin = false
  auth.isManager = true
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DashboardLayout onNavigate={vi.fn()} onOpenInventory={vi.fn()}>
          <h1>Dashboard</h1>
        </DashboardLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(screen.queryByRole('link', { name: 'Financial Reports' })).toBeNull()
  expect(screen.getAllByRole('link', { name: 'Staff Directory' }).length).toBeGreaterThan(0)
})

it('opens mobile navigation as a modal and restores focus when Escape closes it', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DashboardLayout onNavigate={vi.fn()} onOpenInventory={vi.fn()} currentScreen="inventory">
          <h1>Inventory</h1>
        </DashboardLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const trigger = screen.getByRole('button', { name: 'Open navigation' })
  await user.click(trigger)
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
  expect(getComputedStyle(document.body).overflow).toBe('hidden')
  const dialog = screen.getByRole('dialog', { name: 'Navigation' })
  const toggles = screen.getAllByRole('button', { name: 'Deliveries', hidden: true })
  expect(new Set(toggles.map((toggle) => toggle.getAttribute('aria-controls'))).size).toBe(
    toggles.length,
  )
  expect(within(dialog).getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  expect(dialog.contains(document.activeElement)).toBe(true)
  for (let index = 0; index < 16; index++) {
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  }
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)

  const account = screen.getByRole('button', { name: 'Account menu' })
  await user.click(account)
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
  expect(getComputedStyle(document.body).overflow).toBe('hidden')
  await user.keyboard('{Escape}')
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  expect(document.activeElement).toBe(account)
})

it('uses distinct sales and reporting icons without changing their routes', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DashboardLayout onNavigate={vi.fn()} onOpenInventory={vi.fn()}>
          <h1>Dashboard</h1>
        </DashboardLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const reports = screen.getAllByRole('link', { name: 'Financial Reports' })
  const sales = screen.getAllByRole('link', { name: 'Sales Orders' })
  for (const link of reports) {
    expect(link.getAttribute('href')).toBe('/financial-reports')
    expect(link.querySelector('svg')?.classList.contains('lucide-chart-no-axes-combined')).toBe(
      true,
    )
  }
  for (const link of sales)
    expect(link.querySelector('svg')?.classList.contains('lucide-receipt-text')).toBe(true)
})
