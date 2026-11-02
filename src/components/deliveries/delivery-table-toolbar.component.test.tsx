import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DeliveryHeaderFilter } from './DeliveryHeaderFilter'
import { DeliveryTableToolbar, DeliveryPageFooter } from './DeliveryTableToolbar'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
  vi.restoreAllMocks()
})

it.each([1440, 1366, 768, 390])('anchors filters within a %ipx viewport and restores keyboard focus when dismissed', async (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
  render(
    <DeliveryHeaderFilter label="Warehouse" active={false} onClear={vi.fn()}>
      <label>Warehouse<input /></label>
    </DeliveryHeaderFilter>,
  )
  const trigger = screen.getByRole('button', { name: 'Filter by warehouse' })
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
  trigger.focus()
  await user.keyboard('{Enter}')
  const panel = screen.getByRole('dialog', { name: 'Filter by warehouse' })
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Warehouse' })),
  )
  expect(panel.style.width).toBe('288px')
  expect(panel.style.left).toBe('72px')
  expect(panel.style.top).toBe('208px')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  fireEvent(window, new Event('resize'))
  expect(panel.style.width).toBe('288px')
  expect(panel.style.left).toBe('16px')
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
