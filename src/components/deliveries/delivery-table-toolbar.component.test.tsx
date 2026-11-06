import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DataTableFilters } from '@/components/ui/data-table-filters'
import { DeliveryTableToolbar, DeliveryPageFooter } from './DeliveryTableToolbar'

it.each([true, false])('keeps Filters directly beside Search when primary actions are present: %s', (withAction) => {
  render(<DeliveryTableToolbar search="" onSearch={vi.fn()} searchLabel="Search deliveries" placeholder="Search delivery..."
    filters={<DataTableFilters filters={[{ kind: 'select', id: 'status', label: 'Status', value: 'ALL', onChange: vi.fn(), options: [{ value: 'ALL', label: 'All' }] }]} />}>
    {withAction && <button>Plan Outgoing</button>}
  </DeliveryTableToolbar>)
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  const filters = screen.getByRole('button', { name: 'Filters' })
  expect(search.parentElement?.nextElementSibling).toBe(filters)
  expect(filters.hasAttribute('data-table-filter-trigger')).toBe(true)
  if (withAction) expect(filters.nextElementSibling?.contains(screen.getByRole('button', { name: 'Plan Outgoing' }))).toBe(true)
})

it('opens the shared custom filter by keyboard and restores toolbar focus', async () => {
  render(<DataTableFilters filters={[{ kind: 'custom', id: 'warehouse', label: 'Warehouse', active: false, onClear: vi.fn(), content: <label>Warehouse<input /></label> }]} />)
  const trigger = screen.getByRole('button', { name: 'Filters' })
  trigger.focus()
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Warehouse' })))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('shows only page counts, keeps useful cursor controls, and never turns a failure into zero', async () => {
  const setPageSize = vi.fn()
  const query = {
    page: 1,
    pageSize: 50,
    setPageSize,
    hasPrevious: false,
    hasNext: false,
    previous: vi.fn(),
    next: vi.fn(),
    isFetching: false,
    isError: false,
  }
  const view = render(<DeliveryPageFooter query={query} count={1} />)
  expect(screen.getByText('1 delivery on this page')).toBeTruthy()
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  view.rerender(<DeliveryPageFooter query={{ ...query, hasNext: true }} count={2} />)
  expect(screen.getByText('2 deliveries on this page')).toBeTruthy()
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Rows per page' }))
  await user.click(screen.getByRole('option', { name: '10' }))
  expect(setPageSize).toHaveBeenCalledWith(10)
  view.rerender(<DeliveryPageFooter query={{ ...query, isError: true }} count={0} />)
  expect(screen.getByText('Records unavailable')).toBeTruthy()
  expect(screen.queryByText('0 deliveries on this page')).toBeNull()
})

it('composes search and actions in the external management toolbar', async () => {
  const onSearch = vi.fn()
  render(<DeliveryTableToolbar search="" onSearch={onSearch} searchLabel="Search deliveries" placeholder="Search delivery..."><button>Plan Outgoing</button></DeliveryTableToolbar>)
  await userEvent.type(screen.getByRole('textbox', { name: 'Search deliveries' }), 'A')
  expect(onSearch).toHaveBeenCalledWith('A')
  expect(screen.getByRole('button', { name: 'Plan Outgoing' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Filter by warehouse' })).toBeNull()
})
