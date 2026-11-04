import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { IncomingDeliveryStatusBadge } from './IncomingDeliveryDetailModal'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'

it('uses existing theme colors for neutral and cancelled states', () => {
  render(<><StatusBadge label="Draft transfer" tone="neutral" appearance="emphasis" /><StatusBadge label="Cancelled transfer" tone="destructive" appearance="emphasis" /></>)
  expect(screen.getByText('Draft transfer').closest('[data-slot="badge"]')?.classList.contains('bg-muted')).toBe(true)
  expect(screen.getByText('Cancelled transfer').closest('[data-slot="badge"]')?.classList.contains('text-destructive')).toBe(true)
})

it('distinguishes awaiting receipt from in-transit deliveries', () => {
  render(<><IncomingDeliveryStatusBadge status="SCHEDULED" /><DeliveryStatusBadge status="DISPATCHED" /></>)
  const incoming = screen.getByText('Awaiting Receipt').closest('[data-slot="badge"]')!
  const outgoing = screen.getByText('In Transit').closest('[data-slot="badge"]')!
  expect(incoming.classList.contains('bg-status-info')).toBe(true)
  expect(outgoing.classList.contains('bg-status-warning')).toBe(true)
  for (const badge of [incoming, outgoing])
    expect(badge.querySelector('[data-slot="status-dot"]')?.getAttribute('aria-hidden')).toBe('true')
})

it('keeps run assignment distinct from dispatch and preserves reconciliation labels', () => {
  render(<><DeliveryStatusBadge status="READY" runId={4} /><DeliveryStatusBadge status="RECONCILED" /><IncomingDeliveryStatusBadge status="COMPLETED" /></>)
  expect(screen.getByText('Assigned to Run').closest('[data-slot="badge"]')?.classList.contains('bg-status-info')).toBe(true)
  for (const label of ['Completed', 'Received'])
    expect(screen.getByText(label).closest('[data-slot="badge"]')?.classList.contains('bg-status-success')).toBe(true)
})
