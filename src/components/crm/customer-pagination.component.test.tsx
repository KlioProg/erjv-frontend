import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { fetchClientsPageApi } from '@/features/crm/clients.api'
import { ClientList } from './ClientList'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(initialFailure = '') {
  let failure = initialFailure
  let hold: Promise<void> | undefined
  const reads: Record<string, unknown>[] = []
  const writes: string[] = []
  const records = [1, 2, 3].map((id) => ({
    id,
    name: ['Alpha Buyer', 'Beta Buyer', 'Archived Buyer'][id - 1],
    address: 'Davao',
    contactPerson: null,
    phone: null,
    email: null,
    isActive: id !== 3,
  }))
  apiClient.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    let data: unknown
    if (config.method !== 'get') {
      writes.push(config.url!)
      const record = records.find((record) => record.id === Number(config.url!.split('/')[2]))!
      if (config.method === 'post') {
        const created = { ...records[0], ...JSON.parse(config.data), id: 4 }
        records.unshift(created)
        data = created
      } else if (config.method === 'delete') record.isActive = false
      else if (config.url!.endsWith('/reactivate')) record.isActive = true
      else Object.assign(record, JSON.parse(config.data))
      if (config.method !== 'post') data = record
    } else {
      if (config.url?.includes('/search/')) data = []
      else {
        reads.push({ ...params, cursor: params.cursor })
        if (params.q === 'old') await hold
        if (failure === 'first' || (failure === 'cursor' && params.cursor))
          throw new AxiosError('Failed', undefined, config, undefined, {
            config,
            status: 400,
            statusText: '',
            headers: {},
            data: { code: 'INVALID_CURSOR', detail: 'Reload results.' },
          })
        const matches = records.filter(
          (record) =>
            (params.includeInactive === 'true' ||
              record.isActive === (params.includeInactive !== 'only')) &&
            (!params.q ||
              (params.q === 'old'
                ? record.id === 1
                : record.name.toLowerCase().includes(params.q.toLowerCase()))),
        )
        data = {
          items: params.cursor ? matches.slice(1) : matches.slice(0, 1),
          nextCursor: !params.cursor && matches.length > 1 ? 'opaque-next' : null,
        }
      }
    }
    return { config, data: structuredClone(data), headers: {}, status: 200, statusText: 'OK' }
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ClientList />
    </QueryClientProvider>,
  )
  return {
    reads,
    writes,
    client,
    setFailure: (value: string) => {
      failure = value
    },
    setHold: (value: Promise<void>) => {
      hold = value
    },
  }
}
const next = () => screen.getByRole('button', { name: 'Next' })
const previous = () => screen.getByRole('button', { name: 'Previous' })
const search = () => screen.getByRole('textbox', { name: 'Search customers' })

it('loads one page, preserves server ordering, navigates both ways and stops at the last page', async () => {
  const { reads } = mount()
  expect(await screen.findByText('Alpha Buyer')).toBeTruthy()
  expect(reads.some((params) => params.cursor)).toBe(false)
  expect(previous().hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Customer Name' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Active Customers' })).toBeTruthy()
  await userEvent.click(next())
  expect(await screen.findByText('Beta Buyer')).toBeTruthy()
  expect(next().hasAttribute('disabled')).toBe(true)
  expect(reads.at(-1)).toMatchObject({ cursor: 'opaque-next', includeInactive: 'false', limit: 50 })
  await userEvent.click(previous())
  expect(await screen.findByText('Alpha Buyer')).toBeTruthy()
})

it('resets search and archive filters to page one with isolated caches', async () => {
  const { reads } = mount()
  await screen.findByText('Alpha Buyer')
  await userEvent.click(next())
  await screen.findByText('Beta Buyer')
  fireEvent.change(search(), { target: { value: 'Beta' } })
  await screen.findByText('Beta Buyer')
  await waitFor(() => expect(reads.at(-1)).toMatchObject({ q: 'Beta', cursor: undefined }))
  expect(previous().hasAttribute('disabled')).toBe(true)
  fireEvent.change(search(), { target: { value: '' } })
  await screen.findByText('Alpha Buyer')
  await userEvent.click(next())
  await screen.findByText('Beta Buyer')
  await userEvent.click(screen.getByRole('button', { name: 'Archived Customers' }))
  await screen.findByText('Archived Buyer')
  expect(screen.queryByText('Beta Buyer')).toBeNull()
  expect(reads.at(-1)).toMatchObject({ includeInactive: 'only', cursor: undefined })
  await userEvent.click(screen.getByRole('button', { name: 'Active Customers' }))
  await screen.findByText('Alpha Buyer')
  expect(screen.queryByText('Archived Buyer')).toBeNull()
})

