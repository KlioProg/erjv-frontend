import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { DataTableExpandedSection, DataTableExpandToggle } from './DataTableExpandedSection'

it('keeps contextual headings while rendering loading, error, empty and ready content', () => {
  const props = {
    id: 'preview',
    title: 'Products at a warehouse with a long name',
    description: 'Preview description',
    children: <p>Product record</p>,
    footer: 'Total products: 1',
  }
  const view = render(
    <DataTableExpandedSection
      {...props}
      isLoading
      loadingContent={<p role="status">Loading products...</p>}
    />,
  )
  expect(screen.getByRole('region', { name: props.title })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Loading products...')
  expect(screen.queryByText('Product record')).toBeNull()
  expect(screen.queryByText('Total products: 1')).toBeNull()
  view.rerender(<DataTableExpandedSection {...props} errorContent={<p role="alert">Failed</p>} />)
  expect(screen.getByRole('alert').textContent).toBe('Failed')
  expect(screen.queryByText('Total products: 1')).toBeNull()
  view.rerender(
    <DataTableExpandedSection
      {...props}
      isEmpty
      emptyContent="No products"
      footer="Total products: 0"
    />,
  )
  expect(screen.getByText('No products')).toBeTruthy()
  expect(screen.getByText('Total products: 0')).toBeTruthy()
  view.rerender(<DataTableExpandedSection {...props} />)
  expect(screen.getByText('Product record')).toBeTruthy()
  expect(screen.getByText('Total products: 1')).toBeTruthy()
  view.rerender(<DataTableExpandedSection {...props} errorContent={false} footer={false} />)
  expect(screen.getByText('Product record')).toBeTruthy()
  expect(screen.queryByText('Total products: 1')).toBeNull()
})

it('uses a controlled keyboard toggle without triggering the parent row or moving focus', async () => {
  const user = userEvent.setup()
  const rowClick = vi.fn()
  function Preview() {
    const [expanded, setExpanded] = useState(false)
    return (
      <div onClick={rowClick}>
        <DataTableExpandToggle
          expanded={expanded}
          controls="preview"
          ariaLabel="Products"
          onToggle={() => setExpanded(!expanded)}
        >
          2 products
        </DataTableExpandToggle>
        {expanded && (
          <DataTableExpandedSection id="preview" title="Products">
            Records
          </DataTableExpandedSection>
        )}
      </div>
    )
  }
  render(<Preview />)
  const toggle = screen.getByRole('button', { name: 'Products' })
  await user.tab()
  await user.keyboard('{Enter}')
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(toggle.getAttribute('aria-controls')).toBe(screen.getByRole('region').id)
  expect(document.activeElement).toBe(toggle)
  expect(rowClick).not.toHaveBeenCalled()
  await user.keyboard(' ')
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('region')).toBeNull()
})
