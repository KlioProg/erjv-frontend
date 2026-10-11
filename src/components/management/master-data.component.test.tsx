import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { ClientList } from '@/components/crm/ClientList'
import { PurchasesView } from '@/components/purchases/PurchasesView'
import { WarehouseList } from '@/components/operations/WarehouseList'
import { JobList } from '@/components/staffing/JobList'
import { EmployeeList } from '@/components/staffing/EmployeeList'

const auth = vi.hoisted(() => ({
  isAdmin: true,
  isManager: false,
  isStaff: false,
  user: { id: 1, fullName: 'Test Admin', role: 'ADMIN' },
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))

const originalAdapter = apiClient.defaults.adapter
type RecordFixture = { id: number; name: string; isActive: boolean; [key: string]: unknown }
let records: Record<string, RecordFixture[]>
let requests: { url: string; method: string }[]
let warehouseQuantity: string

const surfaces = [
  {
    title: 'Customers',
    endpoint: '/clients',
    ui: () => <ClientList />,
    search: 'Search customers',
    tabs: 'Customers',
    nameField: /Business \/ Customer Name/,
    save: 'Save Changes',
    archive: 'Archive Customer',
    restore: 'Reactivate',
  },
  {
    title: 'Suppliers',
    endpoint: '/suppliers',
    ui: () => <PurchasesView section="suppliers" />,
    search: 'Search suppliers',
    tabs: 'Suppliers',
    nameField: /Company Name/,
    save: 'Save Changes',
    archive: 'Archive Supplier',
    restore: 'Restore',
  },
  {
    title: 'Warehouses',
    endpoint: '/warehouses',
    ui: () => <WarehouseList />,
    search: 'Search warehouses',
    tabs: 'Warehouses',
    nameField: /Warehouse Name/,
    save: 'Save Changes',
    archive: 'Archive Warehouse',
    restore: 'Restore',
  },
  {
    title: 'Job Positions',
    endpoint: '/jobs',
    ui: () => <JobList />,
    search: 'Search job positions',
    tabs: 'Positions',
    nameField: /Position Title/,
    save: 'Save Position',
    archive: 'Archive Position',
    restore: 'Reactivate position',
  },
]

function mount(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  auth.isAdmin = true
  auth.isStaff = false
  requests = []
  warehouseQuantity = '0'
  const record = (id: number, name: string, isActive: boolean): RecordFixture => ({
    id,
    name,
    isActive,
    code: `CODE-${id}`,
    address: 'Davao City',
    contactPerson: null,
    phone: null,
    email: null,
    contactNumber: null,
    description: 'Record description',
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  })
  records = Object.fromEntries(
    surfaces.map(({ endpoint }) => [
      endpoint,
      [record(1, 'Active Record', true), record(2, 'Archived Record', false)],
    ]),
  )
  records['/employees'] = [
    {
      ...record(1, 'Current Staff', true),
      firstName: 'Current',
      lastName: 'Staff',
      userId: 9,
      hireDate: '2026-10-01',
    },
    {
      ...record(2, 'Former Staff', false),
      firstName: 'Former',
      lastName: 'Staff',
      userId: null,
      hireDate: '2026-10-01',
    },
  ]
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  // Test-only HTTP adapter; all screens use their actual services and query/mutation hooks.
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    const method = config.method || 'get'
    requests.push({ url, method })
    const endpoint = '/' + url.split('/')[1]
    const id = Number(url.split('/')[2])
    let data: unknown = []
    if (method === 'get') {
      if (url === '/stock-items' || url.startsWith('/stock-items/warehouses/')) {
        data = [
          {
            id: 50,
            warehouseId: 1,
            inventoryItemId: 1,
            quantity: warehouseQuantity,
            inventoryItem: { id: 1, name: 'Product', unit: 'sacks' },
          },
        ]
      } else if (url === endpoint && records[endpoint]) {
        data = records[endpoint].filter(
          (record) => config.params?.includeInactive === 'true' || record.isActive,
        )
      }
    } else if (records[endpoint]) {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
      records[endpoint] = records[endpoint].map((record) =>
        record.id === id
          ? {
              ...record,
              ...(method === 'delete'
                ? { isActive: false }
                : url.endsWith('/reactivate')
                  ? { isActive: true }
                  : body),
            }
          : record,
      )
      data = records[endpoint].find((record) => record.id === id)
    }
    return { data: structuredClone(data), config, headers: {}, status: 200, statusText: 'OK' }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('neutral master-data tables', () => {
  it('keeps supplier search, name sorting and canonical pagination with six columns', async () => {
    const user = userEvent.setup()
    records['/suppliers'] = Array.from({ length: 16 }, (_, index) => ({
      ...records['/suppliers'][0],
      id: index + 1,
      name: `Supplier ${String(16 - index).padStart(2, '0')}`,
      code: `SUP-${index + 1}`,
    }))
    mount(<PurchasesView section="suppliers" />)
    await screen.findByText('Supplier 16')
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6)
    expect(within(table).getAllByRole('row')).toHaveLength(11)
    await user.click(within(table).getByRole('button', { name: 'Company Name' }))
    expect(within(table).getAllByRole('row')[1].textContent).toContain('Supplier 01')
    await user.click(screen.getByRole('button', { name: 'Next Page' }))
    expect(within(table).getAllByRole('row')[1].textContent).toContain('Supplier 11')
    await user.type(screen.getByRole('textbox', { name: 'Search suppliers' }), 'Supplier 03')
    expect(await screen.findByText('Supplier 03')).toBeTruthy()
    expect(within(table).getAllByRole('row')).toHaveLength(2)
  })

  it.each(surfaces)(
    '$title keeps edit, archive confirmation, restore and record filtering',
    async (surface) => {
      const user = userEvent.setup()
      mount(surface.ui())
      await screen.findByText('Active Record')
      expect(screen.getByRole('heading', { name: surface.title })).toBeTruthy()
      expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
      expect(screen.queryByText('Archived Record')).toBeNull()
      const search = screen.getByRole('textbox', { name: surface.search })
      await user.type(search, 'not found')
      expect(screen.queryByText('Active Record')).toBeNull()
      await user.clear(search)

      let row = screen.getByText('Active Record').closest('tr')!
      await user.click(within(row).getByRole('button', { name: 'Edit' }))
      let dialog = within(screen.getByRole('dialog'))
      const name = dialog.getByRole('textbox', { name: surface.nameField })
      await user.clear(name)
      await user.type(name, 'Updated Record')
      await user.click(dialog.getByRole('button', { name: surface.save }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      row = (await screen.findByText('Updated Record')).closest('tr')!

      await user.click(within(row).getByRole('button', { name: 'Archive' }))
      dialog = within(await screen.findByRole('dialog'))
      const confirm = await dialog.findByRole('button', { name: surface.archive })
      expect(requests.filter((request) => request.method === 'delete')).toHaveLength(0)
      await user.click(confirm)
      await waitFor(() => expect(screen.queryByText('Updated Record')).toBeNull())
      expect(records[surface.endpoint].find((record) => record.id === 1)?.isActive).toBe(false)

      await user.click(
        screen.getByRole('button', { name: new RegExp(`^Archived ${surface.tabs}`) }),
      )
      row = (await screen.findByText('Updated Record')).closest('tr')!
      expect(screen.getByText('Archived Record')).toBeTruthy()
      expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
      expect(within(row).queryByRole('button', { name: 'Edit' })).toBeNull()
      await user.click(within(row).getByRole('button', { name: surface.restore }))
      await waitFor(() =>
        expect(records[surface.endpoint].find((record) => record.id === 1)?.isActive).toBe(true),
      )
      await user.click(screen.getByRole('button', { name: new RegExp(`^Active ${surface.tabs}`) }))
      expect(await screen.findByText('Updated Record')).toBeTruthy()
      expect(screen.queryByText('Archived Record')).toBeNull()
      expect(
        requests.filter(
          ({ url, method }) => url === `${surface.endpoint}/1` && method === 'delete',
        ),
      ).toHaveLength(1)
      expect(requests.filter(({ url }) => url === `${surface.endpoint}/1/reactivate`)).toHaveLength(
        1,
      )
    },
  )

  it('retains warehouse stock safeguards and never treats zero stock as archived', async () => {
    warehouseQuantity = '0.05'
    const user = userEvent.setup()
    mount(<WarehouseList />)
    const row = (await screen.findByText('Active Record')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('heading', { name: 'Cannot Archive Warehouse' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Archive Warehouse' })).toBeNull()
    expect(requests.filter(({ method }) => method === 'delete')).toHaveLength(0)
    expect(records['/warehouses'][0].isActive).toBe(true)
  })

  it('preserves read-only customer and warehouse permissions', async () => {
    auth.isAdmin = false
    auth.isStaff = true
    const view = mount(<ClientList />)
    await screen.findByText('Active Record')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    view.unmount()
    mount(<WarehouseList />)
    await screen.findByText('Active Record')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  it('keeps staff account-link information while record tabs identify archived staff', async () => {
    const user = userEvent.setup()
    mount(<EmployeeList />)
    await screen.findByText('Current Staff')
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'User Account' })).toBeTruthy()
    expect(screen.getByText('Linked (ID #9)')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Archived Staff/ }))
    const row = (await screen.findByText('Former Staff')).closest('tr')!
    expect(screen.queryByText('Current Staff')).toBeNull()
    expect(screen.queryByText('Deactivated')).toBeNull()
    await user.click(within(row).getByRole('button', { name: 'Reactivate Profile' }))
    await waitFor(() => expect(records['/employees'][1].isActive).toBe(true))
  })
})
