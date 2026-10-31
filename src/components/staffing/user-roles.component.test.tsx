import { apiClient } from '@/lib/api-client'
import { afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { UserRolesList } from './UserRolesList'

const state = vi.hoisted(() => ({
  guardReady: true,
  isAdmin: true,
  role: 'ADMIN',
  mutateAsync: vi.fn(),
  syncUser: vi.fn(),
}))
vi.mock('@/features/auth/AuthContext', async (original) => ({
  ...(await original<typeof import('@/features/auth/AuthContext')>()),
  useAuth: () => ({
    isAdmin: state.isAdmin,
    user: { id: 2, role: state.role },
    syncUser: state.syncUser,
  }),
}))
vi.mock('./RegisterUserModal', () => ({ RegisterUserModal: () => null }))
vi.mock('@/features/staffing/staffing.hooks', () => ({
  useAllUsers: () => ({
    isFetching: !state.guardReady,
    data: [
      {
        id: 1,
        email: 'super@example.test',
        role: 'SUPERADMIN',
        isActive: true,
        createdAt: '2026-10-01',
      },
      {
        id: 2,
        email: 'admin@example.test',
        role: 'ADMIN',
        isActive: true,
        createdAt: '2026-10-01',
      },
      {
        id: 3,
        email: 'staff@example.test',
        role: 'STAFF',
        isActive: true,
        createdAt: '2026-10-01',
      },
    ],
  }),
  useEmployees: () => ({ data: [] }),
  useUpdateUserRole: () => ({ mutateAsync: state.mutateAsync }),
  useDeactivateUser: () => ({ isPending: false }),
  useReactivateUser: () => ({ isPending: false }),
}))
const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })
beforeEach(() => {
  apiClient.defaults.adapter = async config => ({ config, status: 200, statusText: '', headers: {}, data: { items: [{ id: 1, email: 'super@example.test', role: 'SUPERADMIN', isActive: true, createdAt: '2026-10-01' }, { id: 2, email: 'admin@example.test', role: 'ADMIN', isActive: true, createdAt: '2026-10-01' }, { id: 3, email: 'staff@example.test', role: 'STAFF', isActive: true, createdAt: '2026-10-01' }], nextCursor: null } })
  state.guardReady = true
  state.isAdmin = true
  state.role = 'ADMIN'
  vi.clearAllMocks()
})
function mount() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UserRolesList />
    </QueryClientProvider>,
  )
}
it('shows SUPERADMIN accurately without offering demotion or archival', async () => {
  mount()
  const row = await screen.findByRole('row', { name: /super@example.test/ })
  expect(within(row).getByText('SUPERADMIN')).toBeTruthy()
  expect(within(row).queryByRole('button', { name: /Change system role/i })).toBeNull()
  expect(within(row).queryByRole('button', { name: 'Archive' })).toBeNull()
})
it('does not offer account mutations to a manager', () => {
  state.isAdmin = false
  state.role = 'MANAGER'
  mount()
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Change system role/i })).toBeNull()
})
it('prevents demoting the last active ADMIN while keeping staff role management available', async () => {
  const user = userEvent.setup()
  mount()
  const admin = await screen.findByRole('row', { name: /admin@example.test/ })
  await user.click(within(admin).getByRole('button', { name: /Change system role/i }))
  expect(screen.getByRole('menuitem', { name: /MANAGER/ }).getAttribute('aria-disabled')).toBe(
    'true',
  )
  expect(screen.getByRole('menuitem', { name: /STAFF/ }).getAttribute('aria-disabled')).toBe('true')
  expect(state.mutateAsync).not.toHaveBeenCalled()
})


it('keeps ADMIN protections while the complete account safety check is refreshing', async () => {
  state.guardReady = false
  const user = userEvent.setup()
  mount()
  const admin = await screen.findByRole('row', { name: /admin@example.test/ })
  expect(within(admin).getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(true)
  await user.click(within(admin).getByRole('button', { name: /Change system role/i }))
  expect(screen.getByRole('menuitem', { name: /MANAGER/ }).getAttribute('aria-disabled')).toBe('true')
  expect(screen.getByRole('menuitem', { name: /STAFF/ }).getAttribute('aria-disabled')).toBe('true')
  expect(state.mutateAsync).not.toHaveBeenCalled()
})
