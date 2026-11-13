import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { EmployeeModal } from '@/components/staffing/EmployeeModal'
import { WarehouseModal } from '@/components/operations/WarehouseModal'
import { SupplierModal } from '@/components/purchases/SupplierModal'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: true }),
}))
const original = apiClient.defaults.adapter
let writes: { url?: string; body: Record<string, unknown> }[]
beforeEach(() => {
  writes = []
  apiClient.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : {}
    if (config.method !== 'get') writes.push({ url: config.url, body })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: config.method === 'get' ? null : { id: 1, ...body },
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
const employee = {
  id: 1,
  firstName: 'Juan',
  lastName: 'Cruz',
  phone: '09171234567',
  email: null,
  address: null,
  hireDate: '2026-01-01T00:00:00Z',
  canDrive: true,
  userId: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}
const warehouse = {
  id: 1,
  name: 'Main',
  address: 'Davao',
  contactNumber: '09171234567',
  isActive: true,
  createdAt: '',
  updatedAt: '',
}

function mount(element: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {element}
    </QueryClientProvider>,
  )
}

it.each([false, true])(
  'saves Employee/Driver mobile without changing driving eligibility (editing=%s)',
  async (editing) => {
    mount(<EmployeeModal open employee={editing ? employee : null} onClose={vi.fn()} />)
    const input = screen.getByLabelText('Phone Number') as HTMLInputElement
    expect(writes).toHaveLength(0)
    if (editing) expect(input.value).toBe('9171234567')
    else {
      fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Juan' } })
      fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Cruz' } })
      fireEvent.change(screen.getByLabelText(/Hire Date/), { target: { value: '2026-01-01' } })
      await userEvent.click(screen.getByLabelText('Eligible to drive delivery runs'))
      await userEvent.click(input)
      await userEvent.paste('639171234567')
    }
    await userEvent.click(
      screen.getByRole('button', { name: editing ? 'Update Employee' : /Register Employee/ }),
    )
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({
      url: editing ? '/employees/1/profile' : '/employees',
      body: expect.objectContaining({
        phone: '+639171234567',
        ...(editing ? {} : { canDrive: true }),
      }),
    })
  },
)

it.each([false, true])(
  'saves Warehouse mobile only on explicit submission (editing=%s)',
  async (editing) => {
    mount(<WarehouseModal open warehouse={editing ? warehouse : null} onClose={vi.fn()} />)
    expect(writes).toHaveLength(0)
    const input = screen.getByLabelText('Contact Number / Hotline') as HTMLInputElement
    if (editing) expect(input.value).toBe('9171234567')
    else {
      fireEvent.change(screen.getByLabelText(/Warehouse Name/), { target: { value: 'Main' } })
      fireEvent.change(screen.getByLabelText(/Address/), { target: { value: 'Davao' } })
      await userEvent.click(input)
      await userEvent.paste('+63 917 123 4567')
    }
    await userEvent.click(
      screen.getByRole('button', { name: editing ? 'Save Changes' : 'Register Warehouse' }),
    )
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body.contactNumber).toBe('+639171234567')
  },
)

it.each(['084-555-1111', 'unverified contact'])(
  'loads Warehouse legacy contact %s without rewriting it',
  async (contactNumber) => {
    const close = vi.fn()
    mount(<WarehouseModal open warehouse={{ ...warehouse, contactNumber }} onClose={close} />)
    expect((screen.getByLabelText('Contact Number / Hotline') as HTMLInputElement).value).toBe(
      contactNumber,
    )
    expect(writes).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
    if (contactNumber === 'unverified contact') {
      expect(screen.getByText(/saved contact could not be verified/)).toBeTruthy()
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(writes).toHaveLength(0)
      expect(close).not.toHaveBeenCalled()
    } else {
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      await waitFor(() => expect(writes[0]?.body.contactNumber).toBe(contactNumber))
    }
  },
)

it('normalizes the existing Supplier mobile on explicit edit save', async () => {
  const submit = vi.fn().mockResolvedValue(undefined)
  mount(
    <SupplierModal
      open
      supplier={{
        id: 1,
        code: 'SUP',
        name: 'Supplier',
        address: 'Davao',
        phone: '09171234567',
        email: null,
        contactPerson: null,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      }}
      onClose={vi.fn()}
      onSubmit={submit}
    />,
  )
  expect((screen.getByLabelText('Phone Number') as HTMLInputElement).value).toBe('9171234567')
  expect(submit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(submit).toHaveBeenCalledOnce())
  expect(submit.mock.calls[0][0].phone).toBe('+639171234567')
})
