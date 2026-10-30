import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { OrderLineAmounts, OrderLineDiscount } from './OrderLineDiscount'
import { ProductIdentity } from './OrderEntryFields'
import { DataTable } from '@/components/ui/data-table'
import type { LineDiscount } from '@/lib/order-line-pricing'

afterEach(() => vi.restoreAllMocks())

it('supports keyboard discount disclosure, removal, and keeps Enter out of order submission', async () => {
  const submit = vi.fn((event) => event.preventDefault())
  function Editor() {
    const [value, setValue] = useState<LineDiscount>({
      type: 'percentage',
      percentage: '',
      peso: '',
    })
    return (
      <form onSubmit={submit}>
        <OrderLineDiscount
          compact
          id="discount"
          name="Mango"
          value={value}
          line={{ quantity: '2', unitPrice: '100' }}
          onChange={setValue}
        />
      </form>
    )
  }
  render(<Editor />)
  const user = userEvent.setup()
  expect(screen.queryByRole('textbox')).toBeNull()
  const trigger = screen.getByRole('button', { name: 'Edit discount for Mango' })
  expect(trigger.textContent).toBe('No discount')
  await user.tab()
  await user.keyboard('{Enter}')
  await user.type(screen.getByRole('textbox', { name: 'Line discount for Mango' }), '5{Enter}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(trigger.textContent).toBe('5%')
  expect(submit).not.toHaveBeenCalled()
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Remove discount' }))
  expect(trigger.textContent).toBe('No discount')
  expect(document.activeElement).toBe(trigger)
})

it('keeps saved line details available inside a read-only order', async () => {
  render(
    <fieldset disabled>
      <OrderLineAmounts
        name="Mango"
        line={{ quantity: '2', unitPrice: '100' }}
        saved={{
          subtotalAmount: '200.00',
          discountAmount: '10.01',
          taxAmount: '22.80',
          totalAmount: '212.79',
        }}
      />
    </fieldset>,
  )
  expect(screen.queryByText('Subtotal')).toBeNull()
  const summary = screen.getByLabelText('Line amounts for Mango')
  expect(summary.textContent).toBe('₱212.79')
  // A native summary is not a form control disabled by the surrounding fieldset.
  fireEvent.click(summary)
  expect(await screen.findByText('Subtotal')).toBeTruthy()
  expect(screen.getByText('₱10.01')).toBeTruthy()
  expect(screen.getByText('₱22.80')).toBeTruthy()
  expect(screen.getAllByText('₱212.79')).toHaveLength(2)
})

it('renders long multilingual and HTML-looking table values as escaped, inspectable text', async () => {
  const text = '<img src=x onerror=alert(1)>' + '倉庫'.repeat(500) + ' مخزن'
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(4000)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  const view = render(
    <DataTable
      data={[{ id: 1, name: text }]}
      columns={[{ header: 'Name', accessorKey: 'name' }]}
      pagination={false}
    />,
  )
  expect(view.container.querySelector('img')).toBeNull()
  const value = screen.getByText(text)
  fireEvent.focus(value)
  expect(screen.getByRole('tooltip').textContent).toBe(text)
  fireEvent.keyDown(value, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.pointerEnter(value)
  expect(screen.getByRole('tooltip').textContent).toBe(text)
})

it('handles missing product identity without crashing or interpreting markup', () => {
  const view = render(
    <ProductIdentity name={null as unknown as string} variety="<script>bad()</script>" />,
  )
  expect(view.container.querySelector('script')).toBeNull()
  expect(screen.getByText('<script>bad()</script>')).toBeTruthy()
})
