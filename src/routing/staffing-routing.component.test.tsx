import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from '@/App'
import { apiClient } from '@/lib/api-client'
import { NAV_ITEM_KEYS, routeForScreen } from '@/routes'

const originalAdapter = apiClient.defaults.adapter
let role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'UNKNOWN'
let requests: string[]

beforeEach(() => {
  localStorage.clear()
  role = 'ADMIN'
  requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${config.url}`)
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data:
        config.url === '/auth/login'
          ? { accessToken: 'routing-test-token' }
          : config.url === '/auth/profile'
            ? {
                id: 1,
                email: 'admin@example.test',
                fullName: 'Routing Admin',
                role,
                isActive: true,
                createdAt: '2026-10-01',
                updatedAt: '2026-10-01',
              }
            : [],
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

function mount(path: string, authenticated = true) {
  window.history.replaceState(null, '', path)
  if (authenticated) localStorage.setItem('erjv_access_token', 'routing-test-token')
  return render(<App />)
}

const staffing = [
  ['/staff-directory', 'Staff Directory', '/employees'],
  ['/job-positions', 'Job Positions', '/jobs'],
  ['/user-roles', 'User Roles & Access', '/users'],
] as const

it.each(staffing)(
  'loads %s directly for an admin and selects its sidebar entry',
  async (path, title, endpoint) => {
    mount(path)
    await screen.findByRole('heading', { name: title })
    const link = screen.getByRole('link', { name: title })
    expect(link.getAttribute('href')).toBe(path)
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(requests).toContain(`get ${endpoint}`)
  },
)

it.each(staffing)(
  'allows managers to visit %s while preserving account-management restrictions',
  async (path, title) => {
    role = 'MANAGER'
    mount(path)
    await screen.findByRole('heading', { name: title })
    if (path === '/user-roles') {
      expect(screen.queryByRole('button', { name: /Register User/ })).toBeNull()
    }
  },
)

it.each(staffing)(
  'redirects staff away from %s without mounting or fetching HR records',
  async (path, title) => {
    role = 'STAFF'
    mount(path)
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(window.location.pathname).toBe('/inventory')
    expect(screen.queryByRole('heading', { name: title })).toBeNull()
    expect(screen.queryByRole('link', { name: title })).toBeNull()
    expect(requests.some((request) => /^get \/(employees|jobs|users)/.test(request))).toBe(false)
  },
)

it.each(['/', '/staff-directory', '/job-positions', '/user-roles'])(
  'does not grant an unrecognized role access at %s',
  async (path) => {
    role = 'UNKNOWN'
    mount(path)
    expect((await screen.findByRole('alert')).textContent).toContain('Access denied')
    expect(
      screen.queryByRole('heading', { name: /Staff Directory|Job Positions|User Roles/ }),
    ).toBeNull()
    expect(requests.some((request) => /^get \/(employees|jobs|users)/.test(request))).toBe(false)
  },
)

it.each(['ADMIN', 'MANAGER', 'STAFF'] as const)(
  'keeps the existing permitted Inventory landing page for %s',
  async (value) => {
    role = value
    mount('/')
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(window.location.pathname).toBe('/inventory')
  },
)

it.each([
  ['employees', 'Staff Directory'],
  ['jobs', 'Job Positions'],
  ['users', 'User Roles & Access'],
])('redirects the legacy %s bookmark to its canonical route', async (key, title) => {
  mount(`/legacy/${key}`)
  await screen.findByRole('heading', { name: title })
  expect(window.location.pathname).toBe(routeForScreen(key as 'employees' | 'jobs' | 'users'))
})

it('navigates HR and other modules with browser history while preserving sidebar and header nodes', async () => {
  const user = userEvent.setup()
  mount('/staff-directory')
  await screen.findByRole('heading', { name: 'Staff Directory' })
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  const header = screen.getAllByRole('banner')[0]
  for (const title of [
    'Job Positions',
    'User Roles & Access',
    'Customers',
    'Purchase Orders',
    'Inventory',
  ]) {
    await user.click(within(navigation).getByRole('link', { name: title }))
    await screen.findByRole('heading', { name: title })
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBe(navigation)
    expect(header.isConnected).toBe(true)
  }
  window.history.back()
  await screen.findByRole('heading', { name: 'Purchase Orders' })
  window.history.forward()
  await screen.findByRole('heading', { name: 'Inventory' })
  expect(requests.every((request) => request.startsWith('get '))).toBe(true)
})

it('preserves the login gate, requested URL after sign-in, and logout behavior', async () => {
  const user = userEvent.setup()
  mount('/staff-directory', false)
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  expect(requests).toHaveLength(0)
  await user.type(screen.getByLabelText('Email address'), 'admin@example.test')
  await user.type(screen.getByLabelText('Password'), 'routing-test-password')
  await user.click(screen.getByRole('button', { name: /Sign in/i }))
  await screen.findByRole('heading', { name: 'Staff Directory' })
  expect(window.location.pathname).toBe('/staff-directory')
  await user.click(screen.getByRole('button', { name: 'Account menu' }))
  await user.click(await screen.findByRole('menuitem', { name: /Log out|Sign out/i }))
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(localStorage.getItem('erjv_access_token')).toBeNull()
})

it('has a canonical non-legacy route for every current navigation key', () => {
  for (const key of NAV_ITEM_KEYS) expect(routeForScreen(key)).not.toContain('/legacy/')
})

it('loads a staffing URL again after a fresh application mount', async () => {
  const first = mount('/job-positions')
  await screen.findByRole('heading', { name: 'Job Positions' })
  first.unmount()
  mount('/job-positions')
  await screen.findByRole('heading', { name: 'Job Positions' })
  expect(window.location.pathname).toBe('/job-positions')
  expect(requests.filter((request) => request === 'get /auth/profile')).toHaveLength(2)
})

it('keeps expired sessions at login without displaying or fetching the protected page', async () => {
  localStorage.setItem('erjv_session_expiry', String(Date.now() - 1000))
  mount('/user-roles')
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(screen.queryByRole('heading', { name: 'User Roles & Access' })).toBeNull()
  expect(requests).toHaveLength(0)
  expect(localStorage.getItem('erjv_access_token')).toBeNull()
})

it('offers a functional home link for unknown URLs', async () => {
  mount('/unknown-route')
  await screen.findByRole('heading', { name: 'Page not found' })
  await userEvent.setup().click(screen.getByRole('link', { name: 'Go to home' }))
  await waitFor(() => expect(window.location.pathname).toBe('/inventory'))
})
