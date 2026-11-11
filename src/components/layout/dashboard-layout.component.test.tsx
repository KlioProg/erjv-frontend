import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'
import { SidebarActiveIndicator } from './SidebarActiveIndicator'

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN', fullName: 'Admin' }, isAdmin: true, isManager: false, logout: vi.fn() }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
afterEach(() => { auth.isAdmin = true; auth.isManager = false; vi.restoreAllMocks(); vi.useRealTimers() })
vi.mock('./StockNotifications', () => ({ StockNotifications: () => null }))

function mountHeader(currentScreen: 'dashboard' | 'clients' | 'inventory' | 'financial-reports' | 'delivery-runs' = 'dashboard') {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[currentScreen === 'delivery-runs' ? '/deliveries/runs' : '/']}>
    <DashboardLayout currentScreen={currentScreen} onNavigate={vi.fn()} onOpenInventory={vi.fn()}>
      <h1>Page content</h1>
    </DashboardLayout>
  </MemoryRouter></QueryClientProvider>)
}

it('slides the active indicator only between direct siblings in one navigation scope', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const left = this.textContent === 'Two' ? 100 : 0
    const width = this.tagName === 'A' ? 80 : 200
    return {
      x: left,
      y: 0,
      left,
      top: 0,
      right: left + width,
      bottom: 36,
      width,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect
  })

  const renderScope = (active: boolean, selected: 'one' | 'two') => (
    <SidebarActiveIndicator active={active} routeKey={selected} className="gap-1">
      {(['one', 'two'] as const).map((value) => (
        <a key={value} href={`/${value}`} aria-current={selected === value ? 'page' : undefined}>
          {value === 'one' ? 'One' : 'Two'}
        </a>
      ))}
    </SidebarActiveIndicator>
  )

  const { container, rerender } = render(renderScope(true, 'one'))
  expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('transition-none')

  rerender(renderScope(true, 'two'))
  expect(container.querySelector('[aria-hidden="true"]')?.className).toContain(
    'transition-[transform,width,height]',
  )

  rerender(renderScope(false, 'one'))
  rerender(renderScope(true, 'one'))
  expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('transition-none')
})

it('ignores active links nested below the current navigation scope', () => {
  const { container } = render(
    <SidebarActiveIndicator active routeKey="inventory" className="gap-1">
      <div>
        <a href="/inventory" aria-current="page">
          Products &amp; Stock
        </a>
      </div>
    </SidebarActiveIndicator>,
  )

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
})

it('keeps Delivery Trips active at the top level while Deliveries stays collapsed', () => {
  mountHeader('delivery-runs')
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
  const trips = nav.getByRole('link', { name: 'Delivery Trips' })
  expect(trips.getAttribute('href')).toBe('/deliveries/runs')
  expect(trips.getAttribute('aria-current')).toBe('page')
  expect(nav.getByRole('button', { name: 'Deliveries' }).getAttribute('aria-expanded')).toBe('false')
  expect(screen.getByRole('navigation', { name: 'Application breadcrumb' }).textContent).toContain('Delivery Trips')
  expect(screen.getByRole('navigation', { name: 'Application breadcrumb' }).textContent).not.toContain('Deliveries /')
  const breadcrumb = within(screen.getByRole('navigation', { name: 'Application breadcrumb' }))
  expect(breadcrumb.getByText('Logistics').tagName).toBe('SPAN')
  expect(breadcrumb.queryByRole('link', { name: 'Logistics' })).toBeNull()
})

it.each(['dashboard', 'clients', 'inventory', 'financial-reports', 'delivery-runs'] as const)(
  'shows the Philippine calendar date in the shared header on %s', (page) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-07T16:00:00Z'))
    mountHeader(page)
    const date = within(screen.getByRole('banner')).getByLabelText(/^Today's date in the Philippines:/)
    expect(date.tagName).toBe('TIME')
    expect(date.getAttribute('datetime')).toBe('2026-11-08')
    expect(date.textContent).toBe('Sunday, November 8, 2026')
    expect(screen.getAllByLabelText(/^Today's date in the Philippines:/)).toHaveLength(1)
  },
)

it('updates at successive Manila midnights and clears its timer when unmounted', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T15:59:59.500Z'))
  const { unmount } = mountHeader()
  const date = screen.getByLabelText(/^Today's date in the Philippines:/)
  act(() => { vi.advanceTimersByTime(499) })
  expect(date.textContent).toBe('Sunday, November 8, 2026')
  act(() => { vi.advanceTimersByTime(1) })
  expect(date.textContent).toBe('Monday, November 9, 2026')
  act(() => { vi.advanceTimersByTime(86_400_000) })
  expect(date.getAttribute('datetime')).toBe('2026-11-10')
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  fireEvent.focus(window)
  fireEvent(document, new Event('visibilitychange'))
  expect(vi.getTimerCount()).toBe(0)
})

it('refreshes the Philippine date when a suspended tab becomes visible or focused', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T04:00:00Z'))
  const { unmount } = mountHeader()
  const date = screen.getByLabelText(/^Today's date in the Philippines:/)
  vi.setSystemTime(new Date('2026-11-10T00:00:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  expect(date.getAttribute('datetime')).toBe('2026-11-10')
  vi.setSystemTime(new Date('2026-11-10T16:00:00Z'))
  fireEvent.focus(window)
  expect(date.getAttribute('datetime')).toBe('2026-11-11')
  unmount()
})

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

it('reserves expansion chevrons for the expandable delivery navigation', async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/customers']}>
    <DashboardLayout currentScreen="clients" onNavigate={vi.fn()} onOpenInventory={vi.fn()}><h1>Customers</h1></DashboardLayout>
  </MemoryRouter></QueryClientProvider>)
  for (const link of screen.getAllByRole('link', { name: 'Customers' })) {
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.querySelector('.lucide-chevron-right')).toBeNull()
  }
  const delivery = screen.getByRole('button', { name: 'Deliveries' })
  expect(delivery.getAttribute('aria-expanded')).toBe('false')
  await userEvent.click(delivery)
  expect(delivery.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('link', { name: 'Incoming' }).getAttribute('href')).toBe('/deliveries/incoming')
})
