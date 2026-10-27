import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import { formatOrderCurrency } from '@/lib/order-amounts'
import { savedOrderTotals } from '@/lib/order-line-pricing'
import { formatProductUnit } from '@/lib/product-unit'

const money = (value: string | null) => formatOrderCurrency(value).replace('₱', 'PHP ')

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

function createPdf(pages: string[]): Blob {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const pageIds: number[] = []
  for (const content of pages) {
    const pageId = objects.length + 1
    pageIds.push(pageId)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    )
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
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

  const productMap = new Map(products.map((product) => [product.id, product]))
  const supplierName =
    supplier?.name ??
    (order.supplierId == null ? 'No supplier assigned' : `Supplier #${order.supplierId}`)
  const totals = savedOrderTotals(order.items)
  const header: string[] = [
    'q',
    '0.50 0.73 0.09 RG',
    '2 w',
    '50 778 m',
    '545 778 l',
    'S',
    'Q',
    text('Purchase Order', 50, 800, 20),
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
    text('QUANTITY', 300, 656, 8, '0.25 0.28 0.32'),
    text('UNIT COST', 390, 656, 8, '0.25 0.28 0.32'),
    text('LINE TOTAL', 485, 656, 8, '0.25 0.28 0.32'),
  ]

  const pages: string[][] = []
  let content = [...header]
  let y = 630
  order.items.forEach((item) => {
    const product = productMap.get(item.inventoryItemId)
    const name = product?.name ?? 'Product unavailable'
    const nameLines = name.match(/.{1,43}/g) ?? [name]
    const rowHeight = Math.max(nameLines.length * 12, 14) + 27
    if (y - rowHeight < 145) {
      pages.push(content)
      content = [...header]
      y = 630
    }
    nameLines.forEach((part, index) => content.push(text(part, 56, y - index * 12, 9)))
    const detailY = y - Math.max(nameLines.length * 12, 14)
    content.push(
      text([item.quantity, formatProductUnit(product?.unit)].filter(Boolean).join(' '), 300, y, 9),
      text(money(item.unitPrice), 390, y, 9),
      text(money(item.totalAmount), 485, y, 9),
      text(`Discount: ${money(item.discountAmount)}`, 56, detailY, 8),
      text(`VAT: ${money(item.taxAmount)}`, 270, detailY, 8),
      text(`Subtotal: ${money(item.subtotalAmount)}`, 410, detailY, 8),
      line(50, y - rowHeight + 10, 545, y - rowHeight + 10),
    )
    y -= rowHeight
  })

  content.push(
    text(`Subtotal: ${money(totals?.subtotal ?? null)}`, 350, y - 5, 10),
    text(`Discount: ${money(totals?.discount ?? null)}`, 350, y - 20, 10),
    text(`VAT: ${money(totals?.vat ?? null)}`, 350, y - 35, 10),
    text(`Total: ${money(totals?.total ?? null)}`, 350, y - 55, 13),
    text('Generated from ERJVPOS', 218, 42, 8, '0.42 0.45 0.49'),
  )

  pages.push(content)
  const url = URL.createObjectURL(createPdf(pages.map((page) => page.join('\n'))))
  const link = document.createElement('a')
  link.href = url
  link.download = `purchase-order-${order.orderNumber}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
