import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ADMIN', fullName: 'Admin' }, isAdmin: true, logout: vi.fn() }),
}))
vi.mock('./StockNotifications', () => ({ StockNotifications: () => null }))

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
})
