import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { VehicleList } from './VehicleList'

const access = vi.hoisted(() => ({ isAdmin: false, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => access }))
vi.mock('@/lib/use-cursor-page', () => ({
  useResourcePage: () => ({
    items: [],
    isError: false,
    isFetching: false,
    hasPrevious: false,
    hasNext: false,
    page: 1,
    pageSize: 50,
    setPageSize: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    reload: vi.fn(),
  }),
}))
vi.mock('@/lib/use-records-by-id', () => ({
  useRecordsById: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('@/features/logistics/delivery-vehicles.hooks', () => ({
  useDeactivateVehicle: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReactivateVehicle: () => ({ isPending: false, mutate: vi.fn() }),
  useUpdateVehicleStatus: () => ({ isPending: false, mutate: vi.fn() }),
}))

afterEach(() => {
  access.isAdmin = false
  access.isManager = false
})

it.each([
  ['administrator', true, false, true],
  ['manager', false, true, true],
  ['staff', false, false, false],
])('%s can discover Add Vehicle only when authorized', (_, isAdmin, isManager, visible) => {
  access.isAdmin = isAdmin
  access.isManager = isManager
  render(
    <MemoryRouter>
      <VehicleList />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('button', { name: 'Add Vehicle' }) !== null).toBe(visible)
})
