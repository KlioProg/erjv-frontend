import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import { VehicleList } from './VehicleList'

const access = vi.hoisted(() => ({ isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => access }))
const original = apiClient.defaults.adapter
let requests: { url?: string; method?: string; params: Record<string, unknown> }[]
let paged: boolean
const vehicles: DeliveryVehicle[] = [22, 44, 66].map((id) => ({
  id, plateNumber: `ABC-${id}`, model: `Truck ${id}`, vehicleType: 'Truck', capacityKg: '1500.00',
  operationalStatus: 'SERVICEABLE', isAvailable: true, activeRunId: null, isActive: id !== 66,
  createdAt: '', updatedAt: '',
}))
beforeEach(() => {
  access.isAdmin = true; access.isManager = false; requests = []; paged = false
  apiClient.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    requests.push({ url: config.url, method: config.method, params })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url?.startsWith('/delivery-vehicles')) {
      let matches = vehicles.filter((vehicle) => params.includeInactive === 'only' ? !vehicle.isActive : vehicle.isActive)
      if (params.q) matches = matches.filter((vehicle) => `${vehicle.plateNumber} ${vehicle.model}`.includes(params.q))
      data = { items: paged && !params.q ? matches.slice(params.cursor ? 1 : 0, params.cursor ? 2 : 1) : matches,
        nextCursor: paged && !params.q && !params.cursor ? 'vehicle-page-2' : null }
    }
    return { config, data, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => { apiClient.defaults.adapter = original })
function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: {
    queries: { retry: false }, mutations: { retry: false },
  } })}><MemoryRouter><VehicleList /></MemoryRouter></QueryClientProvider>)
}
const writes = () => requests.filter((request) => request.method !== 'get')

it.each(['plate', 'row', 'Enter', 'Space'])('opens the same vehicle by %s using its saved ID without mutations', async (method) => {
  mount()
  const link = await screen.findByRole('button', { name: 'View vehicle ABC-44' })
  if (method === 'plate') await userEvent.click(link)
  else if (method === 'row') fireEvent.click(within(link.closest('tr')!).getByText('Truck 44'))
  else { link.focus(); await userEvent.keyboard(method === 'Space' ? ' ' : '{Enter}') }
  expect(await screen.findByRole('dialog', { name: 'ABC-44' })).toBeTruthy()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  await waitFor(() => expect(requests.some((request) => request.url === '/delivery-runs' && request.params.deliveryVehicleId === 44)).toBe(true))
  expect(writes()).toHaveLength(0)
})

it('keeps only one plate-opening control per vehicle and no eye or duplicate menu entry', async () => {
  mount()
  await screen.findByRole('button', { name: 'View vehicle ABC-22' })
  expect(screen.getAllByRole('button', { name: /^View vehicle/ })).toHaveLength(2)
  expect(document.querySelector('.lucide-eye')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Actions for ABC-22' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('menuitem', { name: 'Edit Vehicle' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Archive Vehicle' })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: /View/ })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it.each(['Edit Vehicle', 'Archive Vehicle'])('opens %s without also opening vehicle details', async (action) => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Actions for ABC-22' }))
  const item = await screen.findByRole('menuitem', { name: action })
  await waitFor(() => expect(item.getAttribute('aria-disabled')).not.toBe('true'))
  await userEvent.click(item)
  expect(await screen.findByRole('dialog', { name: action })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'ABC-22' })).toBeNull()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(writes()).toHaveLength(0)
})

it('opens archived vehicles and retains the authorized Restore action', async () => {
  mount()
  await userEvent.click(screen.getByRole('button', { name: 'Archived Vehicles' }))
  const link = await screen.findByRole('button', { name: 'View vehicle ABC-66' })
  await userEvent.click(screen.getByRole('button', { name: 'Actions for ABC-66' }))
  expect(screen.getByRole('menuitem', { name: 'Restore Vehicle' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(link)
  expect(await screen.findByRole('dialog', { name: 'ABC-66' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('permits read-only inspection without exposing management actions', async () => {
  access.isAdmin = false; mount()
  const link = await screen.findByRole('button', { name: 'View vehicle ABC-22' })
  expect(screen.queryByRole('button', { name: /Actions for/ })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add Vehicle' })).toBeNull()
  await userEvent.click(link)
  expect(await screen.findByRole('dialog', { name: 'ABC-22' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('preserves cursor paging, search, availability filtering and the fleet summary', async () => {
  paged = true; mount()
  await screen.findByRole('button', { name: 'View vehicle ABC-22' })
  expect(screen.getByLabelText('Fleet status overview')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'View vehicle ABC-44' })
  expect(requests.some((request) => request.params.cursor === 'vehicle-page-2')).toBe(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search vehicles' }), { target: { value: 'ABC-22' } })
  await screen.findByRole('button', { name: 'View vehicle ABC-22' })
  expect(screen.queryByRole('button', { name: 'View vehicle ABC-44' })).toBeNull()
  expect(requests.some((request) => request.params.q === 'ABC-22' && !request.params.cursor)).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
  await userEvent.click(screen.getByRole('combobox', { name: 'Availability' }))
  await userEvent.click(screen.getByRole('option', { name: 'Available for trip' }))
  await waitFor(() => expect(requests.some((request) => request.url === '/delivery-vehicles/available')).toBe(true))
  expect(writes()).toHaveLength(0)
})
