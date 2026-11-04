import { render, screen, within } from '@testing-library/react'
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
let extraOutgoing: boolean

beforeEach(() => {
  requests = []
  stockPartial = deliveryPartial = showTasks = malformed = false
  fail = ''
  financialFixture = 'sales-large-exact-money'
  stockStatus = 'OUT'
  separateReportTimes = false
  extraOutgoing = false
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
            ? [
                { id: 5, deliveryNumber: 'OUT-5', status: 'READY', runId: null },
                ...(extraOutgoing
                  ? [
                      { id: 50, deliveryNumber: 'OUT-50', status: 'READY', runId: null },
                      { id: 51, deliveryNumber: 'OUT-51', status: 'READY', runId: null },
                    ]
                  : []),
              ]
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
    if (!auth.isAdmin) {
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
      const finance = screen.getByRole('region', { name: 'Financial Overview' })
      expect(within(finance).queryByText('Report times')).toBeNull()
      expect(finance.querySelectorAll('time')).toHaveLength(0)
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
    within(deliveryStatus).getByRole('link', { name: /Awaiting receipt/ }).textContent,
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
    await screen.findByRole('button', { name: /Retry Ready to assign/ })
    expect(screen.queryByText('Nothing needs attention.')).toBeNull()
    expect(await screen.findByText('₱50.00')).toBeTruthy()
  },
)

it('shows accurate zero activity without a manual refresh button', async () => {
  financialFixture = 'sales-empty-overview'
  mount()
  await screen.findByText('₱0.00')
  await screen.findByText('Nothing needs attention.')
  expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
  expect(requests.length).toBeGreaterThan(0)
})

it('keeps finance usable while a delivery request is slow and cancels it on navigation', async () => {
  showTasks = true
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
    within(screen.getByRole('link', { name: /Awaiting receipt/ })).getByText('Loading…'),
  ).toBeTruthy()
  expect(screen.queryByText('Nothing needs attention.')).toBeNull()
  const attention = screen.getByRole('region', { name: 'Needs Attention' })
  expect(await within(attention).findByRole('link', { name: /OUT-5/ })).toBeTruthy()
  expect(within(attention).getByText('Updating…')).toBeTruthy()
  expect(within(attention).queryByText(/Checking for tasks/)).toBeNull()
  view.unmount()
  expect(deliverySignal?.aborted).toBe(true)
  release()
})

it('omits financial disclosures and timestamps while retaining a warning beside estimated gross profit', async () => {
  separateReportTimes = true
  mount()
  await screen.findByText('₱50.00')
  const finance = screen.getByRole('region', { name: 'Financial Overview' })
  expect(within(finance).queryByText('How is this calculated?')).toBeNull()
  expect(within(finance).queryByText('Report times')).toBeNull()
  expect(finance.querySelectorAll('time')).toHaveLength(0)
  const profit = within(finance).getByRole('link', { name: /Estimated Gross Profit/ })
  expect(within(profit.parentElement!).getAllByRole('status')).toHaveLength(1)
  expect(within(profit.parentElement!).getByText(/may be incomplete/)).toBeTruthy()
  expect(screen.getByText('About stock counts').closest('details')!.open).toBe(false)
  expect(screen.queryByText(/Asia\/Manila/)).toBeNull()
})

it('separates compact inventory, actionable tasks and delivery status without redundant labels', async () => {
  showTasks = true
  stockPartial = deliveryPartial = true
  mount()
  const attention = screen.getByRole('region', { name: 'Needs Attention' })
  await within(attention).findByRole('link', { name: /OUT-5/ })
  expect(within(attention).getByText('Ready for run assignment')).toBeTruthy()
  expect(within(attention).getByText('Overdue incoming · receiving required')).toBeTruthy()
  expect(within(attention).queryByText('Normal')).toBeNull()
  expect(screen.getByRole('button', { name: /Out of Stock/ }).textContent).toContain('1+')
  const status = screen.getByRole('region', { name: 'Delivery Status' })
  const incoming = within(status).getByRole('link', { name: /Awaiting receipt/ })
  expect(incoming.textContent).toContain('1+')
  expect(incoming.getAttribute('href')).toBe('/deliveries/incoming')
  expect(
    within(status)
      .getByRole('link', { name: /Ready to assign/ })
      .getAttribute('href'),
  ).toBe('/deliveries/outgoing')
  expect(within(status).queryByText(/Updated/)).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Delivery Overview' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Quick Actions' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Operations' })).toBeNull()
  const inventory = screen.getByRole('region', { name: 'Inventory Overview' })
  expect(within(inventory).getByRole('button', { name: /Low Stock/ })).toBeTruthy()
  expect(
    within(inventory)
      .getByRole('link', { name: /Active Warehouses/ })
      .getAttribute('href'),
  ).toBe('/warehouses')
})

it('initially shows four tasks and reveals more loaded records without extra requests', async () => {
  showTasks = extraOutgoing = true
  mount()
  const attention = screen.getByRole('region', { name: 'Needs Attention' })
  await within(attention).findByText('Showing 4 of 6 loaded tasks.')
  expect(within(attention).getAllByRole('listitem')).toHaveLength(4)
  expect(within(attention).queryByRole('link', { name: /OUT-50/ })).toBeNull()
  const before = requests.length
  await userEvent.setup().click(within(attention).getByRole('button', { name: 'Show more tasks' }))
  expect(within(attention).getAllByRole('listitem')).toHaveLength(6)
  expect(
    within(attention)
      .getByRole('link', { name: /OUT-50/ })
      .getAttribute('href'),
  ).toBe('/deliveries/outgoing')
  expect(requests).toHaveLength(before)
  expect(within(attention).queryByRole('button', { name: 'Show more tasks' })).toBeNull()
})
