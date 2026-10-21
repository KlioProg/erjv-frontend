import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AuthProvider, normalizeUserRole, useAuth } from './AuthContext'
import { apiClient } from '@/lib/api-client'
import { AxiosError } from 'axios'

const originalAdapter = apiClient.defaults.adapter
beforeEach(() => {
  localStorage.clear()
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data:
      config.url === '/auth/login'
        ? { accessToken: 'test-session-token' }
        : { id: 2, email: 'staff@example.test', role: 'STAFF', isActive: true },
  })
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  localStorage.clear()
})
function SessionControls() {
  const auth = useAuth()
  return (
    <>
      <p>
        {auth.isLoading ? 'Loading session' : auth.isAuthenticated ? 'Signed in' : 'Signed out'}
      </p>
      <p>{auth.user?.role}</p>
      <p>{auth.isAdmin ? 'Account administration enabled' : 'Account administration disabled'}</p>
      <button
        onClick={() => void auth.login({ email: 'staff@example.test', password: 'test-password' })}
      >
        Sign in
      </button>
      <button onClick={auth.logout}>Sign out</button>
    </>
  )
}
function mount(client: QueryClient) {
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SessionControls />
      </AuthProvider>
    </QueryClientProvider>,
  )
}
it('clears cached records when signing out', async () => {
  const user = userEvent.setup()
  localStorage.setItem('erjv_access_token', 'test-session-token')
  const client = new QueryClient()
  client.setQueryData(['employees'], [{ id: 1, name: 'Previous account private record' }])
  mount(client)
  await screen.findByText('Signed in')
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(client.getQueryData(['employees'])).toBeUndefined()
  expect(localStorage.getItem('erjv_access_token')).toBeNull()
})
it('clears prior account data before a new session can reuse query keys', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  client.setQueryData(['clients'], [{ id: 1, name: 'Previous account customer' }])
  mount(client)
  await screen.findByText('Signed out')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText('Signed in')
  await waitFor(() => expect(client.getQueryData(['clients'])).toBeUndefined())
})

it('preserves SUPERADMIN identity and grants existing administrator navigation', async () => {
  expect(normalizeUserRole('SUPERADMIN')).toBe('SUPERADMIN')
  localStorage.setItem('erjv_access_token', 'test-session-token')
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { id: 1, email: 'super@example.test', role: 'SUPERADMIN', isActive: true },
  })
  mount(new QueryClient())
  await screen.findByText('SUPERADMIN')
  expect(screen.getByText('Account administration enabled')).toBeTruthy()
})

it.each(['unavailable', 'missing', 'inactive'])(
  'does not establish a session from an %s profile',
  async (scenario) => {
    const client = new QueryClient()
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/profile' && scenario === 'unavailable')
        throw new Error('Network Error')
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data:
          config.url === '/auth/login'
            ? { accessToken: `header.${btoa(JSON.stringify({ id: 2, role: 'ADMIN' }))}.signature` }
            : scenario === 'missing'
              ? null
              : { id: 2, role: 'ADMIN', isActive: false },
      }
    }
    await act(async () => {
      await expect(
        result.current.login({ email: 'staff@example.test', password: 'test-password' }),
      ).rejects.toThrow()
    })
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('erjv_access_token')).toBeNull()
  },
)

it('loads the server profile once during a successful login', async () => {
  let profiles = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/auth/profile') profiles++
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data:
        config.url === '/auth/login'
          ? { accessToken: 'test-session-token' }
          : { id: 2, email: 'staff@example.test', role: 'STAFF', isActive: true },
    }
  }
  mount(new QueryClient())
  await screen.findByText('Signed out')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText('Signed in')
  expect(profiles).toBe(1)
})

it('synchronizes only the signed-in account after an authoritative role update', async () => {
  localStorage.setItem('erjv_access_token', 'test-session-token')
  const client = new QueryClient()
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  })
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  const updated = {
    id: 2,
    email: 'staff@example.test',
    role: 'ADMIN' as const,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }
  act(() => result.current.syncUser(updated))
  expect(result.current.isAdmin).toBe(true)
  act(() => result.current.syncUser({ ...updated, id: 3, role: 'STAFF' }))
  expect(result.current.user?.role).toBe('ADMIN')
})

it('clears a revoked session and its cached records after a protected request returns 401', async () => {
  localStorage.setItem('erjv_access_token', 'test-session-token')
  const client = new QueryClient()
  mount(client)
  await screen.findByText('Signed in')
  client.setQueryData(['clients'], [{ id: 1 }])
  apiClient.defaults.adapter = async (config) => {
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: {},
    })
  }
  await act(async () => {
    await expect(apiClient.get('/clients')).rejects.toThrow('Unauthorized')
  })
  expect(screen.getByText('Signed out')).toBeTruthy()
  expect(localStorage.getItem('erjv_access_token')).toBeNull()
  expect(client.getQueryData(['clients'])).toBeUndefined()
})

it('does not let a late 401 response erase a newer session token', async () => {
  localStorage.setItem('erjv_access_token', 'old-session')
  apiClient.defaults.adapter = async (config) => {
    localStorage.setItem('erjv_access_token', 'new-session')
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: {},
    })
  }
  await expect(apiClient.get('/clients')).rejects.toThrow('Unauthorized')
  expect(localStorage.getItem('erjv_access_token')).toBe('new-session')
})
