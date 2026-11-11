import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { IncomingDeliveryStatusBadge } from './IncomingDeliveryDetailModal'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DirectoryStatusBadge } from '@/components/ui/DirectoryRowControls'
import { VehicleStatusBadge } from './VehicleStatusBadge'

it('uses existing theme colors for neutral and cancelled states', () => {
  render(
    <>
      <StatusBadge label="Draft transfer" tone="neutral" appearance="emphasis" />
      <StatusBadge label="Cancelled transfer" tone="destructive" appearance="emphasis" />
    </>,
  )
  expect(
    screen
      .getByText('Draft transfer')
      .closest('[data-slot="badge"]')
      ?.classList.contains('bg-muted'),
  ).toBe(true)
  expect(
    screen
      .getByText('Cancelled transfer')
      .closest('[data-slot="badge"]')
      ?.classList.contains('text-destructive'),
  ).toBe(true)
})

it('distinguishes awaiting receipt from in-transit deliveries', () => {
  render(
    <>
      <IncomingDeliveryStatusBadge status="SCHEDULED" />
      <DeliveryStatusBadge status="DISPATCHED" />
    </>,
  )
  const incoming = screen.getByText('Awaiting Receipt').closest('[data-slot="badge"]')!
  const outgoing = screen.getByText('Dispatched').closest('[data-slot="badge"]')!
  expect(
    incoming
      .querySelector('[data-slot="status-dot"]')
      ?.classList.contains('bg-status-info-foreground'),
  ).toBe(true)
  expect(
    outgoing
      .querySelector('[data-slot="status-dot"]')
      ?.classList.contains('bg-status-warning-foreground'),
  ).toBe(true)
  for (const badge of [incoming, outgoing]) expect(badge.classList.contains('bg-muted')).toBe(true)
})

it('keeps Ready distinct from dispatched status and preserves completed outcomes', () => {
  render(
    <>
      <DeliveryStatusBadge status="READY" runId={4} />
      <DeliveryStatusBadge status="RECONCILED" />
      <IncomingDeliveryStatusBadge status="COMPLETED" />
    </>,
  )
  expect(
    screen.getByText('Ready').closest('[data-slot="badge"]')?.classList.contains('bg-muted'),
  ).toBe(true)
  for (const label of ['Completed', 'Received'])
    expect(
      screen
        .getByText(label)
        .closest('[data-slot="badge"]')
        ?.querySelector('[data-slot="status-dot"]')
        ?.classList.contains('bg-status-success-foreground'),
    ).toBe(true)
})

it('keeps short and long statuses content-sized inside a column layout', () => {
  render(
    <div className="flex flex-col">
      <DeliveryStatusBadge status="READY" />
      <StatusBadge label="A long status that can wrap within the available space" />
    </div>,
  )
  for (const label of ['Ready', 'A long status that can wrap within the available space']) {
    const badge = screen.getByText(label).closest('[data-slot="badge"]')!
    expect(badge.classList.contains('w-fit')).toBe(true)
    expect(badge.classList.contains('max-w-full')).toBe(true)
    expect(badge.classList.contains('whitespace-normal')).toBe(true)
    expect(badge.querySelector('[data-slot="status-dot"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  }
})

it('shares the Sales Order subtle treatment for active directories and vehicle states', () => {
  render(
    <>
      <DirectoryStatusBadge isActive />
      <DirectoryStatusBadge isActive={false} inactiveLabel="Archived" />
      <VehicleStatusBadge status="AVAILABLE" />
      <VehicleStatusBadge status="MAINTENANCE" />
    </>,
  )
  for (const label of ['Active', 'Archived', 'Available', 'Maintenance']) {
    const badge = screen.getByText(label).closest('[data-slot="badge"]')!
    expect(badge.classList.contains('bg-muted')).toBe(true)
    expect(badge.querySelector('[data-slot="status-dot"]')).toBeTruthy()
  }
  for (const label of ['Active', 'Available'])
    expect(
      screen
        .getByText(label)
        .closest('[data-slot="badge"]')
        ?.querySelector('[data-slot="status-dot"]')
        ?.classList.contains('bg-status-success-foreground'),
    ).toBe(true)
})
