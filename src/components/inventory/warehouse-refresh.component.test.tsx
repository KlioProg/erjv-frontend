import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { WarehouseInventory } from '@/components/operations/WarehouseInventory'
import type { Warehouse } from '@/features/logistics/warehouses.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: false, isStaff: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

function setup(initialFailure = false) {
  let gate: Promise<void> | undefined
  let failed = initialFailure
  const stock = {
    id: 1,
    inventoryItemId: 1,
    warehouseId: 1,
    onHandQuantity: '5',
    availableQuantity: '5',
    quarantinedQuantity: '0',
    stockStatus: 'UNCONFIGURED',
    inventoryItem: { id: 1, name: 'Main rice', unit: 'kg' },
  }
  apiClient.defaults.adapter = async (config) => {
    await gate
    if (failed)
      throw { isAxiosError: true, response: { status: 503, data: { message: 'Unavailable' } } }
    const other = config.url?.endsWith('/2')
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        items: [
          {
            ...stock,
            ...(other
              ? {
                  id: 2,
                  warehouseId: 2,
                  inventoryItem: { ...stock.inventoryItem, name: 'Other rice' },
                }
              : {}),
          },
        ],
        nextCursor: null,
      },
    }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const element = (id: number) => (
    <QueryClientProvider client={client}>
      <WarehouseInventory
        warehouse={{ id, name: id === 1 ? 'Main' : 'Other', isActive: true } as Warehouse}
        onBack={vi.fn()}
      />
    </QueryClientProvider>
  )
  const view = render(element(1))
  return {
    client,
    stock,
    setFailure: (value: boolean) => {
      failed = value
    },
    hold: () => {
      let release!: () => void
      gate = new Promise<void>((resolve) => {
        release = resolve
      })
      return () => {
        release()
        gate = undefined
      }
    },
    changeWarehouse: (id: number) => view.rerender(element(id)),
  }
}

it('keeps warehouse rows on refresh and refresh failure, then recovers on Retry', async () => {
  const state = setup()
  const product = await screen.findByText('Main rice')
  const release = state.hold()
  let refreshed!: Promise<void>
  act(() => {
    refreshed = state.client.invalidateQueries({ queryKey: ['stock-items'] })
  })
  await screen.findByText('Updating warehouse stock...')
  expect(product.isConnected).toBe(true)
  state.setFailure(true)
  await act(async () => {
    release()
    await refreshed
  })
  await screen.findByText(/Latest warehouse stock update could not be retrieved/)
  expect(product.isConnected).toBe(true)
  state.setFailure(false)
  state.stock.onHandQuantity = '8'
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(screen.getByText('8')).toBeTruthy()
})

it('shows initial loading for a new warehouse without displaying another warehouse stock', async () => {
  const state = setup()
  await screen.findByText('Main rice')
  const release = state.hold()
  state.changeWarehouse(2)
  expect(screen.queryByText('Main rice')).toBeNull()
  expect(screen.getByRole('status').textContent).toContain('Loading warehouse inventory')
  await act(async () => {
    release()
  })
  await screen.findByText('Other rice')
  expect(screen.queryByText('Main rice')).toBeNull()
})

it('shows an initial error without fake stock rows and recovers', async () => {
  const state = setup(true)
  await screen.findByRole('alert')
  expect(screen.queryByRole('table')).toBeNull()
  state.setFailure(false)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Main rice')
})
