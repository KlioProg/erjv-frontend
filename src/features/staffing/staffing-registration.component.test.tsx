import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { staffingKeys, useRegisterUser } from './staffing.hooks'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})
it('preserves a created account when optional staff linking fails and explains recovery', async () => {
  const account = { id: 7, email: 'staff@example.test', role: 'STAFF', isActive: true }
  const requests: string[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${config.url}`)
    if (config.url === '/employees/3/user') throw new AxiosError('Staff profile was already linked')
    return { config, status: 201, statusText: 'Created', headers: {}, data: account }
  }
  const warning = vi.spyOn(toast, 'warning').mockReturnValue('warning')
  vi.spyOn(toast, 'success').mockReturnValue('success')
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  client.setQueryData(staffingKeys.users('true'), [])
  const { result } = renderHook(() => useRegisterUser(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        email: account.email,
        password: 'test-password',
        employeeId: 3,
      }),
    ).resolves.toEqual(account)
  })
  expect(requests).toEqual(['post /auth/register', 'patch /employees/3/user'])
  expect(warning).toHaveBeenCalledWith(
    expect.stringMatching(/account.*created.*link/i),
    expect.objectContaining({ description: expect.stringMatching(/Staff Directory/) }),
  )
  expect(client.getQueryState(staffingKeys.users('true'))?.isInvalidated).toBe(true)
})
