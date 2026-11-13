import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { StatusBadge } from './StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Button } from './button'

it('keeps routine status labels readable independently of semantic dots and emphasis', () => {
  const labels = [
    'Draft',
    'Confirmed',
    'Preparing',
    'Scheduled',
    'In Transit',
    'Completed',
    'Cancelled',
  ]
  render(
    <>
      {labels.map((label) => (
        <StatusBadge key={label} label={label} />
      ))}
      <StatusBadge label="Quantity needs review" tone="warning" appearance="emphasis" />
    </>,
  )
  for (const label of [...labels, 'Quantity needs review']) {
    const badge = screen.getByText(label).closest('[data-slot="badge"]')!
    expect(badge.textContent).toBe(label)
    expect(badge.querySelector('[data-slot="status-dot"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  }
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps long status labels on one line for horizontally scrollable tables', () => {
  render(<StatusBadge label="AwaitingReconciliationReview" />)

  const label = screen.getByText('AwaitingReconciliationReview')
  const badge = label.closest('[data-slot="badge"]')!
  expect(badge.className).toContain('whitespace-nowrap')
  expect(badge.className).toContain('w-max')
  expect(label.className).toContain('whitespace-nowrap')
})

it('retains caller descriptions and node labels without duplicating status announcements', () => {
  render(
    <>
      <p id="receipt-note">Waiting for the destination receipt.</p>
      <StatusBadge
        label={<span>In Transit</span>}
        aria-describedby="receipt-note"
        showDot={false}
      />
    </>,
  )
  const badge = screen.getByText('In Transit').closest('[data-slot="badge"]')!
  expect(badge.getAttribute('aria-describedby')).toBe('receipt-note')
  expect(badge.querySelector('[data-slot="status-dot"]')).toBeNull()
})

it('keeps record identity, description and contextual action in an accessible dialog', async () => {
  const user = userEvent.setup()
  const save = vi.fn()
  render(
    <Dialog>
      <DialogTrigger asChild>
        <Button>Review saved record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record SO-001</DialogTitle>
          <DialogDescription>Review quantities before saving.</DialogDescription>
        </DialogHeader>
        <p>Ordered quantity: 5 bags</p>
        <DialogFooter>
          <Button onClick={save}>Save Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  )
  const trigger = screen.getByRole('button', { name: 'Review saved record' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Record SO-001' })
  expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'Save Draft' }))
  expect(save).toHaveBeenCalledTimes(1)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
