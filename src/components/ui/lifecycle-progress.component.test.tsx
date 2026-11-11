import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { LifecycleProgress } from './LifecycleProgress'

it('renders one separate horizontal segment above each stage label', () => {
  const milestones = [
    { id: 'draft', label: 'Draft', state: 'complete' as const },
    { id: 'confirm', label: 'Confirmed', state: 'current' as const },
    { id: 'receive', label: 'Receiving', state: 'upcoming' as const },
    { id: 'received', label: 'Received', state: 'upcoming' as const },
  ]
  const view = render(<LifecycleProgress label="Purchase lifecycle" milestones={milestones} />)
  const items = screen.getAllByRole('listitem')
  const list = screen.getByRole('list', { name: 'Purchase lifecycle' })
  expect(list.classList.contains('grid')).toBe(true)
  expect(list.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))')
  expect(list.classList.contains('w-full')).toBe(true)
  expect(view.container.querySelectorAll('[data-slot="lifecycle-segment"]')).toHaveLength(4)
  items.forEach((item, index) => {
    const segment = item.querySelector('[data-slot="lifecycle-segment"]')!
    expect(item.firstElementChild).toBe(segment)
    expect(segment.getAttribute('data-state')).toBe(milestones[index].state)
    expect(segment.getAttribute('aria-hidden')).toBe('true')
    expect(item.textContent).toContain(milestones[index].label)
  })
  expect(view.container.querySelector('svg, circle')).toBeNull()
})

it('keeps the stage description keyboard-focusable without step-navigation controls', async () => {
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
  expect(screen.getByRole('list').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
  expect(items[2].textContent).toBe('Delivered — Upcoming')
  expect(view.container.querySelector('[aria-current]')).toBeNull()
  view.rerender(<LifecycleProgress label="Order lifecycle" milestones={[]} />)
  expect(screen.queryByRole('list')).toBeNull()
})

it('lets a single terminal segment use the full available width', () => {
  render(
    <LifecycleProgress
      label="Cancelled purchase"
      milestones={[{ id: 'cancelled', label: 'Cancelled', state: 'cancelled' }]}
    />,
  )
  expect(screen.getByRole('list').style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')
  expect(screen.getByRole('listitem').className).not.toMatch(/min-w-24|max-w-32/)
})

it('keeps recorded milestone details below the label without changing the segment layout', () => {
  render(
    <LifecycleProgress
      label="Recorded delivery dates"
      milestones={[
        { id: 'draft', label: 'Draft Created', state: 'complete', detail: 'Nov 7, 2026, 12:17 AM' },
        { id: 'ready', label: 'Ready', state: 'current' },
      ]}
    />,
  )
  const items = screen.getAllByRole('listitem')
  expect(items[0].lastElementChild?.textContent).toBe('Nov 7, 2026, 12:17 AM')
  expect(items[1].children).toHaveLength(2)
  expect(screen.getByRole('list').style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
})
