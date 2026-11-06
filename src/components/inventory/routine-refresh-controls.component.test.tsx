import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { StockPagingControls } from './StockPagingControls'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

it('retains stock pagination without a reload action', async () => {
  const fetchNextPage = vi.fn().mockResolvedValue(undefined)
  render(<StockPagingControls hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />)
  expect(screen.queryByRole('button', { name: /reload|refresh/i })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Load more stock records' }))
  expect(fetchNextPage).toHaveBeenCalledOnce()
})

it('does not leave an empty stock toolbar after the last page', () => {
  const { container } = render(<StockPagingControls hasNextPage={false} isFetchingNextPage={false} fetchNextPage={vi.fn()} />)
  expect(container.childElementCount).toBe(0)
})

it.each([false, true])('shows notification Retry only after a load failure: %s', async failed => {
  const retry = vi.fn()
  render(<DropdownMenu open><DropdownMenuTrigger>Notifications</DropdownMenuTrigger>
    <NotificationPanel alerts={[]} isLoading={false} isFetching={false} error={failed ? Error('Offline') : null} onRefresh={retry} onSelect={vi.fn()} />
  </DropdownMenu>)
  expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull()
  if (failed) {
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  } else expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})
