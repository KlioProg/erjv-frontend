import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { createSupplierApi, updateSupplierApi } from '@/features/logistics/suppliers.api'
import { SupplierModal } from './SupplierModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('explains a blank business name inline while keeping optional contacts blank', async () => {
  const submit = vi.fn()
  const close = vi.fn()
  render(<SupplierModal open onClose={close} onSubmit={submit} />)
  const name = screen.getByLabelText(/Company Name/)
  fireEvent.change(name, { target: { value: '   ' } })
  await userEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
  expect(screen.getByRole('alert').textContent).toBe('Supplier company name is required.')
  expect(document.activeElement).toBe(name)
  expect(submit).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
})

it.each([
  ['+63 917 123 4567', '+639171234567'],
  ['02 8123 4567', '02 8123 4567'],
  ['+1 (415) 555-2671', '+1 (415) 555-2671'],
  ['+1 415 555 267100', '+1 415 555 267100'],
])('handles supplier contact %s without restricting other phone formats', async (input, expected) => {
  const submit = vi.fn().mockResolvedValue(undefined)
  render(<SupplierModal open onClose={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: 'Supplier' } })
  const phone = screen.getByLabelText('Phone Number') as HTMLInputElement
  await userEvent.click(phone)
  await userEvent.paste(input)
  await userEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
  await waitFor(() => expect(submit).toHaveBeenCalledOnce())
  expect(submit.mock.calls[0][0].phone).toBe(expected)
})

it('accepts an 11-digit Philippine mobile number entered by typing', async () => {
  const submit = vi.fn().mockResolvedValue(undefined)
  render(<SupplierModal open onClose={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: 'Supplier' } })
  await userEvent.type(screen.getByLabelText('Phone Number'), '09171234567')
  await userEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))

  await waitFor(() => expect(submit).toHaveBeenCalledOnce())
  expect(submit.mock.calls[0][0].phone).toBe('+639171234567')
})

it.each(['09123', 'letters only'])('rejects incomplete or nonnumeric supplier phone %s and retains the form', async (phone) => {
  const submit = vi.fn()
  render(<SupplierModal open onClose={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: 'Supplier' } })
  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: phone } })
  await userEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Phone Number').getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toMatch(/Enter (10 digits after \+63\.|a valid Philippine mobile number\.)/)
})

it('retains and rejects an overlong Philippine mobile number pasted into the supplier form', async () => {
  const submit = vi.fn()
  render(<SupplierModal open onClose={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText(/Company Name/), { target: { value: 'Supplier' } })
  const phone = screen.getByLabelText('Phone Number') as HTMLInputElement
  await userEvent.click(phone)
  await userEvent.paste('09 17abc123456789')

  expect(phone.value).toBe('')
  await userEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))

  expect(submit).not.toHaveBeenCalled()
  expect(phone.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert').textContent).toMatch(/Enter (10 digits after \+63\.|a valid Philippine mobile number\.)/)
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
