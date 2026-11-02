import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { CursorLookup } from './CursorLookup'
import { Dialog, DialogContent, DialogTitle } from './dialog'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

it('keeps the current search, selected label, pagination and modal focus despite a late response', async () => {
  let release!: () => void
  let oldSignal: { readonly aborted: boolean } | undefined
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (config.params.q === 'A') {
      oldSignal = config.signal
      await delayed
    }
    const record =
      config.params.q === 'AB'
        ? { id: 2, name: 'Current customer' }
        : { id: 1, name: 'First customer' }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        items: config.params.cursor ? [record, { id: 3, name: 'Later customer' }] : [record],
        nextCursor: !config.params.q && !config.params.cursor ? 'more' : null,
      },
    }
  }
  const submit = vi.fn((event) => event.preventDefault())
  function Harness() {
    const [value, setValue] = useState('')
    const [open, setOpen] = useState(true)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Customer selection</DialogTitle>
          <form onSubmit={submit}>
            <CursorLookup<{ id: number; name: string }>
              id="customer"
              path="/clients"
              value={value}
              label="Customer"
              getLabel={(record) => record.name}
              onChange={setValue}
            />
          </form>
        </DialogContent>
      </Dialog>
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Choose customer' })
  await user.click(trigger)
  await screen.findByRole('menuitem', { name: 'First customer' })
  await user.type(screen.getByRole('searchbox'), 'A')
  await waitFor(() => expect(oldSignal).toBeDefined())
  await user.type(screen.getByRole('searchbox'), 'B')
  await screen.findByRole('menuitem', { name: 'Current customer' })
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => {
    release()
    await delayed
  })
  expect(screen.queryByRole('menuitem', { name: 'First customer' })).toBeNull()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(trigger.textContent).toContain('Current customer')
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole('dialog', { name: 'Customer selection' })).toBeTruthy()
  expect(submit).not.toHaveBeenCalled()
  await user.click(trigger)
  await screen.findByRole('menuitem', { name: 'First customer' })
  await user.click(screen.getByRole('button', { name: 'Load more results' }))
  await screen.findByRole('menuitem', { name: 'Later customer' })
  expect(screen.getAllByRole('menuitem', { name: 'First customer' })).toHaveLength(1)
  await user.keyboard('{Escape}')
  expect(trigger.textContent).toContain('Current customer')
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole('dialog', { name: 'Customer selection' })).toBeTruthy()
  client.clear()
})

it('does not restore an old selected record after the controlled ID changes', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = false
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/clients/1') {
      started = true
      await pending
    }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        id: config.url === '/clients/1' ? 1 : 2,
        name: config.url === '/clients/1' ? 'Old selection' : 'Current selection',
      },
    }
  }
  const client = new QueryClient()
  const props = {
    id: 'customer',
    path: '/clients',
    label: 'Customer',
    getLabel: (record: { id: number; name: string }) => record.name,
    onChange: vi.fn(),
  }
  const view = render(
    <QueryClientProvider client={client}>
      <CursorLookup {...props} value="1" />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(started).toBe(true))
  view.rerender(
    <QueryClientProvider client={client}>
      <CursorLookup {...props} value="2" />
    </QueryClientProvider>,
  )
  await screen.findByText('Current selection')
  await act(async () => {
    release()
    await pending
  })
  expect(screen.queryByText('Old selection')).toBeNull()
  expect(screen.getByRole('button', { name: 'Choose customer' }).textContent).toContain(
    'Current selection',
  )
  client.clear()
})
