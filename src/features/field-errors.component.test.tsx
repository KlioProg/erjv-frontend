import { expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { getApiFieldErrors } from '@/lib/api-client'

it('retains nested DTO paths and normalizes indexed bracket paths without guessing field names', () => {
  const error = new AxiosError('Validation failed', undefined, undefined, undefined, {
    data: { issues: [
      { path: 'loads[1].items[2].loadedQuantity', code: 'INVALID', message: 'Not enough available stock.' },
      { path: 'items.0.returnedDamagedQuantity', code: 'INVALID', message: 'Review damaged returns.' },
      { path: 'reason', code: 'INVALID', message: 'Enter an inspection reason.' },
      { path: 'reason', code: 'OTHER', message: 'Duplicate field issue' },
      { path: 'bad', message: 12 }, null,
    ] }, status: 400, statusText: '', headers: {}, config: {} as never,
  })
  expect(getApiFieldErrors(error)).toEqual({
    'loads.1.items.2.loadedQuantity': 'Not enough available stock.',
    'items.0.returnedDamagedQuantity': 'Review damaged returns.',
    reason: 'Enter an inspection reason.',
  })
  expect(getApiFieldErrors(Error('offline'))).toEqual({})
})
