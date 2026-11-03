import { afterEach, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { AuthProvider, useAuth } from './AuthContext'
import { tokenExpiry, passwordError } from './session'
import { loginApi, registerApi } from './auth.api'
import { updateUserPasswordApi } from '@/features/staffing/staffing.api'
import { apiClient } from '@/lib/api-client'
import { testToken } from '@/test/auth-token'

it.each(['😀😀😀😀', '❤️❤️❤️❤️'])(
  'rejects fewer than eight backend-counted characters despite eight UTF-16 units: %s',
  (password) => {
    expect(passwordError(password)).not.toBeNull()
  },
)
it.each(['😀😀😀😀😀😀😀😀', '❤️❤️❤️❤️❤️❤️❤️❤️'])(
  'accepts eight backend-counted characters within the UTF-8 byte limit: %s',
  (password) => {
    expect(passwordError(password)).toBeNull()
  },
)

it('ignores a late profile rejection from the session replaced by a successful login', async () => {
  const oldToken = testToken({ ver: 1 })
  const newToken = testToken({ ver: 2 })
  localStorage.setItem('erjv_access_token', oldToken)
  let rejectOld: (() => void) | undefined
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/login'))
      return { config, status: 200, statusText: 'OK', headers: {}, data: { accessToken: newToken } }
    if (config.headers.Authorization === `Bearer ${oldToken}`)
      return new Promise((_, reject) => {
        rejectOld = () =>
          reject(
            new AxiosError('Revoked', 'ERR_BAD_REQUEST', config, undefined, {
              config,
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              data: {},
            }),
          )
      })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { id: 2, role: 'ADMIN', isActive: true },
    }
  }
  const hook = mount()
  await waitFor(() => expect(rejectOld).toBeTypeOf('function'))
  await act(async () =>
    hook.result.current.login({ email: 'admin@example.test', password: 'password123' }),
  )
  await act(async () => rejectOld!())
  expect(hook.result.current.user?.id).toBe(2)
  expect(hook.result.current.isAuthenticated).toBe(true)
  expect(localStorage.getItem('erjv_access_token')).toBe(newToken)
})

const adapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = adapter
  localStorage.clear()
  vi.restoreAllMocks()
})
function mount() {
  const client = new QueryClient()
  client.setQueryData(['financial-reports', 'private'], { amount: '1.00' })
  const hook = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  })
  return { ...hook, client }
}
it.each([
  'broken',
  testToken({ exp: 0 }),
  testToken({ ver: undefined }),
  testToken({ iat: undefined }),
  testToken({ exp: undefined }),
])('rejects invalid/legacy/expired stored token %s without querying', async (token) => {
  const request = vi.fn()
  apiClient.defaults.adapter = request
  localStorage.setItem('erjv_access_token', token)
  const { result, client } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.isAuthenticated).toBe(false)
  expect(request).not.toHaveBeenCalled()
  expect(client.getQueryData(['financial-reports', 'private'])).toBeUndefined()
  expect(localStorage.getItem('erjv_access_token')).toBeNull()
})
it('uses actual expiry, ignores obsolete local expiry, and signs out after expiry on focus', async () => {
  const token = testToken({ exp: Math.floor(Date.now() / 1000) + 600 })
  localStorage.setItem('erjv_access_token', token)
  localStorage.setItem('erjv_session_expiry', '1')
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { id: 1, role: 'ADMIN', isActive: true },
  })
  const { result, client } = mount()
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  client.setQueryData(['financial-reports', 'private'], { amount: '1.00' })
  vi.spyOn(Date, 'now').mockReturnValue(tokenExpiry(token)! + 1)
  act(() => window.dispatchEvent(new Event('focus')))
  expect(result.current.isAuthenticated).toBe(false)
  expect(client.getQueryData(['financial-reports', 'private'])).toBeUndefined()
})
it('keeps a valid session after a forbidden action', async () => {
  localStorage.setItem('erjv_access_token', testToken())
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { id: 1, role: 'MANAGER', isActive: true },
  })
  const { result } = mount()
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  apiClient.defaults.adapter = async (config) => {
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      data: {},
    })
  }
  await act(async () => {
    await expect(apiClient.get('/financial-reports/sales')).rejects.toThrow('Forbidden')
  })
  expect(result.current.isAuthenticated).toBe(true)
  expect(localStorage.getItem('erjv_access_token')).not.toBeNull()
})
it('honors server expiry during remembered login without modifying the password', async () => {
  const token = testToken({ exp: Math.floor(Date.now() / 1000) + 301 })
  const password = '  pass word  '
  const request = vi.fn(async (config) => {
    if (config.url === '/auth/login') expect(JSON.parse(config.data).password).toBe(password)
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data:
        config.url === '/auth/login'
          ? { accessToken: token }
          : { id: 1, role: 'ADMIN', isActive: true },
    }
  })
  apiClient.defaults.adapter = request
  const { result } = mount()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => {
    await result.current.login({ email: 'admin@example.test', password }, true)
  })
  expect(Number(localStorage.getItem('erjv_session_expiry'))).toBe(tokenExpiry(token))
  expect(localStorage.getItem('erjv_remember_me')).toBe('true')
})
it('checks UTF-8 byte lengths on login, registration and password replacement', async () => {
  expect(passwordError('a'.repeat(72))).toBeNull()
  expect(passwordError('é'.repeat(36))).toBeNull()
  expect(passwordError('é'.repeat(37))).toMatch(/72/)
  expect(passwordError('1234567')).toMatch(/8/)
  const request = vi.fn()
  apiClient.defaults.adapter = request
  await expect(loginApi({ email: 'a@example.test', password: 'é'.repeat(37) })).rejects.toThrow(
    /72/,
  )
  await expect(
    registerApi({ email: 'a@example.test', password: 'é'.repeat(37), role: 'STAFF' }),
  ).rejects.toThrow(/72/)
  await expect(updateUserPasswordApi(1, 'é'.repeat(37))).rejects.toThrow(/72/)
  expect(request).not.toHaveBeenCalled()
})
