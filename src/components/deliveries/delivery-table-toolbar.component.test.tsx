import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DeliveryTableToolbar, DeliveryPageFooter } from './DeliveryTableToolbar'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
  vi.restoreAllMocks()
})

it('anchors filters within the viewport and restores keyboard focus when dismissed', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
  render(
    <DeliveryTableToolbar
      search=""
      onSearch={vi.fn()}
      searchLabel="Search deliveries"
      placeholder="Search deliveries"
      primaryFilter={<button>Status</button>}
      filters={
        <label>
          Warehouse
          <input />
        </label>
      }
      activeCount={0}
      onClear={vi.fn()}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Filters' })
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    top: 160,
    bottom: 200,
    left: 280,
    right: 360,
    width: 80,
    height: 40,
    x: 280,
    y: 160,
    toJSON: () => ({}),
  })
  const user = userEvent.setup()
  await user.click(trigger)
  const panel = screen.getByRole('dialog', { name: 'Filters' })
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Warehouse' })),
  )
  expect(panel.style.width).toBe('358px')
  expect(panel.style.left).toBe('16px')
  expect(panel.style.top).toBe('208px')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  fireEvent(window, new Event('resize'))
  expect(panel.style.width).toBe('288px')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
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
  expect(screen.queryByRole('navigation')).toBeNull()
  view.rerender(<DeliveryPageFooter query={{ ...query, hasNext: true }} count={2} />)
  expect(screen.getByText('2 deliveries on this page')).toBeTruthy()
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Deliverys per page' }))
  await user.click(screen.getByRole('option', { name: '10' }))
  expect(setPageSize).toHaveBeenCalledWith(10)
  view.rerender(<DeliveryPageFooter query={{ ...query, isError: true }} count={0} />)
  expect(screen.getByText('Records unavailable')).toBeTruthy()
  expect(screen.queryByText('0 deliveries on this page')).toBeNull()
})
