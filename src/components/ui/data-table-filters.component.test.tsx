import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { DataTableFilters, DataTableFilterChips, type DataTableFilter } from './data-table-filters'

it('opens by keyboard, shows selected values and clears one filter or all without clearing search', async () => {
  function Example() {
    const [status, setStatus] = useState('OUT')
    const [warehouse, setWarehouse] = useState('1')
    const filters: DataTableFilter[] = [
      {
        kind: 'select',
        id: 'stock',
        label: 'Stock Status',
        value: status,
        onChange: setStatus,
        options: [
          { value: 'ALL', label: 'All' },
          { value: 'OUT', label: 'Out of Stock' },
        ],
      },
      {
        kind: 'select',
        id: 'warehouse',
        label: 'Warehouse',
        value: warehouse,
        onChange: setWarehouse,
        options: [
          { value: 'ALL', label: 'All' },
          { value: '1', label: 'Main' },
        ],
      },
    ]
    return (
      <>
        <input aria-label="Search" defaultValue="rice" />
        <DataTableFilters filters={filters} />
        <DataTableFilterChips filters={filters} />
      </>
    )
  }
  render(<Example />)
  const user = userEvent.setup()
  screen.getByRole('button', { name: 'Filters' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'Stock Status' }).textContent).toBe('Out of Stock')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('button', { name: 'Clear stock status' }))
  expect(screen.queryByRole('button', { name: 'Clear stock status' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Clear warehouse' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Clear All' }))
  expect(screen.queryByRole('region', { name: 'Active filters' })).toBeNull()
  expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('rice')
})
