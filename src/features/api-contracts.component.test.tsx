import { afterEach, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { createSalesOrderApi, fetchSalesOrderByNumberApi } from './crm/sales-orders.api'
import { searchClientsByNameApi } from './crm/clients.api'
import { fetchProductByNameApi } from './products/products.api'
import {
  createPurchaseOrderApi,
  fetchPurchaseOrderByNumberApi,
} from './logistics/purchase-orders.api'
import {
  createIncomingDeliveryApi,
  fetchIncomingDeliveryByNumberApi,
  scheduleIncomingDeliveryApi,
} from './logistics/incoming-deliveries.api'
import {
  createOutgoingDeliveryApi,
  fetchOutgoingDeliveryByNumberApi,
} from './logistics/outgoing-deliveries.api'
import { fetchWarehouseByNameApi } from './logistics/warehouses.api'
import { fetchSupplierByCodeApi } from './logistics/suppliers.api'
import { fetchVehicleByPlateNumberApi } from './logistics/delivery-vehicles.api'
import { fetchStockItemByIdApi, fetchStockItemByPairApi } from './logistics/stock-items.api'
import {
  fetchEmployeeByEmailApi,
  fetchJobByNameApi,
  fetchEmployeeJobApi,
  fetchUserByEmailApi,
  fetchUserByIdApi,
} from './staffing/staffing.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  localStorage.clear()
})

const lookups = [
  ['sales order', () => fetchSalesOrderByNumberApi('SO-1')],
  ['purchase order', () => fetchPurchaseOrderByNumberApi('PO-1')],
  ['incoming delivery', () => fetchIncomingDeliveryByNumberApi('IN-1')],
  ['outgoing delivery', () => fetchOutgoingDeliveryByNumberApi('OUT-1')],
  ['customer search', () => searchClientsByNameApi('Customer')],
  ['product', () => fetchProductByNameApi('Rice')],
  ['warehouse', () => fetchWarehouseByNameApi('Main')],
  ['supplier', () => fetchSupplierByCodeApi('SUP-1')],
  ['vehicle', () => fetchVehicleByPlateNumberApi('ABC-123')],
  ['stock item', () => fetchStockItemByIdApi(1)],
  ['stock pair', () => fetchStockItemByPairApi(1, 2)],
  ['employee', () => fetchEmployeeByEmailApi('staff@example.test')],
  ['job', () => fetchJobByNameApi('Driver')],
  ['employee job', () => fetchEmployeeJobApi(1, 2)],
  ['user email', () => fetchUserByEmailApi('staff@example.test')],
  ['user ID', () => fetchUserByIdApi(1)],
] as const

it.each(lookups)(
  'propagates failed %s lookups instead of reporting a missing record',
  async (_, lookup) => {
    for (const status of [400, 401, 403, 404, 409, 500, undefined]) {
      const error = new AxiosError(status ? `HTTP ${status}` : 'Network Error')
      if (status)
        error.response = {
          status,
          statusText: '',
          data: { message: 'Request failed' },
          headers: {},
          config: {} as never,
        }
      apiClient.defaults.adapter = async () => {
        throw error
      }
      await expect(lookup()).rejects.toBe(error)
    }
  },
)

it.each(lookups)('handles an empty lookup response safely for %s', async (name, lookup) => {
  const data = name === 'customer search' ? { items: [], nextCursor: null } : null
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data,
  })
  if (name === 'stock item' || name === 'stock pair')
    await expect(lookup()).rejects.toThrow(/balance could not be verified/)
  else await expect(lookup()).resolves.toEqual(name === 'customer search' ? [] : data)
})

