import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { StockNotifications } from './StockNotifications'
import type { StockWarning } from '@/features/logistics/stock-warnings'

const state = vi.hoisted(() => ({
  warnings: [] as StockWarning[],
  loading: false,
  unavailable: false,
  refreshing: false,
  refresh: vi.fn(),
}))
vi.mock('@/features/logistics/stock-warnings.hooks', () => ({
  useStockWarnings: () => ({
    ...state,
    warehouses: [
      { id: 1, name: 'Store', isActive: true },
      { id: 2, name: 'Main Warehouse', isActive: true },
    ],
  }),
}))
beforeEach(() => {
  state.loading = false
  state.unavailable = false
  state.warnings = [
    {
      id: 'out',
      productId: 1,
      warehouseId: 1,
      productName: 'Mango',
      locationName: 'Store',
      unit: 'kg',
      quantityCents: 0n,
      severity: 'OUT',
    },
    {
      id: 'low',
      productId: 2,
      warehouseId: 2,
      productName: 'Banana',
      locationName: 'Main Warehouse',
      unit: 'kg',
      quantityCents: 100n,
      severity: 'LOW',
      reorderThresholdCents: 200n,
    },
  ]
  state.refresh.mockReset().mockResolvedValue([])
})
const dot = (name: string) =>
  screen.getByRole('menuitemradio', { name }).querySelector('[aria-hidden="true"]')

it('shows warehouse-scoped severity dots independently of the selected category and never on All', async () => {
  const user = userEvent.setup()
  render(<StockNotifications onOpenInventory={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /Stock notifications/ }))
  expect(dot('All warnings')).toBeNull()
  expect(
    screen.getByRole('menuitemradio', { name: 'All warnings' }).querySelector('svg'),
  ).toBeNull()
  expect(dot('Out of stock')?.classList.contains('bg-destructive')).toBe(true)
  expect(dot('Low stock')?.classList.contains('bg-status-warning-foreground')).toBe(true)
  await user.click(screen.getByRole('menuitemradio', { name: 'Out of stock' }))
  expect(
    screen.getByRole('menuitemradio', { name: 'Out of stock' }).getAttribute('aria-checked'),
  ).toBe('true')
  expect(dot('Low stock')).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Warning warehouse' }))
  await user.click(screen.getByRole('option', { name: 'Store' }))
  expect(dot('Out of stock')).toBeTruthy()
  expect(dot('Low stock')).toBeNull()
  await user.click(screen.getByRole('combobox', { name: 'Warning warehouse' }))
  await user.click(screen.getByRole('option', { name: 'Main Warehouse' }))
  expect(dot('Out of stock')).toBeNull()
  expect(dot('Low stock')).toBeTruthy()
  expect(dot('All warnings')).toBeNull()
  for (const name of ['All warnings', 'Out of stock', 'Low stock']) {
    await user.click(screen.getByRole('menuitemradio', { name }))
    expect(screen.getByRole('menuitemradio', { name }).getAttribute('aria-checked')).toBe('true')
    expect(dot('All warnings')).toBeNull()
  }
})

it('removes dots as warning data clears, including a selected empty category', async () => {
  const user = userEvent.setup()
  const view = render(<StockNotifications onOpenInventory={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /Stock notifications/ }))
  await user.click(screen.getByRole('menuitemradio', { name: 'Out of stock' }))
  state.warnings = []
  view.rerender(<StockNotifications onOpenInventory={vi.fn()} />)
  for (const name of ['All warnings', 'Out of stock', 'Low stock']) {
    await user.click(screen.getByRole('menuitemradio', { name }))
    expect(screen.getByRole('menuitemradio', { name }).getAttribute('aria-checked')).toBe('true')
    expect(dot(name)).toBeNull()
    expect(screen.getByRole('menuitemradio', { name }).querySelector('svg')).toBeNull()
  }
})

it('preserves arrow-key selection in the equal-width filters', async () => {
  const user = userEvent.setup()
  render(<StockNotifications onOpenInventory={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /Stock notifications/ }))
  screen.getByRole('menuitemradio', { name: 'Out of stock' }).focus()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(
    screen.getByRole('menuitemradio', { name: 'Low stock' }).getAttribute('aria-checked'),
  ).toBe('true')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Low stock' }))
})

it.each(['loading', 'unavailable'] as const)(
  'does not expose category indicators while %s',
  async (status) => {
    state[status] = true
    const user = userEvent.setup()
    render(<StockNotifications onOpenInventory={vi.fn()} />)
    await user.click(
      screen.getByRole('button', { name: /Stock notifications|stock notifications/ }),
    )
    expect(screen.queryByRole('menuitemradio')).toBeNull()
  },
)
