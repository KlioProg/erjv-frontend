import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { VehicleModal } from './VehicleModal'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import { AxiosError, getAdapter } from 'axios'
import { updateVehicleDetailsApi } from '@/features/logistics/delivery-vehicles.api'

const originalAdapter = apiClient.defaults.adapter

it('blocks vehicle creation when the plate lookup fails', async () => {
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.includes('/plate-number/')) throw new AxiosError('Network Error')
    if (config.method === 'post') writes.push({ method: 'post', data: JSON.parse(config.data) })
    return { config, status: 200, statusText: 'OK', headers: {}, data: [] }
  }
  mount(null)
  await userEvent.setup().type(screen.getByLabelText(/Plate Number/), 'ABC-1234')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Add Vehicle' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/connect|network/i)
  expect(writes).toEqual([])
})

it('preserves explicit null when clearing vehicle capacity', async () => {
  await updateVehicleDetailsApi(1, { capacity: null })
  expect(writes[0].data).toEqual({ capacity: null })
})
let saved: DeliveryVehicle | null
let writes: { method: string; data: Record<string, unknown> }[]

beforeEach(() => {
  saved = null
  writes = []
  // Exercise the real hooks and API serializers against a test-only transport.
  apiClient.defaults.adapter = async (config) => {
    let data: unknown
    if (config.url?.includes('/plate-number/')) data = null
    else if (config.method === 'post' || config.method === 'patch') {
      const payload = JSON.parse(config.data)
      writes.push({ method: config.method, data: payload })
      saved = {
        id: 1,
        status: 'AVAILABLE',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        model: null,
        capacity: null,
        ...saved,
        ...payload,
      }
      data = saved
    } else data = saved ? [saved] : []
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function mount(vehicle: DeliveryVehicle | null, onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    ...render(
      <QueryClientProvider client={client}>
        <VehicleModal open vehicle={vehicle} onClose={onClose} />
      </QueryClientProvider>,
    ),
    onClose,
  }
}

it('preserves all predefined types and submits a predefined selection through the existing API', async () => {
  const user = userEvent.setup()
  const view = mount(null)
  await user.type(screen.getByLabelText(/Plate Number/), 'ABC-1234')
  await user.click(screen.getByRole('button', { name: 'Vehicle Type' }))
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Heavy Truck (6-Wheeler)',
    'Light Truck (4-Wheeler)',
    'Delivery Van',
    'Cargo Multicab',
    'Cargo Motorcycle',
  ])
  await user.click(screen.getByRole('menuitem', { name: 'Delivery Van' }))
  await user.click(screen.getByRole('button', { name: 'Add Vehicle' }))
  await waitFor(() => expect(view.onClose).toHaveBeenCalledOnce())
  expect(writes[0]).toMatchObject({
    method: 'post',
    data: { plateNumber: 'ABC-1234', vehicleType: 'Delivery Van' },
  })
})

it('submits a normalized custom type, displays it when editing, and saves a replacement', async () => {
  const user = userEvent.setup()
  const view = mount(null)
  await user.type(screen.getByLabelText(/Plate Number/), 'NEW-1234')
  await user.click(screen.getByRole('button', { name: 'Vehicle Type' }))
  await user.type(screen.getByRole('searchbox'), '  Refrigerated   Truck  ')
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button', { name: 'Vehicle Type' }).textContent).toContain(
    'Refrigerated Truck',
  )
  await user.click(screen.getByRole('button', { name: 'Add Vehicle' }))
  await waitFor(() => expect(view.onClose).toHaveBeenCalledOnce())
  expect(writes[0]).toMatchObject({ method: 'post', data: { vehicleType: 'Refrigerated Truck' } })
  view.unmount()
  const edit = mount(saved)
  expect(screen.getByRole('button', { name: 'Vehicle Type' }).textContent).toContain(
    'Refrigerated Truck',
  )
  await user.click(screen.getByRole('button', { name: 'Vehicle Type' }))
  await user.type(screen.getByRole('searchbox'), 'Flatbed Truck')
  await user.click(screen.getByRole('menuitem', { name: 'Use "Flatbed Truck"' }))
  await user.click(screen.getByRole('button', { name: 'Save Vehicle' }))
  await waitFor(() => expect(edit.onClose).toHaveBeenCalledOnce())
  expect(writes[1]).toMatchObject({ method: 'patch', data: { vehicleType: 'Flatbed Truck' } })
})

function plateLookupFailure(status: number, code?: string) {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.includes('/plate-number/'))
      throw new AxiosError('Lookup failed', undefined, config, undefined, {
        status,
        statusText: '',
        headers: {},
        config,
        data: {
          code,
          message: 'Delivery vehicle not found',
          details: { resource: 'Delivery vehicle' },
        },
      })
    return base(config)
  }
}

it('creates a new vehicle when the backend explicitly reports that its plate does not exist', async () => {
  plateLookupFailure(404, 'RESOURCE_NOT_FOUND')
  const user = userEvent.setup()
  const view = mount(null)
  await user.type(screen.getByLabelText(/Plate Number/), 'new-1234')
  await user.click(screen.getByRole('button', { name: 'Add Vehicle' }))
  await waitFor(() => expect(view.onClose).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      method: 'post',
      data: {
        plateNumber: 'NEW-1234',
        vehicleType: 'Heavy Truck (6-Wheeler)',
        status: 'AVAILABLE',
        isActive: true,
      },
    },
  ])
})

it.each([
  [401, 'RESOURCE_NOT_FOUND'],
  [403, 'RESOURCE_NOT_FOUND'],
  [500, 'RESOURCE_NOT_FOUND'],
  [404, undefined],
])('blocks creation for an unexpected lookup failure (%s, %s)', async (status, code) => {
  plateLookupFailure(status as number, code as string | undefined)
  const user = userEvent.setup()
  const view = mount(null)
  await user.type(screen.getByLabelText(/Plate Number/), 'ABC-1234')
  await user.click(screen.getByRole('button', { name: 'Add Vehicle' }))
  await screen.findByRole('alert')
  expect(view.onClose).not.toHaveBeenCalled()
  expect(writes).toEqual([])
})

it.each([true, false])(
  'preserves duplicate handling for an existing vehicle (active: %s)',
  async (isActive) => {
    saved = {
      id: 9,
      plateNumber: 'ABC-1234',
      vehicleType: 'Delivery Van',
      isActive,
      status: 'AVAILABLE',
      model: null,
      capacity: null,
      createdAt: '',
      updatedAt: '',
    }
    const base = getAdapter(apiClient.defaults.adapter)
    apiClient.defaults.adapter = (config) =>
      config.url?.includes('/plate-number/')
        ? Promise.resolve({ config, data: saved, status: 200, statusText: 'OK', headers: {} })
        : base(config)
    const user = userEvent.setup()
    const view = mount(null)
    await user.type(screen.getByLabelText(/Plate Number/), 'ABC-1234')
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }))
    if (isActive) expect((await screen.findByRole('alert')).textContent).toContain('already active')
    else expect(await screen.findByRole('button', { name: 'Restore Vehicle' })).toBeTruthy()
    expect(view.onClose).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  },
)

it.each(['-1', '1.234', 'bad', '10000000000'])(
  'marks invalid capacity %s immediately and never rounds it into a request',
  async (capacity) => {
    mount(null)
    const input = screen.getByLabelText('Payload Capacity (kg)')
    fireEvent.change(input, { target: { value: capacity } })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect((input as HTMLInputElement).value).toBe(capacity)
    expect(screen.getByRole('button', { name: 'Add Vehicle' }).hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(0)
  },
)
