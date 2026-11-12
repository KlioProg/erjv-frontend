import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DataTable } from '@/components/ui/data-table'
import { ProductTableLabel, ProductTableQuantity } from './ProductTableCells'
import { formatProductLabel, formatReadOnlyQuantity } from '@/lib/product-presentation'

afterEach(() => vi.restoreAllMocks())

it.each([
  ['7.00', 'kg', '7 kg'],
  ['2.500000', 'kg', '2.5 kg'],
  ['0.000', 'L', '0 L'],
  ['9007199254740993.01', 'boxes', '9,007,199,254,740,993.01 boxes'],
  ['2.123456789000', 'sacks', '2.123456789 sacks'],
  ['-0.5000', 'kg', '-0.5 kg'],
  [null, 'kg', '—'],
  [undefined, 'kg', '—'],
  ['', 'kg', '—'],
  ['  ', 'kg', '—'],
])(
  'formats %s without changing precision or confusing missing with zero',
  (value, unit, expected) => {
    expect(formatReadOnlyQuantity(value, unit)).toBe(expected)
  },
)
it('preserves unknown/legacy values and distinguishes missing results', () => {
  expect(formatReadOnlyQuantity('unverified', 'kg')).toBe('unverified kg')
  expect(formatReadOnlyQuantity(null, 'kg', 'Not recorded')).toBe('Not recorded')
  expect(formatReadOnlyQuantity('3.00', undefined)).toBe('3 Unit unavailable')
  expect(formatProductLabel({ name: 'Mango', variety: 'Mango' })).toBe('Mango')
  expect(formatProductLabel({ name: 'Carabao Mango', variety: 'Carabao' })).toBe(
    'Carabao Mango · Carabao',
  )
})

it.each([1, 2, 20])(
  'keeps %s complete product rows and all receipt quantity categories',
  (count) => {
    const data = Array.from({ length: count }, (_, id) => ({
      id,
      product: { name: `Carabao Mango ${id}`, variety: 'Carabao', unit: id % 2 ? 'L' : 'kg' },
      expected: '7.00',
      received: '5.50',
      accepted: '3.00',
      damaged: '2.50',
      surplus: '0.00',
    }))
    const snapshot = JSON.stringify(data)
    render(
      <DataTable
        density="compact"
        appearance="subtle"
        pagination={false}
        data={data}
        getRowKey={(row) => row.id}
        columns={[
          { header: 'Product', cell: ({ row }) => <ProductTableLabel product={row.product} /> },
          ...(['expected', 'received', 'accepted', 'damaged', 'surplus'] as const).map((key) => ({
            header: key,
            align: 'right' as const,
            cell: ({ row }: { row: (typeof data)[number] }) => (
              <ProductTableQuantity value={row[key]} unit={row.product.unit} />
            ),
          })),
        ]}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(count + 1)
    expect(screen.getAllByRole('columnheader')).toHaveLength(6)
    const cells = within(rows[1]).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Carabao Mango 0 · Carabao',
      '7 kg',
      '5.5 kg',
      '3 kg',
      '2.5 kg',
      '0 kg',
    ])
    expect(JSON.stringify(data)).toBe(snapshot)
  },
)

it('provides full product and variant text through a keyboard-accessible overflow tooltip', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  const product = {
    name: 'A long product name '.repeat(8),
    variety: 'A long distinguishing variety '.repeat(4),
  }
  render(<ProductTableLabel product={product} />)
  const full = formatProductLabel(product)
  await userEvent.tab()
  expect(document.activeElement?.getAttribute('aria-label')).toBe(full)
  expect(screen.getByRole('tooltip').textContent).toBe(full)
})
