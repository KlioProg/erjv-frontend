import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { WarehouseModal } from './WarehouseModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('guards duplicate submissions while the warehouse name lookup is pending', async () => {
  let finishLookup!: () => void
  const lookup = new Promise<void>((resolve) => {
    finishLookup = resolve
  })
  const requests: string[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${config.url}`)
    if (config.method === 'get') await lookup
    return {
      config,
      data: config.method === 'get' ? null : { id: 1, name: 'Hub' },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <WarehouseModal warehouse={null} open onClose={onClose} />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/Warehouse Name/), 'Hub')
  await user.type(screen.getByLabelText(/Street Address/), 'Davao')
  const button = screen.getByRole('button', { name: 'Register Warehouse' })
  const form = button.closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(requests).toEqual(['get /warehouses/name/Hub']))
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => {
    finishLookup()
  })
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(requests.filter((request) => request === 'post /warehouses')).toHaveLength(1)
})

it('keeps unsaved warehouse entries until discard is confirmed', async () => {
  const onClose = vi.fn()
  const queryClient = new QueryClient()
  render(<QueryClientProvider client={queryClient}><WarehouseModal warehouse={null} open onClose={onClose} /></QueryClientProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/Warehouse Name/), 'Unsaved Hub')
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect((screen.getByLabelText(/Warehouse Name/) as HTMLInputElement).value).toBe('Unsaved Hub')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Discard Changes' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps an archived warehouse restore failure visible and allows retry', async () => {
  let rejectRestore = true
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch' && rejectRestore) throw new Error('Restore rejected')
    return {
      config,
      data: { id: 1, name: 'Hub', isActive: false },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <WarehouseModal warehouse={null} open onClose={onClose} />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/Warehouse Name/), 'Hub')
  await user.type(screen.getByLabelText(/Street Address/), 'Davao')
  await user.click(screen.getByRole('button', { name: 'Register Warehouse' }))
  await user.click(await screen.findByRole('button', { name: 'Reactivate Warehouse Facility' }))
  expect(await screen.findByText('Restore rejected.')).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
  rejectRestore = false
  await user.click(screen.getByRole('button', { name: 'Reactivate Warehouse Facility' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
