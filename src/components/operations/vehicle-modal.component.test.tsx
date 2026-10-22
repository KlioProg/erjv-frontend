import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { VehicleModal } from './VehicleModal'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import { AxiosError } from 'axios'
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
