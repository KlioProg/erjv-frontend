import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { LifecycleProgress } from './LifecycleProgress'

it('lets keyboard users focus the horizontal list to scroll without step-navigation controls', async () => {
  const user = userEvent.setup()
  render(
    <LifecycleProgress
      label="Delivery milestones"
      milestones={[
        { id: 'prepare', label: 'Preparing', state: 'current' },
        { id: 'arrive', label: 'Arrived', state: 'upcoming' },
      ]}
    />,
  )
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Delivery milestones' }))
  expect(screen.queryByRole('button')).toBeNull()
})

it('names an ordered lifecycle and exposes explicit state without adding interactive controls', () => {
  render(
    <LifecycleProgress
      label="Shipment lifecycle"
      milestones={[
        { id: 'prepare', label: 'Prepared', state: 'complete' },
        { id: 'send', label: 'In Transit', state: 'current' },
        { id: 'receive', label: 'Received', state: 'upcoming' },
      ]}
    />,
  )
  const list = screen.getByRole('list', { name: 'Shipment lifecycle' })
  const items = within(list).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual([
    'Prepared — Completed',
    'In Transit — Current',
    'Received — Upcoming',
  ])
  expect(items[1].getAttribute('aria-current')).toBe('step')
  expect(items[0].hasAttribute('aria-current')).toBe(false)
  expect(items[2].hasAttribute('aria-current')).toBe(false)
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('does not infer previous completion from a later current milestone', () => {
  render(
    <LifecycleProgress
      label="Partial fulfillment"
      milestones={[
        { id: 'goods', label: 'All goods delivered', state: 'upcoming' },
        { id: 'review', label: 'Review recorded results', state: 'current' },
      ]}
    />,
  )
  expect(screen.getAllByRole('listitem')[0].textContent).toBe('All goods delivered — Upcoming')
  expect(screen.queryByText(/Completed/)).toBeNull()
})

it('shows cancellation explicitly without implying a successful terminal milestone', () => {
  const view = render(
    <LifecycleProgress
      label="Order lifecycle"
      milestones={[
        { id: 'draft', label: 'Draft', state: 'complete' },
        { id: 'cancel', label: 'Cancelled', state: 'cancelled' },
        { id: 'deliver', label: 'Delivered', state: 'upcoming' },
      ]}
    />,
  )
  const items = screen.getAllByRole('listitem')
  expect(items[1].textContent).toBe('Cancelled')
  expect(items[2].textContent).toBe('Delivered — Upcoming')
  expect(view.container.querySelector('[aria-current]')).toBeNull()
  view.rerender(<LifecycleProgress label="Order lifecycle" milestones={[]} />)
  expect(screen.queryByRole('list')).toBeNull()
})
