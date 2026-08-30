import { apiClient } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

const DEFAULT_PRODUCTS: InventoryItemResponse[] = [
  {
    id: 1,
    name: 'Standard POS Receipt Paper Roll (80mm)',
    sku: 'POS-REC-80',
    unitPrice: 45.0,
    description: 'Thermal receipt roll for ERJVPOS cash registers and printers.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Wireless Barcode Scanner USB-C',
    sku: 'HW-SCAN-WL01',
    unitPrice: 2850.0,
    description: 'Handheld 2D/QR laser scanner for express checkout counters.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Heavy Duty Electronic Cash Drawer 5B8C',
    sku: 'HW-DRW-5B8C',
    unitPrice: 4200.0,
    description: 'RJ11 automated trigger cash drawer with 5 bill & 8 coin trays.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Thermal Label Sticker Rolls 50x30mm (1000pcs)',
    sku: 'LBL-5030-1K',
    unitPrice: 160.0,
    description: 'Direct thermal barcode labels for inventory SKU tagging.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const isDemoMode = () => {
  const token = localStorage.getItem('erjv_access_token')
  return !token || token === 'demo-token'
}

export async function fetchProductsApi(): Promise<InventoryItemResponse[]> {
  if (isDemoMode()) {
    return DEFAULT_PRODUCTS
  }
  try {
    const { data } = await apiClient.get<InventoryItemResponse[]>('/inventory-items')
    return data
  } catch {
    return DEFAULT_PRODUCTS
  }
}

export async function fetchProductByIdApi(id: number): Promise<InventoryItemResponse> {
  if (isDemoMode()) {
    const item = DEFAULT_PRODUCTS.find((p) => p.id === id)
    if (!item) throw new Error('Product not found')
    return item
  }
  try {
    const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`)
    return data
  } catch {
    const item = DEFAULT_PRODUCTS.find((p) => p.id === id)
    if (!item) throw new Error('Product not found')
    return item
  }
}

export async function createProductApi(
  payload: CreateInventoryItemPayload
): Promise<InventoryItemResponse> {
  if (isDemoMode()) {
    const newProd: InventoryItemResponse = {
      id: DEFAULT_PRODUCTS.length + 1,
      name: payload.name,
      sku: payload.sku,
      unitPrice: payload.unitPrice,
      description: payload.description || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    DEFAULT_PRODUCTS.push(newProd)
    return newProd
  }
  try {
    const { data } = await apiClient.post<InventoryItemResponse>('/inventory-items', payload)
    return data
  } catch {
    const newProd: InventoryItemResponse = {
      id: DEFAULT_PRODUCTS.length + 1,
      name: payload.name,
      sku: payload.sku,
      unitPrice: payload.unitPrice,
      description: payload.description || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    DEFAULT_PRODUCTS.push(newProd)
    return newProd
  }
}

export async function updateProductDetailsApi(
  id: number,
  payload: UpdateInventoryItemDetailsPayload
): Promise<InventoryItemResponse> {
  if (isDemoMode()) {
    const prod = DEFAULT_PRODUCTS.find((p) => p.id === id)
    if (!prod) throw new Error('Product not found')
    Object.assign(prod, payload, { updatedAt: new Date().toISOString() })
    return prod
  }
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/details`,
    payload
  )
  return data
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number
): Promise<InventoryItemResponse> {
  if (isDemoMode()) {
    const prod = DEFAULT_PRODUCTS.find((p) => p.id === id)
    if (!prod) throw new Error('Product not found')
    prod.unitPrice = unitPrice
    prod.updatedAt = new Date().toISOString()
    return prod
  }
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/unit-price`,
    { unitPrice }
  )
  return data
}

export async function deactivateProductApi(id: number): Promise<InventoryItemResponse> {
  if (isDemoMode()) {
    const prod = DEFAULT_PRODUCTS.find((p) => p.id === id)
    if (!prod) throw new Error('Product not found')
    prod.isActive = false
    return prod
  }
  const { data } = await apiClient.delete<InventoryItemResponse>(`/inventory-items/${id}`)
  return data
}
