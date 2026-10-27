import { afterEach, expect, it, vi } from 'vitest'
import { exportPurchaseReceiptPdf } from './purchase-receipt'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Supplier } from '@/features/logistics/suppliers.types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const product = { id: 1, name: 'Carabao Mango', unit: 'kg' } as InventoryItemResponse
const supplier = { name: 'Test Supplier' } as Supplier
const item = {
  id: 1,
  inventoryItemId: 1,
  quantity: '2.00',
  unitPrice: '100.00',
  subtotalAmount: '200.00',
  discountAmount: '10.00',
  taxAmount: '22.80',
  totalAmount: '212.80',
}
const order = {
  id: 1,
  orderNumber: 'PO-0091',
  status: 'CONFIRMED',
  supplierId: 1,
  orderedAt: '2026-10-27',
  externalReference: 'SUP-REF',
  items: [item],
} as PurchaseOrderRecord
async function documentText(record = order, products = [product]) {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:purchase-order')
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  expect(exportPurchaseReceiptPdf(record, supplier, products)).toBe(true)
  const blob = createObjectURL.mock.calls[0][0] as Blob
  const reader = new FileReader()
  const result = new Promise<string>((resolve) => {
    reader.onload = () => resolve(String(reader.result))
  })
  reader.readAsText(blob)
  return { text: await result, link: click.mock.instances[0] as HTMLAnchorElement }
}

it('downloads a Purchase Order with authoritative supplier, line, discount, tax, and total data', async () => {
  const { text, link } = await documentText()
  expect(link.download).toBe('purchase-order-PO-0091.pdf')
  for (const value of [
    'Purchase Order',
    'PO-0091',
    'Test Supplier',
    'Carabao Mango',
    '2.00 kg',
    'PHP 100.00',
    'Discount: PHP 10.00',
    'VAT: PHP 22.80',
    'Subtotal: PHP 200.00',
    'Total: PHP 212.80',
    'SUP-REF',
  ])
    expect(text).toContain(value)
  expect(text).not.toContain('Purchase Receipt')
  expect(text.startsWith('%PDF-1.4')).toBe(true)
})

it('keeps every product on multi-page purchase orders', async () => {
  const products = Array.from({ length: 40 }, (_, i) => ({
    ...product,
    id: i + 1,
    name: `Product ${i + 1}`,
  }))
  const { text } = await documentText(
    {
      ...order,
      items: products.map((product) => ({
        ...order.items[0],
        id: product.id,
        inventoryItemId: product.id,
      })),
    },
    products,
  )
  expect(Number(text.match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(1)
  expect(text).toContain('Product 40')
  expect(text).toContain('Total: PHP 8,512.00')
})
