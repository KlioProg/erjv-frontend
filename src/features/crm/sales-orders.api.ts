import axios from 'axios'
import { serializeLineDiscount } from '@/lib/order-line-pricing'
import { assertSalesDraftDiscountSupport } from './sales-order-entry.utils'
import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateSalesOrderPayload,
  SalesOrderFilter,
  SalesOrderRecord,
  UpdateSalesOrderDraftPayload,
} from './sales-orders.types'

export async function fetchSalesOrdersApi(filter?: SalesOrderFilter): Promise<SalesOrderRecord[]> {
  const response = await apiClient.get('/sales-orders', { params: filter })
  return extractArray<SalesOrderRecord>(response.data)
}

export async function fetchSalesOrderByIdApi(id: number): Promise<SalesOrderRecord | null> {
  const { data } = await apiClient.get<SalesOrderRecord>(`/sales-orders/${id}`)
  return data
}

export async function fetchSalesOrderByNumberApi(
  orderNumber: string,
): Promise<SalesOrderRecord | null> {
  const { data } = await apiClient.get<SalesOrderRecord>(
    `/sales-orders/number/${encodeURIComponent(orderNumber.trim())}`,
  )
  return data
}

export async function createSalesOrderApi(
  payload: CreateSalesOrderPayload,
): Promise<SalesOrderRecord> {
  const cleanPayload = {
    clientId: payload.clientId,
    deliveryAddress: payload.deliveryAddress.trim(),
    ...(payload.expectedAt ? { expectedAt: new Date(payload.expectedAt).toISOString() } : {}),
    ...(payload.externalReference?.trim()
      ? { externalReference: payload.externalReference.trim() }
      : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    items: payload.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      ...serializeLineDiscount(item),
      ...(item.taxRate ? { taxRate: String(item.taxRate) } : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    })),
  }

  const { data } = await apiClient.post<SalesOrderRecord>('/sales-orders', cleanPayload)
  return data
}

export async function confirmSalesOrderApi(id: number): Promise<SalesOrderRecord> {
  const { data } = await apiClient.patch<SalesOrderRecord>(`/sales-orders/${id}/confirm`)
  return data
}

export function isStaleSalesOrderRevision(error: unknown): boolean {
  return (
    axios.isAxiosError<{ code?: string }>(error) &&
    error.response?.status === 409 &&
    error.response.data?.code === 'STALE_REVISION'
  )
}

export async function updateSalesOrderDraftApi(
  id: number,
  payload: UpdateSalesOrderDraftPayload,
): Promise<SalesOrderRecord> {
  if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0)
    throw new Error('A valid saved revision is required. Reload this draft.')
  if (payload.items?.length === 0) throw new Error('Add at least one product to the sales order.')
  assertSalesDraftDiscountSupport(payload.items)
  const cleanPayload = {
    expectedRevision: payload.expectedRevision,
    ...(payload.clientId !== undefined ? { clientId: payload.clientId } : {}),
    ...(payload.deliveryAddress !== undefined
      ? { deliveryAddress: payload.deliveryAddress.trim() }
      : {}),
    ...(payload.expectedAt !== undefined
      ? {
          expectedAt: payload.expectedAt ? new Date(payload.expectedAt).toISOString() : null,
        }
      : {}),
    ...(payload.externalReference !== undefined
      ? { externalReference: payload.externalReference?.trim() || null }
      : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes?.trim() || null } : {}),
    ...(payload.items !== undefined
      ? {
          items: payload.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            ...serializeLineDiscount(item),
            ...(item.taxRate !== undefined ? { taxRate: String(item.taxRate) } : {}),
            ...(item.notes !== undefined ? { notes: item.notes?.trim() || null } : {}),
          })),
        }
      : {}),
  }
  const { data } = await apiClient.patch<SalesOrderRecord>(
    `/sales-orders/${id}/draft`,
    cleanPayload,
  )
  return data
}

export async function cancelSalesOrderApi(id: number): Promise<SalesOrderRecord> {
  const { data } = await apiClient.patch<SalesOrderRecord>(`/sales-orders/${id}/cancel`)
  return data
}
