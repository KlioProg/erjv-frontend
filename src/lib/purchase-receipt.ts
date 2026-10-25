import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'

const money = (value: string | number) =>
  `PHP ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const pdfText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

const text = (value: string, x: number, y: number, size = 10, color = '0.12 0.16 0.22') =>
  `${color} rg\nBT\n/F1 ${size} Tf\n${x} ${y} Td\n(${pdfText(value)}) Tj\nET`

const line = (x1: number, y1: number, x2: number, y2: number, color = '0.90 0.91 0.92') =>
  `${color} RG\n1 w\n${x1} ${y1} m\n${x2} ${y2} l\nS`

function createPdf(content: string): Blob {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

export function exportPurchaseReceiptPdf(
  order: PurchaseOrderRecord,
  supplier: Supplier | undefined,
  products: InventoryItemResponse[],
): boolean {
  if (typeof document === 'undefined') return false

  const productNames = new Map(products.map((product) => [product.id, product.name]))
  const supplierName =
    supplier?.name ??
    (order.supplierId == null ? 'No supplier assigned' : `Supplier #${order.supplierId}`)
  const total = order.items.reduce((sum, item) => sum + Number(item.totalAmount), 0)
  const content: string[] = [
    'q',
    '0.50 0.73 0.09 RG',
    '2 w',
    '50 778 m',
    '545 778 l',
    'S',
    'Q',
    text('Purchase Receipt', 50, 800, 20),
    text(order.orderNumber, 50, 783, 10, '0.42 0.45 0.49'),
    text('SUPPLIER', 50, 744, 8, '0.42 0.45 0.49'),
    text(supplierName, 50, 728, 10),
    text('ORDER DATE', 315, 744, 8, '0.42 0.45 0.49'),
    text(new Date(order.orderedAt).toLocaleDateString('en-US'), 315, 728, 10),
    text('STATUS', 50, 700, 8, '0.42 0.45 0.49'),
    text(order.status, 50, 684, 10),
    text('REFERENCE', 315, 700, 8, '0.42 0.45 0.49'),
    text(order.externalReference ?? 'Not set', 315, 684, 10),
    '0.95 0.96 0.96 rg',
    '50 648 495 24 re',
    'f',
    text('ITEM', 56, 656, 8, '0.25 0.28 0.32'),
    text('QUANTITY', 355, 656, 8, '0.25 0.28 0.32'),
    text('UNIT PRICE', 414, 656, 8, '0.25 0.28 0.32'),
    text('AMOUNT', 500, 656, 8, '0.25 0.28 0.32'),
  ]

  let y = 630
  order.items.forEach((item) => {
    const name = productNames.get(item.inventoryItemId) ?? `Item #${item.inventoryItemId}`
    content.push(
      text(name.slice(0, 43), 56, y, 9),
      text(item.quantity, 375, y, 9),
      text(money(item.unitPrice), 414, y, 9),
      text(money(item.totalAmount), 500, y, 9),
      line(50, y - 9, 545, y - 9),
    )
    y -= 27
  })

  content.push(
    text(`Total: ${money(total)}`, 414, Math.max(y - 8, 80), 13),
    text('Generated from ERJVPOS', 218, 42, 8, '0.42 0.45 0.49'),
  )

  const url = URL.createObjectURL(createPdf(content.join('\n')))
  const link = document.createElement('a')
  link.href = url
  link.download = `purchase-receipt-${order.orderNumber}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
