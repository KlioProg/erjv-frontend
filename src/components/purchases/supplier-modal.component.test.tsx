import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { createSupplierApi, updateSupplierApi } from '@/features/logistics/suppliers.api'
import { SupplierModal } from './SupplierModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
it('includes the required supplier address field even when its string is empty', async () => {
  let sent: unknown
  apiClient.defaults.adapter = async (config) => {
    sent = JSON.parse(config.data)
    return { config, status: 201, statusText: 'Created', headers: {}, data: { id: 1 } }
  }
  await createSupplierApi({ code: 'SUP-1', name: 'Supplier', address: '' })
  expect(sent).toMatchObject({ code: 'SUP-1', name: 'Supplier', address: '' })
})
it('clears optional supplier contact fields through the existing edit dialog', async () => {
  const supplier = {
    id: 1,
    code: 'SUP-1',
    name: 'Supplier',
    contactPerson: 'Contact',
    phone: '09123456789',
    email: 'contact@example.test',
    address: 'Davao',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }
  let sent: unknown
  apiClient.defaults.adapter = async (config) => {
    sent = JSON.parse(config.data)
    return { config, status: 200, statusText: 'OK', headers: {}, data: supplier }
  }
  render(
    <SupplierModal
      open
      supplier={supplier}
      onClose={vi.fn()}
      onSubmit={async (payload) => {
        await updateSupplierApi(1, payload)
      }}
    />,
  )
  for (const label of ['Contact Person', 'Phone Number', 'Email Address'])
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(sent).toMatchObject({ contactPerson: null, phone: null, email: null, address: 'Davao' })
})