const creations = [
  {
    name: 'sales order',
    path: '/sales-orders',
    create: () =>
      createSalesOrderApi({
        clientId: 1,
        deliveryAddress: ' Davao ',
        items: [
          {
            inventoryItemId: 3,
            quantity: '2.50',
            unitPrice: '12.34',
          },
        ],
      }),
    body: {
      clientId: 1,
      deliveryAddress: 'Davao',
      items: [
        {
          inventoryItemId: 3,
          quantity: '2.50',
          unitPrice: '12.34',
        },
      ],
    },
  },
  {
    name: 'purchase order',
    path: '/purchase-orders',
    create: () =>
      createPurchaseOrderApi({
        supplierId: 2,
        items: [
          {
            inventoryItemId: 3,
            quantity: '2.50',
            unitPrice: '8.25',
            discountRate: '0.00',
            taxRate: '0.00',
          },
        ],
      }),
    body: {
      supplierId: 2,
      items: [
        {
          inventoryItemId: 3,
          quantity: '2.50',
          unitPrice: '8.25',
          discountRate: '0.00',
          taxRate: '0.00',
        },
      ],
    },
  },
  {
    name: 'incoming delivery',
    path: '/incoming-deliveries',
    create: () =>
      createIncomingDeliveryApi({
        purchaseOrderId: 2,
        warehouseId: 4,
        supplierReference: ' REF ',
      }),
    body: {
      purchaseOrderId: 2,
      warehouseId: 4,
      supplierReference: 'REF',
    },
  },
  {
    name: 'outgoing delivery',
    path: '/outgoing-deliveries',
    create: () =>
      createOutgoingDeliveryApi({
        salesOrderId: 1,
        notes: ' Handle carefully ',
      }),
    body: {
      salesOrderId: 1,
      notes: 'Handle carefully',
    },
  },
]

it('allows only header fields for incoming creation even when a legacy caller supplies receipt fields', async () => {
  const requests: { url?: string; body: unknown }[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push({ url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    return {
      config,
      data: { id: 91, status: 'DRAFT', items: [] },
      status: 201,
      statusText: '',
      headers: {},
    }
  }
  const legacy = {
    purchaseOrderId: 2,
    warehouseId: 4,
    scheduledAt: '2026-10-28T02:00:00.000Z',
    supplierReference: ' WAYBILL-9 ',
    notes: ' Dock 2 ',
    items: [{ purchaseOrderItemId: 6, receivedQuantity: '1.00', damagedQuantity: '0.00' }],
    plannedItems: [],
    receivedQuantity: '1.00',
    damagedQuantity: '0.00',
  }
  await createIncomingDeliveryApi(legacy)
  await scheduleIncomingDeliveryApi(91, 1)
  expect(requests).toEqual([
    {
      url: '/incoming-deliveries',
      body: {
        purchaseOrderId: 2,
        warehouseId: 4,
        scheduledAt: '2026-10-28T02:00:00.000Z',
        supplierReference: 'WAYBILL-9',
        notes: 'Dock 2',
      },
    },
    { url: '/incoming-deliveries/91/schedule', body: { expectedRevision: 1 } },
  ])
})

it.each(creations)(
  'sends the current $name DTO and returns authoritative server values',
  async ({ path, create, body }) => {
    localStorage.setItem('erjv_access_token', 'test-bearer')
    const serverRecord = {
      id: 91,
      status: 'DRAFT',
      items: [{ unitPrice: '7.25', totalAmount: '0.00' }],
    }
    apiClient.defaults.adapter = async (config) => {
      expect(config.method).toBe('post')
      expect(config.url).toBe(path)
      expect(JSON.parse(config.data)).toEqual(body)
      expect(config.headers.Authorization).toBe('Bearer test-bearer')
      return { config, status: 201, statusText: 'Created', headers: {}, data: serverRecord }
    }
    await expect(create()).resolves.toEqual(serverRecord)
  },
)

it.each(creations)('does not retry failed $name creation', async ({ create }) => {
  let attempts = 0
  const error = new AxiosError('Network Error')
  apiClient.defaults.adapter = async () => {
    attempts++
    throw error
  }
  await expect(create()).rejects.toBe(error)
  expect(attempts).toBe(1)
})
