import { afterEach, expect, it } from 'vitest'
import { apiClient } from './api-client'
import { createClientApi, updateClientDetailsApi } from '@/features/crm/clients.api'
import { createSupplierApi, updateSupplierApi } from '@/features/logistics/suppliers.api'
import { createEmployeeApi, updateEmployeeProfileApi } from '@/features/staffing/staffing.api'
import { createWarehouseApi, updateWarehouseDetailsApi } from '@/features/logistics/warehouses.api'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const endpoints = [
  {
    name: 'Customer',
    key: 'phone',
    create: (phone?: string | null) => createClientApi({ name: 'Buyer', address: 'Davao', phone }),
    update: (phone?: string | null) => updateClientDetailsApi(1, { phone }),
  },
  {
    name: 'Supplier',
    key: 'phone',
    create: (phone?: string | null) =>
      createSupplierApi({ code: 'SUP', name: 'Supplier', address: '', phone }),
    update: (phone?: string | null) => updateSupplierApi(1, { phone }),
  },
  {
    name: 'Employee/Driver',
    key: 'phone',
    create: (phone?: string | null) =>
      createEmployeeApi({ firstName: 'Juan', lastName: 'Cruz', hireDate: '2026-01-01', phone }),
    update: (phone?: string | null) => updateEmployeeProfileApi(1, { phone }),
  },
  {
    name: 'Warehouse',
    key: 'contactNumber',
    create: (contactNumber?: string | null) =>
      createWarehouseApi({ name: 'Main', address: 'Davao', contactNumber }),
    update: (contactNumber?: string | null) => updateWarehouseDetailsApi(1, { contactNumber }),
  },
]
it.each(endpoints)(
  '$name serializer normalizes known mobiles, preserves other contacts, and retains optional/null semantics',
  async ({ key, create, update }) => {
    let body: Record<string, unknown> = {}
    apiClient.defaults.adapter = async (config) => {
      body = JSON.parse(config.data)
      return { config, status: 200, statusText: 'OK', headers: {}, data: { id: 1, ...body } }
    }
    for (const [input, expected] of [
      ['09171234567', '+639171234567'],
      ['+63 917 123 4567', '+639171234567'],
      ['639171234567', '+639171234567'],
      ['(02) 8123 4567', '(02) 8123 4567'],
      ['084-555-1111', '084-555-1111'],
      ['unverified contact', 'unverified contact'],
    ]) {
      await create(input)
      expect(body[key]).toBe(expected)
      await update(input)
      expect(body[key]).toBe(expected)
    }
    for (const blank of ['', ' ', null, undefined]) {
      await create(blank)
      expect(body).not.toHaveProperty(key)
      await update(blank)
      if (blank === undefined) expect(body).not.toHaveProperty(key)
      else expect(body[key]).toBeNull()
    }
  },
)
