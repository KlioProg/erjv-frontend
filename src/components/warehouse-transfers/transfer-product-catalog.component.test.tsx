import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import type { WarehouseTransfer } from '@/features/warehouse-transfers/warehouse-transfers.types'
import { TransferDraftForm } from './TransferForms'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false, isStaff: false }),
}))

const original = apiClient.defaults.adapter
const products = [
  { id: 10, name: 'Rice', variety: 'Premium', unit: 'kg', isActive: true },
  { id: 11, name: 'Empty', unit: 'kg', isActive: true },
  { id: 12, name: 'Unknown', unit: 'kg', isActive: true },
  { id: 13, name: 'Archived', unit: 'kg', isActive: false },
  { id: 14, name: 'Corn', unit: 'sacks', isActive: true },
  { id: 15, name: 'Partial', unit: 'kg', isActive: true },
]
let reads: { url: string; params: Record<string, unknown> }[]
let failure: boolean
let emptyFirstPage: boolean
let gate: Promise<void> | undefined
let blockedWarehouse: number
const stock = (id: number, warehouseId = 1, availableQuantity = '109.75') => ({
  id,
  inventoryItemId: id,
  warehouseId,
  availableQuantity,
  onHandQuantity: '999',
  inTransitQuantity: '100',
  quarantinedQuantity: '50',
  inventoryItem: products.find((product) => product.id === id),
})
const overstockedDraft: WarehouseTransfer = {
  id: 7,
  transferNumber: 'WT-000007',
  revision: 1,
  status: 'DRAFT',
  sourceWarehouseId: 1,
  destinationWarehouseId: 2,
  scheduledDepartureAt: null,
  notes: null,
  items: [
    {
      id: 70,
      warehouseTransferId: 7,
      inventoryItemId: 10,
      quantity: '150.00',
      sourceStockItemId: null,
      destinationStockItemId: null,
      discrepancyReason: null,
      receivedQuantity: null,
      damagedQuantity: null,
      returnedSellableQuantity: null,
      returnedDamagedQuantity: null,
      missingQuantity: null,
    },
  ],
}
beforeEach(() => {
  reads = []
  failure = false
  emptyFirstPage = false
  gate = undefined
  blockedWarehouse = 2
  apiClient.defaults.adapter = async (config) => {
    reads.push({ url: config.url!, params: config.params ?? {} })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/warehouses')
      data = {
        items: [
          { id: 1, name: 'Main', isActive: true },
          { id: 2, name: 'Other', isActive: true },
          { id: 3, name: 'Remote', isActive: true },
        ],
        nextCursor: null,
      }
    if (config.url?.startsWith('/inventory-items/'))
      data = products.find((product) => product.id === Number(config.url!.split('/').at(-1)))
    if (config.url?.startsWith('/stock-items/warehouses/')) {
      if (failure) throw Error('Offline')
      const warehouseId = Number(config.url.split('/').at(-1))
      if (warehouseId === blockedWarehouse) await gate
      data = config.params?.q
        ? { items: [], nextCursor: null }
        : warehouseId === 2
          ? { items: [stock(10, 2, '2.50'), stock(15, 2, '0.50')], nextCursor: null }
          : config.params?.cursor
            ? { items: [stock(14)], nextCursor: null }
            : {
                items: [
                  stock(11, 1, '0'),
                  stock(12, 1, 'invalid'),
                  stock(13),
                  ...(emptyFirstPage ? [] : [stock(10)]),
                ],
                nextCursor: 'page-2',
              }
    }
    if (config.url?.startsWith('/stock-items/pair/')) {
      const [, , , product, warehouse] = config.url.split('/')
      if (warehouse === '2') await gate
      data = stock(
        Number(product),
        Number(warehouse),
        product === '15' ? '0.50' : warehouse === '2' ? '2.50' : '109.75',
      )
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(record?: WarehouseTransfer) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TransferDraftForm record={record} onSaved={vi.fn()} onCancel={vi.fn()} onBusy={vi.fn()} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
async function chooseSource(user: ReturnType<typeof userEvent.setup>, name = 'Main') {
  await user.click(screen.getByRole('button', { name: 'Choose from warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name }))
}
async function chooseDestination(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Choose to warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name }))
}

it('waits for a source, disables zero or unknown stock, and adds a unique line', async () => {
  const user = mount()
  expect(screen.getByText('Choose a Source Warehouse')).toBeTruthy()
  expect(reads.some((read) => read.url.startsWith('/stock-items/'))).toBe(false)
  await chooseSource(user)
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
  const selected = within(screen.getByRole('region', { name: 'Selected Items' }))
  expect(selected.getByText('Rice')).toBeTruthy()
  expect(selected.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Product',
    'Available',
    'Quantity',
    'Remove',
  ])
  expect(screen.getByRole('textbox', { name: 'Quantity for item 1' }).getAttribute('value')).toBe(
    '1',
  )
  expect(screen.getByRole('button', { name: 'Add Rice' }).hasAttribute('disabled')).toBe(false)
  const addEmpty = screen.getByRole('button', { name: 'Add Empty' })
  expect(addEmpty.hasAttribute('disabled')).toBe(true)
  expect(addEmpty.parentElement?.getAttribute('aria-label')).toBe('No stock available.')
  const noStockGroup = screen.getByRole('group', { name: 'No stock available.' })
  act(() => noStockGroup.focus())
  expect(screen.getByRole('tooltip').textContent).toBe('No stock available.')
  expect(screen.getByRole('button', { name: 'Add Unknown' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Add Archived' })).toBeNull()
  expect(selected.getByText('109.75 kg')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Remove Rice' }))
  expect(screen.queryByRole('textbox', { name: 'Quantity for item 1' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Add Rice' }).hasAttribute('disabled')).toBe(false)
})

it('keeps pagination usable when the current page has no transferable products', async () => {
  emptyFirstPage = true
  const user = mount()
  await chooseSource(user)
  await screen.findByRole('button', { name: 'Add Empty' })
  expect(screen.getByRole('button', { name: 'Add Empty' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Add Unknown' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await user.click(await screen.findByRole('button', { name: 'Add Corn' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Search available products' }), {
    target: { value: 'Missing' },
  })
  await screen.findByText('No matching products')
  const latest = reads.filter((read) => read.url === '/stock-items/warehouses/1').at(-1)
  expect(latest?.params).toEqual({ q: 'Missing', limit: 50 })
  expect(
    within(screen.getByRole('region', { name: 'Selected Items' })).getByText('Corn'),
  ).toBeTruthy()
})

it('confirms source changes before clearing items and loads the new warehouse catalog', async () => {
  const user = mount()
  await chooseDestination(user, 'Remote')
  await chooseSource(user)
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
  await user.clear(screen.getByRole('textbox', { name: 'Quantity for item 1' }))
  await user.type(screen.getByRole('textbox', { name: 'Quantity for item 1' }), '3.75')
  await user.type(screen.getByRole('textbox', { name: 'Notes (optional)' }), 'Keep sealed')

  await chooseSource(user, 'Main')
  expect(screen.queryByRole('heading', { name: 'Change Source Warehouse?' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Quantity for item 1' }).getAttribute('value')).toBe(
    '3.75',
  )

  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await chooseSource(user, 'Other')
  expect(screen.getByRole('heading', { name: 'Change Source Warehouse?' })).toBeTruthy()
  expect(screen.getByText('Changing the warehouse will clear your selected items.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect(screen.getByRole('textbox', { name: 'Quantity for item 1' }).getAttribute('value')).toBe(
    '3.75',
  )
  expect(reads.some((read) => read.url === '/stock-items/warehouses/2')).toBe(false)

  await chooseSource(user, 'Other')
  await user.click(screen.getByRole('button', { name: 'Change Warehouse' }))
  const selected = within(screen.getByRole('region', { name: 'Selected Items' }))
  expect(selected.getByText('No products selected. Add products from Available Products.')).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: 'Quantity for item 1' })).toBeNull()
  expect((screen.getByRole('textbox', { name: 'Notes (optional)' }) as HTMLTextAreaElement).value)
    .toBe('Keep sealed')
  expect(screen.getByRole('button', { name: 'Choose to warehouse' }).textContent).toContain(
    'Remote',
  )
  expect(screen.queryByText('109.75 kg')).toBeNull()
  expect(screen.getByText('Loading warehouse products...')).toBeTruthy()
  await act(async () => release())
  await screen.findByRole('button', { name: 'Add Rice' })
  expect(screen.getByText('2.5 kg')).toBeTruthy()
  expect(selected.getByText('No products selected. Add products from Available Products.')).toBeTruthy()
  expect(reads.some((read) => read.url === '/stock-items/warehouses/2' && read.params.cursor)).toBe(
    false,
  )
})

it('clears the destination only when it becomes the new source warehouse', async () => {
  const user = mount()
  await chooseDestination(user, 'Other')
  await chooseSource(user, 'Main')
  expect(screen.getByRole('button', { name: 'Choose to warehouse' }).textContent).toContain('Other')

  await chooseSource(user, 'Other')
  expect(screen.queryByRole('heading', { name: 'Change Source Warehouse?' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Choose to warehouse' }).textContent).toContain(
    'Choose to warehouse',
  )
})

it('does not show delayed catalog results from the previous source warehouse', async () => {
  blockedWarehouse = 1
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const user = mount()
  await chooseSource(user, 'Main')
  expect(screen.getByText('Loading warehouse products...')).toBeTruthy()

  await chooseSource(user, 'Other')
  expect(screen.queryByRole('heading', { name: 'Change Source Warehouse?' })).toBeNull()
  await screen.findByRole('button', { name: 'Add Rice' })
  expect(screen.getByText('2.5 kg')).toBeTruthy()

  await act(async () => release())
  expect(screen.getByText('2.5 kg')).toBeTruthy()
  expect(screen.queryByText('109.75 kg')).toBeNull()
})

it('keeps saved drafts unchanged until the edited form is saved', async () => {
  const user = mount(overstockedDraft)
  await user.click(screen.getByRole('button', { name: 'Choose from warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Remote' }))
  await user.click(screen.getByRole('button', { name: 'Change Warehouse' }))
  expect(reads.some((read) => read.url.startsWith('/warehouse-transfers/'))).toBe(false)
})

it('offers an actual retry without presenting failed stock as zero or empty', async () => {
  failure = true
  const user = mount()
  await chooseSource(user)
  await screen.findByText(/Could not load warehouse stock/)
  expect(screen.queryByText('No Available Products')).toBeNull()
  failure = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('button', { name: 'Add Rice' })
})

it.each(['', '0', '-1', '1.001'])(
  'validates quantity %j before writing a draft',
  async (quantity) => {
    const user = mount()
    await chooseSource(user)
    await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
    await user.click(screen.getByRole('button', { name: 'Choose to warehouse' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Other' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantity for item 1' }), {
      target: { value: quantity },
    })
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Quantity for item 1' }).getAttribute('aria-invalid'),
      ).toBe('true'),
    )
    expect(screen.getByRole('button', { name: 'Save Transfer' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(reads.some((read) => read.url === '/warehouse-transfers')).toBe(false)
  },
)

it('stops catalog increments at fractional availability and accepts a valid manual decimal', async () => {
  const user = mount()
  await chooseSource(user, 'Other')
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
  expect((screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement).value)
    .toBe('1')
  await user.click(screen.getByRole('button', { name: 'Add Rice' }))
  expect((screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement).value)
    .toBe('2.00')
  const add = screen.getByRole('button', { name: 'Add Rice' })
  expect(add.hasAttribute('disabled')).toBe(true)
  expect(add.parentElement?.getAttribute('aria-label')).toBe('Maximum available quantity selected.')
  const quantity = screen.getByRole('textbox', { name: 'Quantity for item 1' })
  fireEvent.change(quantity, { target: { value: '2.5' } })
  expect((quantity as HTMLInputElement).value).toBe('2.5')
  expect(quantity.getAttribute('aria-invalid')).toBe('false')
  expect(screen.queryByText('Cannot exceed 2.5 kg.')).toBeNull()
})

it('preserves fractional starting quantities below one unit', async () => {
  const user = mount()
  await chooseSource(user, 'Other')
  await user.click(await screen.findByRole('button', { name: 'Add Partial' }))
  const quantity = screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement
  expect(quantity.value).toBe('0.5')
  expect(screen.getByRole('button', { name: 'Add Partial' }).hasAttribute('disabled')).toBe(true)
})

it('preserves an existing overstocked draft and validates changed quantities for correction', async () => {
  mount(overstockedDraft)
  const quantity = await screen.findByRole('textbox', { name: 'Quantity for item 1' })
  await within(screen.getByRole('region', { name: 'Selected Items' })).findByText('109.75 kg')
  expect((quantity as HTMLInputElement).value).toBe('150.00')
  expect(screen.getByRole('button', { name: 'Save Transfer' }).hasAttribute('disabled')).toBe(false)
  expect(screen.queryByText(/Current stock is insufficient/)).toBeNull()

  fireEvent.change(quantity, { target: { value: '200' } })
  expect(screen.getByText('Cannot exceed 109.75 kg.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Save Transfer' }).hasAttribute('disabled')).toBe(true)

  fireEvent.change(quantity, { target: { value: '100' } })
  expect(quantity.getAttribute('aria-invalid')).toBe('false')
  expect(screen.getByRole('button', { name: 'Save Transfer' }).hasAttribute('disabled')).toBe(false)
})

it('increments the same line with decimal-safe arithmetic and keeps keyboard focus and tooltips', async () => {
  const user = mount()
  await chooseSource(user)
  const initialAdd = await screen.findByRole('button', { name: 'Add Rice' })
  expect(initialAdd.closest('td')).toBe(initialAdd.closest('tr')?.firstElementChild)
  act(() => initialAdd.focus())
  expect(screen.getByRole('tooltip').textContent).toBe('Add or increment Rice')
  await user.keyboard('{Enter}{Enter}{Enter}')
  const quantity = screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement
  expect(quantity.value).toBe('3.00')
  expect(document.activeElement).toBe(initialAdd)
  expect(screen.getAllByRole('textbox', { name: /Quantity for item/ })).toHaveLength(1)
  fireEvent.change(quantity, { target: { value: '2.75' } })
  await user.click(screen.getByRole('button', { name: 'Add Rice' }))
  expect(quantity.value).toBe('3.75')
  const remove = screen.getByRole('button', { name: 'Remove Rice' })
  act(() => remove.focus())
  expect(screen.getByRole('tooltip').textContent).toBe('Remove Rice')
  expect(remove.textContent).toBe('')
  fireEvent.change(quantity, { target: { value: '9999999999.99' } })
  expect(quantity.style.width).toBe('14ch')
  expect(screen.getByRole('button', { name: 'Add Rice' }).hasAttribute('disabled')).toBe(true)
})

it('removes only the chosen line and allows it to be added again', async () => {
  const user = mount()
  await chooseSource(user)
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Quantity for item 1' }), {
    target: { value: '4.25' },
  })
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await user.click(await screen.findByRole('button', { name: 'Add Corn' }))
  await user.click(screen.getByRole('button', { name: 'Remove Corn' }))
  expect(
    (screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement).value,
  ).toBe('4.25')
  expect(screen.getAllByRole('textbox', { name: /Quantity for item/ })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Add Corn' }))
  expect(
    (screen.getByRole('textbox', { name: 'Quantity for item 2' }) as HTMLInputElement).value,
  ).toBe('1')
  expect(reads.some((read) => read.url === '/warehouse-transfers')).toBe(false)
})

it.each(['', '0', '-1', '1.001', '9999999999.99'])(
  'does not increment invalid or overflowing quantity %j',
  async (quantity) => {
    const user = mount()
    await chooseSource(user)
    await user.click(await screen.findByRole('button', { name: 'Add Rice' }))
    const input = screen.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: quantity } })
    expect(input.value).toBe(quantity)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('button', { name: 'Add Rice' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/decimal|greater than zero|exceed/)
  },
)
