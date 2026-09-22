import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateSalesOrderPayload,
  SalesOrderFilter,
  SalesOrderRecord,
} from './sales-orders.types'

export async function fetchSalesOrdersApi(filter?: SalesOrderFilter): Promise<SalesOrderRecord[]> {
  const response = await apiClient.get('/sales-orders', { params: filter })
  return extractArray<SalesOrderRecord>(response.data)
}

export async function fetchSalesOrderByIdApi(id: number): Promise<SalesOrderRecord> {
  const { data } = await apiClient.get<SalesOrderRecord>(`/sales-orders/${id}`)
  return data
}

export async function fetchSalesOrderByNumberApi(
  orderNumber: string,
): Promise<SalesOrderRecord | null> {
  try {
    const { data } = await apiClient.get<SalesOrderRecord>(
      `/sales-orders/number/${encodeURIComponent(orderNumber.trim())}`,
    )
    return data
  } catch {
    return null
  }
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
      ...(item.discountRate ? { discountRate: String(item.discountRate) } : {}),
      ...(item.taxRate ? { taxRate: String(item.taxRate) } : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
      allocations: item.allocations?.map((alloc) => ({
        stockItemId: alloc.stockItemId,
        quantity: String(alloc.quantity),
      })),
    })),
  }

  const { data } = await apiClient.post<SalesOrderRecord>('/sales-orders', cleanPayload)
  return data
}

export async function confirmSalesOrderApi(id: number): Promise<SalesOrderRecord> {
  const { data } = await apiClient.patch<SalesOrderRecord>(`/sales-orders/${id}/confirm`)
  return data
}

export async function cancelSalesOrderApi(id: number): Promise<SalesOrderRecord> {
  const { data } = await apiClient.patch<SalesOrderRecord>(`/sales-orders/${id}/cancel`)
  return data
}
