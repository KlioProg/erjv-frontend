import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { manilaScheduleToIso, toManilaSchedule } from '@/lib/manila-schedule'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { DeliveryTimeline } from './DeliveryTimeline'

afterEach(() => vi.restoreAllMocks())

it('displays lifecycle dates in Manila even on a computer using UTC', () => {
  const original = Date.prototype.toLocaleDateString
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
    this: Date,
    locales,
    options,
  ) {
    return original.call(this, locales, { timeZone: 'UTC', ...options })
  })
  render(
    <DeliveryTimeline
      delivery={
        {
          status: 'RECONCILED',
          createdAt: '2026-11-07T02:00:00Z',
          reconciledAt: '2026-11-11T18:17:00Z',
        } as OutgoingDeliveryRecord
      }
      run={{ dispatchedAt: '2026-11-10T18:00:00Z' } as DeliveryRunRecord}
    />,
  )
  const steps = within(screen.getByRole('list', { name: 'Delivery progress' })).getAllByRole(
    'listitem',
  )
  expect(steps[0].textContent).toContain('Draft Created')
  expect(steps[0].textContent).toContain('Nov 7, 2026')
  expect(steps[2].textContent).toContain('Nov 11, 2026')
  expect(steps[3].textContent).toContain('Nov 12, 2026')
})

it.each(['2026-11-10T00:00', '2026-11-11T08:17', '2026-11-11T23:59'])(
  'round trips the selected schedule %s independently of creation time',
  (schedule) => {
    expect(toManilaSchedule(manilaScheduleToIso(schedule))).toBe(schedule)
  },
)
