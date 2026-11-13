import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/lib/notifications'
import { ClientModal } from '@/components/crm/ClientModal'
import { JobModal } from '@/components/staffing/JobModal'
import { SupplierModal } from '@/components/purchases/SupplierModal'
import { useUpdateSupplier } from '@/features/logistics/suppliers.hooks'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})
const record = {
  id: 1,
  name: 'Test account',
  code: 'TEST',
  description: null,
  contactPerson: null,
  phone: null,
  email: null,
  address: 'Davao City',
  isActive: true,
  createdAt: '2026-11-14',
  updatedAt: '2026-11-14',
}

it.each(
  [
    { kind: 'customer', input: 'client-name', submit: 'Save Changes' },
    { kind: 'supplier', input: 'supplier-name', submit: 'Save Changes' },
    { kind: 'job', input: 'job-name', submit: 'Save Position' },
  ].flatMap((entry) =>
    (['network', 'permission', 'validation'] as const).map((failure) => ({ ...entry, failure })),
  ),
)(
  'keeps $kind edits after $failure failures and allows a deliberate retry',
  async ({ kind, input, submit, failure }) => {
    const error = vi.spyOn(toast, 'error').mockReturnValue('error')
    const success = vi.spyOn(toast, 'success').mockReturnValue('saved')
    const close = vi.fn()
    let writes = 0
    let reject = true
    apiClient.defaults.adapter = async (config) => {
      if (config.method !== 'get') {
        writes++
        if (reject)
          throw new AxiosError(
            'Request failed',
            failure === 'network' ? 'ERR_NETWORK' : undefined,
            config,
            undefined,
            failure === 'network'
              ? undefined
              : {
                  config,
                  status: failure === 'permission' ? 403 : 422,
                  statusText: '',
                  headers: {},
                  data: {
                    issues:
                      failure === 'validation'
                        ? [{ path: 'name', message: 'Review this name.' }]
                        : [],
                  },
                },
          )
        return {
          config,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { ...record, name: 'Edited account' },
        }
      }
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], nextCursor: null },
      }
    }
    function SupplierEditor() {
      const update = useUpdateSupplier()
      return (
        <SupplierModal
          open
          supplier={record}
          onClose={close}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: record.id, payload: values })
          }}
        />
      )
    }
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        {kind === 'customer' ? (
          <ClientModal open client={record} onClose={close} />
        ) : kind === 'job' ? (
          <JobModal open job={record} onClose={close} />
        ) : (
          <SupplierEditor />
        )}
      </QueryClientProvider>,
    )
    const name = document.getElementById(input) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Edited account' } })
    fireEvent.submit(name.closest('form')!)
    fireEvent.submit(name.closest('form')!)
    await waitFor(() => expect(error).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(name.value).toBe('Edited account')
    if (failure === 'validation') {
      expect(screen.getByRole('alert').textContent).toBe('Review this name.')
      expect(name.getAttribute('aria-invalid')).toBe('true')
    } else expect(screen.queryByRole('alert')).toBeNull()
    expect(close).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
    expect(writes).toBe(1)
    reject = false
    await userEvent.click(screen.getByRole('button', { name: submit }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(success).toHaveBeenCalledOnce()
    expect(writes).toBe(2)
  },
)