it('resets page size without sending a previous cursor', async () => {
  const { reads } = mount()
  await screen.findByText('Alpha Buyer')
  await userEvent.click(next())
  await screen.findByText('Beta Buyer')
  await userEvent.click(screen.getByRole('combobox', { name: 'Customers per page' }))
  await userEvent.click(screen.getByRole('option', { name: '25' }))
  await screen.findByText('Alpha Buyer')
  expect(reads.at(-1)).toMatchObject({ limit: 25, cursor: undefined })
  expect(previous().hasAttribute('disabled')).toBe(true)
})

it.each(['first', 'cursor'])(
  'recovers from a %s page error without automatic cursor retries',
  async (failure) => {
    const state = mount(failure === 'first' ? failure : '')
    if (failure === 'cursor') {
      await screen.findByText('Alpha Buyer')
      state.setFailure('cursor')
      await userEvent.click(next())
    }
    await screen.findByText('Could not load customers')
    expect(next().hasAttribute('disabled')).toBe(true)
    expect(
      state.reads.filter((params) => (failure === 'first' ? params.limit === 50 : params.cursor)),
    ).toHaveLength(1)
    state.setFailure('')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Alpha Buyer')
    expect(previous().hasAttribute('disabled')).toBe(true)
  },
)

it('shows empty search results and clears search without changing archive status', async () => {
  mount()
  await screen.findByText('Alpha Buyer')
  await userEvent.click(screen.getByRole('button', { name: 'Archived Customers' }))
  await screen.findByText('Archived Buyer')
  fireEvent.change(search(), { target: { value: 'missing' } })
  await screen.findByText('No matching customers')
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  await screen.findByText('Archived Buyer')
  expect(next().hasAttribute('disabled')).toBe(true)
})

it('edits and archives the correct later-page customer and refreshes both status lists', async () => {
  const { writes } = mount()
  await screen.findByText('Alpha Buyer')
  await userEvent.click(next())
  await screen.findByText('Beta Buyer')
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  let dialog = within(screen.getByRole('dialog'))
  const name = dialog.getByRole('textbox', { name: /Business \/ Customer Name/ })
  fireEvent.change(name, { target: { value: 'Beta Updated' } })
  await userEvent.click(dialog.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await screen.findByText('Beta Updated')
  expect(writes).toContain('/clients/2/details')
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
  dialog = within(screen.getByRole('dialog'))
  await userEvent.click(dialog.getByRole('button', { name: 'Archive Customer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(screen.queryByText('Beta Updated')).toBeNull())
  expect(writes).toContain('/clients/2')
  await userEvent.click(screen.getByRole('button', { name: 'Archived Customers' }))
  await screen.findByText('Beta Updated')
  await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
  await waitFor(() => expect(screen.queryByText('Beta Updated')).toBeNull())
  expect(writes).toContain('/clients/2/reactivate')
})

it('never replaces new filter results with a delayed old response', async () => {
  const state = mount()
  await screen.findByText('Alpha Buyer')
  let release!: () => void
  state.setHold(
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
  fireEvent.change(search(), { target: { value: 'old' } })
  await waitFor(() => expect(state.reads.some((params) => params.q === 'old')).toBe(true))
  expect(screen.queryByText('Alpha Buyer')).toBeNull()
  fireEvent.change(search(), { target: { value: 'Beta' } })
  await screen.findByText('Beta Buyer')
  await act(async () => {
    release()
  })
  expect(screen.queryByText('Alpha Buyer')).toBeNull()
  expect(screen.getByText('Beta Buyer')).toBeTruthy()
})

it('maps supported client filters and preserves backend order while deduplicating page rows', async () => {
  let params: unknown
  apiClient.defaults.adapter = async (config) => {
    params = config.params
    return {
      config,
      data: { items: [{ id: 8 }, { id: 3 }, { id: 8 }], nextCursor: null },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  const result = await fetchClientsPageApi({
    q: 'Buyer',
    includeInactive: 'true',
    limit: 25,
    cursor: 'opaque',
  })
  expect(params).toEqual({ q: 'Buyer', includeInactive: 'true', limit: 25, cursor: 'opaque' })
  expect(result.items.map((record) => record.id)).toEqual([8, 3])
})

it('refreshes the customer page after registration without changing the active search', async () => {
  const { writes, reads } = mount()
  await screen.findByText('Alpha Buyer')
  fireEvent.change(search(), { target: { value: 'New Buyer' } })
  await screen.findByText('No matching customers')
  await userEvent.click(screen.getByRole('button', { name: 'Register New Customer' }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByRole('textbox', { name: /Business \/ Customer Name/ }), {
    target: { value: 'New Buyer' },
  })
  fireEvent.change(dialog.getByRole('textbox', { name: /Delivery \/ Billing Address/ }), {
    target: { value: 'Davao' },
  })
  await userEvent.click(dialog.getByRole('button', { name: 'Register Customer Profile' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await screen.findByText('New Buyer')
  expect(writes).toContain('/clients')
  expect(reads.filter((params) => params.q === 'New Buyer' && params.includeInactive === 'false').at(-1)).toMatchObject({
    q: 'New Buyer',
    includeInactive: 'false',
  })
  expect(search().getAttribute('value')).toBe('New Buyer')
})
