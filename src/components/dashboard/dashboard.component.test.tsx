import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import cases from '@/features/financial-reports/report-test-fixtures.json'
import { DashboardPage } from './DashboardPage'

const auth = vi.hoisted(() => ({
  user: { id: 1 },
  isAdmin: true,
  isManager: false,
  isStaff: false,
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
const openInventory = vi.fn()
let requests: { url: string; params: Record<string, unknown> }[]
let stockPartial: boolean
let deliveryPartial: boolean
let showTasks: boolean
let malformed: boolean
let fail: string
let financialFixture: string
let stockStatus: string
let separateReportTimes: boolean

beforeEach(() => {
  requests = []
  stockPartial = deliveryPartial = showTasks = malformed = false
  fail = ''
  financialFixture = 'sales-large-exact-money'
  stockStatus = 'OUT'
  separateReportTimes = false
  auth.isAdmin = true
  auth.isManager = auth.isStaff = false
  openInventory.mockClear()
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    const params = config.params ?? {}
    requests.push({ url, params })
    if (url === fail) throw Error('Unavailable')
    let data: unknown = { items: [], nextCursor: null }
    if (url.startsWith('/financial-reports/')) {
      const fixture = cases.find(
        (entry) =>
          entry.id ===
          (url.endsWith('/sales')
            ? financialFixture
            : url.endsWith('/purchases')
              ? 'purchases-overview'
              : 'profit-partial-coverage'),
      )!
      data = {
        ...fixture.body,
        period: {
          from: params.from,
          before: params.before,
          businessTimezone: 'Asia/Manila',
          asOf:
            separateReportTimes && url.endsWith('/purchases')
              ? '2026-11-02T03:05:00Z'
              : '2026-11-02T03:04:00Z',
        },
      }
    } else if (url === '/inventory-items') {
      data = {
        items: [{ id: 1, name: 'Rice', unit: 'bags', isActive: true }],
        nextCursor: stockPartial ? 'products-next' : null,
      }
    } else if (url === '/warehouses') {
      data = { items: [{ id: 2, name: 'Central', isActive: true }], nextCursor: null }
    } else if (url === '/stock-items' && showTasks) {
      data = {
        items: [
          {
            id: 3,
            inventoryItemId: 1,
            warehouseId: 2,
            availableQuantity: stockStatus === 'LOW' ? '2.00' : '0.00',
            onHandQuantity: '20.00',
            stockStatus,
          },
        ],
        nextCursor: null,
      }
    } else if (url === '/incoming-deliveries') {
      data = {
        items: showTasks
          ? [
              {
                id: 4,
                deliveryNumber: 'IN-4',
                status: 'SCHEDULED',
                scheduledAt: '2020-01-01T00:00:00Z',
              },
            ]
          : [],
        nextCursor: deliveryPartial ? 'incoming-next' : null,
      }
    } else if (url === '/outgoing-deliveries') {
      data = {
        items: malformed
          ? [{ id: 5 }]
          : showTasks
            ? [{ id: 5, deliveryNumber: 'OUT-5', status: 'READY', runId: null }]
            : [],
        nextCursor: null,
      }
    } else if (url === '/delivery-runs') {
      data = {
        items: showTasks
          ? [
              {
                id: params.statuses[0] === 'DRAFT' ? 6 : 7,
                runNumber: params.statuses[0] === 'DRAFT' ? 'RUN-6' : 'RUN-7',
                status: params.statuses[0],
                deliveries: [{ id: 8, status: 'DISPATCHED' }],
              },
            ]
          : [],
        nextCursor: null,
      }
    }
    return { config, data, headers: {}, status: 200, statusText: 'OK' }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={{ onOpenInventory: openInventory }} />}>
            <Route index element={<DashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it.each(['ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'])(
  'shows only permitted metrics for %s',
  async (role) => {
    auth.isAdmin = role === 'ADMIN' || role === 'SUPERADMIN'
    auth.isManager = role === 'MANAGER'
    auth.isStaff = role === 'STAFF'
    mount()
    await screen.findByText('Nothing needs attention.')
    expect(screen.getByRole('heading', { name: 'Inventory Overview' })).toBeTruthy()
    if (role === 'STAFF') {
      expect(screen.queryByRole('heading', { name: 'Financial Overview' })).toBeNull()
      expect(requests.some(({ url }) => url.startsWith('/financial-reports/'))).toBe(false)
    } else {
      expect(await screen.findByText('₱12,345,678,901,234,567,890.12')).toBeTruthy()
      expect(await screen.findByText('₱50.00')).toBeTruthy()
      expect(screen.getByText(/Estimated gross profit may be incomplete/)).toBeTruthy()
      const reports = requests.filter(({ url }) => url.startsWith('/financial-reports/'))
      expect(reports).toHaveLength(3)
      for (const { params } of reports) {
        expect(params).toMatchObject({ groupBy: 'none' })
        expect(params.from).toMatch(/-01T00:00:00\+08:00$/)
        expect(params).not.toHaveProperty('limit')
        expect(params).not.toHaveProperty('cursor')
      }
      expect(screen.getByRole('link', { name: /^Sales / }).getAttribute('href')).toBe(
        '/financial-reports?report=sales',
      )
      expect(screen.queryByText(/Snapshot:/)).toBeNull()
      const times = within(screen.getByRole('region', { name: 'Financial Overview' }))
        .getByText('Report times')
        .closest('details')!
      expect(times.open).toBe(false)
      expect(times.querySelectorAll('time')).toHaveLength(1)
    }
  },
)

it('uses available-stock warnings and navigates with the actual warehouse and product IDs', async () => {
  showTasks = true
  mount()
  const attention = screen.getByRole('region', { name: 'Needs Attention' })
  const stock = await within(attention).findByRole('button', { name: /Rice · Central/ })
  expect(stock.textContent).toContain('Out of available stock')
  await userEvent.setup().click(stock)
  expect(openInventory).toHaveBeenCalledWith(
    expect.objectContaining({ productId: 1, warehouseId: 2 }),
  )
  expect(within(attention).getByRole('link', { name: /RUN-7/ }).getAttribute('href')).toBe(
    '/deliveries/runs?run=7',
  )
  expect(within(attention).getByText('1 delivery awaiting reconciliation')).toBeTruthy()
  expect(within(attention).getByText('Overdue incoming · receiving required')).toBeTruthy()
  expect(within(attention).getByRole('link', { name: /OUT-5/ })).toBeTruthy()
  expect(within(attention).queryByText('RUN-6')).toBeNull()
  await userEvent.setup().click(screen.getByRole('button', { name: /Low Stock/ }))
  expect(openInventory).toHaveBeenCalledWith({ warningFilter: 'LOW' })
})

it('qualifies incomplete pages without fetching subsequent cursors or claiming all-clear', async () => {
  stockPartial = deliveryPartial = true
  mount()
  await screen.findByText(/Partial stock counts/)
  const deliveryStatus = screen.getByRole('region', { name: 'Delivery Status' })
  expect(
    within(deliveryStatus).getByRole('link', { name: /Incoming deliveries/ }).textContent,
  ).toContain('Not verified')
  expect(screen.getByRole('button', { name: /Out of Stock/ }).textContent).toContain('Not verified')
  expect(screen.queryByText('Nothing needs attention.')).toBeNull()
  expect(requests.every(({ params }) => !params.cursor)).toBe(true)
  expect(requests.filter(({ url }) => !url.startsWith('/financial-reports/'))).toHaveLength(7)
  expect(screen.queryByRole('region', { name: 'Quick Actions' })).toBeNull()
  expect(screen.queryByText('Quick Actions')).toBeNull()
  expect(screen.getByRole('link', { name: 'View Inventory' }).getAttribute('href')).toBe(
    '/inventory',
  )
})

it('uses the backend low-stock status without inventing a threshold', async () => {
  stockStatus = 'LOW'
  showTasks = true
  mount()
  const warning = await within(screen.getByRole('region', { name: 'Needs Attention' })).findByRole(
    'button',
    { name: /Rice · Central/ },
  )
  expect(warning.textContent).toContain('Low available stock')
  expect(screen.getByRole('button', { name: /Low Stock/ }).textContent).toContain('1')
})

it.each(['failed', 'malformed'])(
  'keeps other widgets usable with %s stock information',
  async (kind) => {
    if (kind === 'failed') fail = '/stock-items'
    else {
      showTasks = true
      stockStatus = 'UNKNOWN'
    }
    mount()
    await screen.findByText(
      kind === 'failed' ? /Stock information unavailable/ : /Partial stock counts/,
    )
    expect(screen.queryByText('Nothing needs attention.')).toBeNull()
    expect(await screen.findByText('₱50.00')).toBeTruthy()
  },
)

it('recovers one failed financial metric without blocking operational information', async () => {
  fail = '/financial-reports/sales'
  mount()
  await screen.findByRole('button', { name: 'Retry Sales' })
  expect(await screen.findByText('Nothing needs attention.')).toBeTruthy()
  expect(await screen.findByText('₱50.00')).toBeTruthy()
  fail = ''
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry Sales' }))
  expect(await screen.findByText('₱12,345,678,901,234,567,890.12')).toBeTruthy()
})

it.each(['failed', 'malformed'])(
  'does not treat %s delivery data as an empty successful list',
  async (kind) => {
    if (kind === 'failed') fail = '/outgoing-deliveries'
    else malformed = true
    mount()
    await screen.findByRole('button', { name: /Retry READY outgoing/ })
    expect(screen.queryByText('Nothing needs attention.')).toBeNull()
    expect(await screen.findByText('₱50.00')).toBeTruthy()
  },
)

it('shows accurate zero activity and refreshes all active dashboard sources', async () => {
  financialFixture = 'sales-empty-overview'
  mount()
  await screen.findByText('₱0.00')
  await screen.findByText('Nothing needs attention.')
  const before = requests.length
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(before + 10))
  expect(requests.every(({ params }) => !params.cursor)).toBe(true)
})

it('keeps finance usable while a delivery request is slow and cancels it on navigation', async () => {
  const adapter = apiClient.defaults.adapter
  if (typeof adapter !== 'function') throw Error('Expected test adapter')
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let deliverySignal: { aborted?: boolean } | undefined
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/incoming-deliveries') {
      deliverySignal = config.signal
      await gate
    }
    return adapter(config)
  }
  const view = mount()
  await screen.findByText('₱50.00')
  expect(
    within(screen.getByRole('region', { name: 'Delivery Status' })).getByText('Loading…'),
  ).toBeTruthy()
  expect(screen.queryByText('Nothing needs attention.')).toBeNull()
  view.unmount()
  expect(deliverySignal?.aborted).toBe(true)
  release()
})

it('keeps definitions and distinct report times contextual while warnings stay visible', async () => {
  separateReportTimes = true
  mount()
  await screen.findByText('₱50.00')
  const finance = screen.getByRole('region', { name: 'Financial Overview' })
  const explanation = within(finance).getByText('How is this calculated?').closest('details')!
  const times = within(finance).getByText('Report times').closest('details')!
  expect(explanation.open).toBe(false)
  expect(times.open).toBe(false)
  expect(
    within(finance)
      .getByText(/may be incomplete/)
      .closest('details'),
  ).toBeNull()
  await userEvent.setup().click(within(finance).getByText('Report times'))
  expect(times.open).toBe(true)
  expect([...times.querySelectorAll('time')].map((time) => time.dateTime)).toEqual([
    '2026-11-02T03:04:00.000Z',
    '2026-11-02T03:05:00.000Z',
  ])
  expect(within(times).getByText('Sales, Estimated Gross Profit')).toBeTruthy()
  expect(within(times).getByText('Purchases')).toBeTruthy()
  expect(screen.getByText('About stock counts').closest('details')!.open).toBe(false)
  expect(screen.queryByText(/Asia\/Manila/)).toBeNull()
})

it('keeps a unified compact operations summary with meaningful actionable states', async () => {
  showTasks = true
  stockPartial = deliveryPartial = true
  mount()
  const operations = screen.getByRole('region', { name: 'Operations' })
  const attention = within(operations).getByRole('region', { name: 'Needs Attention' })
  await within(attention).findByRole('link', { name: /OUT-5/ })
  expect(within(attention).getByText('Awaiting assignment')).toBeTruthy()
  expect(within(attention).getByText('Overdue')).toBeTruthy()
  expect(within(attention).queryByText('Normal')).toBeNull()
  expect(screen.getByRole('button', { name: /Out of Stock/ }).textContent).toContain('1+')
  const status = within(operations).getByRole('region', { name: 'Delivery Status' })
  const incoming = within(status).getByRole('link', { name: /Incoming deliveries/ })
  expect(incoming.textContent).toContain('1+')
  expect(incoming.getAttribute('href')).toBe('/deliveries/incoming')
  expect(
    within(status)
      .getByRole('link', { name: /READY outgoing/ })
      .getAttribute('href'),
  ).toBe('/deliveries/outgoing')
  expect(within(status).queryByText(/Updated/)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Delivery Overview' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Quick Actions' })).toBeNull()
})
