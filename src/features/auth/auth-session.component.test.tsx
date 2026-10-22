import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { apiClient } from '@/lib/api-client'

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
