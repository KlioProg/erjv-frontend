import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { DataTable } from './data-table'

describe('DataTable accessibility', () => {
  it('announces loading without exposing stale records, then reveals the ready table', () => {
    const props = {
      data: [{ id: 1, name: 'Customer account' }],
      columns: [{ header: 'Name', accessorKey: 'name' as const }],
      loadingMessage: 'Loading customers...',
    }
    const view = render(<DataTable {...props} isLoading />)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Loading customers...')
    expect(status.querySelectorAll('thead th')).toHaveLength(1)
    expect(status.querySelectorAll('tbody tr')).toHaveLength(7)
    expect(screen.queryByText('Customer account')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    view.rerender(<DataTable {...props} isLoading={false} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('cell', { name: 'Customer account' })).toBeTruthy()
  })

  it('announces the current sort while preserving tri-state sorting', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        data={[
          { id: 1, name: 'Zulu' },
          { id: 2, name: 'Alpha' },
        ]}
        columns={[{ header: 'Name', accessorKey: 'name', sortable: true }]}
      />,
    )
    const heading = screen.getByRole('columnheader', { name: 'Name' })
    const sort = screen.getByRole('button', { name: 'Name' })
    expect(heading.getAttribute('aria-sort')).toBe('none')
    await user.click(sort)
    expect(heading.getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getAllByRole('cell')[0].textContent).toBe('Alpha')
    await user.click(sort)
    expect(heading.getAttribute('aria-sort')).toBe('descending')
    expect(screen.getAllByRole('cell')[0].textContent).toBe('Zulu')
    await user.click(sort)
    expect(heading.getAttribute('aria-sort')).toBe('none')
  })

  it('names page controls and identifies the current page after navigation', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        data={[{ id: 1 }, { id: 2 }, { id: 3 }]}
        columns={[{ header: 'ID', accessorKey: 'id' }]}
        pageSize={1}
      />,
    )
    expect(screen.getByText('Page 1')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2')).toBeTruthy()
    expect(screen.getByRole('cell').textContent).toBe('2')
  })
})

describe('DataTable pagination', () => {
  const data = Array.from({ length: 125 }, (_, index) => ({ id: index + 1 }))
  const columns = [{ header: 'ID', accessorKey: 'id' as const, sortable: true }]

  it('updates every existing page size when pageSize is supplied without a handler', async () => {
    const user = userEvent.setup()
    const view = render(
      <DataTable data={data} columns={columns} pageSize={10} pageSizeOptions={[10, 25, 50, 100]} />,
    )
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    for (const size of [25, 50, 100, 10]) {
      await user.click(screen.getByRole('combobox', { name: 'Rows per page' }))
      await user.click(screen.getByRole('option', { name: String(size) }))
      expect(screen.getAllByRole('cell')).toHaveLength(size)
      expect(screen.getByText(/Showing/).textContent).toBe(`Showing 1 to ${size} of 125 entries`)
      await user.click(screen.getByRole('button', { name: 'Next page' }))
      expect(screen.getAllByRole('cell')[0].textContent).toBe(String(size + 1))
      await user.click(screen.getByRole('button', { name: 'Previous page' }))
    }
    await user.click(screen.getByRole('button', { name: 'ID' }))
    await user.click(screen.getByRole('button', { name: 'ID' }))
    expect(screen.getAllByRole('cell')[0].textContent).toBe('125')
    view.rerender(
      <DataTable
        data={data.slice(0, 3)}
        columns={columns}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
      />,
    )
    expect(screen.getAllByRole('cell')).toHaveLength(3)
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  })

  it('passes page size and reset page to the controlled server data owner without slicing server rows', async () => {
    const user = userEvent.setup()
    const fetchPage = vi.fn()
    function ServerTable() {
      const [page, setPage] = useState(2)
      const [pageSize, setPageSize] = useState(10)
      return (
        <DataTable
          data={data.slice((page - 1) * pageSize, page * pageSize)}
          columns={columns}
          manualPagination
          totalCount={125}
          page={page}
          onPageChange={(next) => {
            setPage(next)
            fetchPage(next)
          }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      )
    }
    render(<ServerTable />)
    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    await user.click(screen.getByRole('option', { name: '20' }))
    expect(fetchPage).toHaveBeenLastCalledWith(1)
    expect(screen.getAllByRole('cell')).toHaveLength(20)
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1 to 20 of 125 entries')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('cell')[0].textContent).toBe('21')
  })
})

it('keeps opt-in interactive headers mounted while loading and when filters return no rows', () => {
  const columns = [{ id: 'name', header: <button>Filter by name</button>, accessorKey: 'name' as const }]
  const props = { columns, pagination: false, retainHeaders: true, emptyContent: 'No matches.' }
  const view = render(<DataTable {...props} data={[{ id: 1, name: 'Old record' }]} />)
  const trigger = screen.getByRole('button', { name: 'Filter by name' })
  trigger.focus()
  view.rerender(<DataTable {...props} data={[{ id: 1, name: 'Old record' }]} isLoading />)
  expect(screen.queryByText('Old record')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Loading records...')
  expect(screen.getByRole('button', { name: 'Filter by name' })).toBe(trigger)
  expect(document.activeElement).toBe(trigger)
  view.rerender(<DataTable {...props} data={[]} />)
  expect(screen.getByText('No matches.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Filter by name' })).toBe(trigger)
  expect(document.activeElement).toBe(trigger)
})

it('keeps its footer through loading and empty results without inventing a row summary', async () => {
  const onPageSizeChange = vi.fn()
  const props = { data: [] as { id: number }[], columns: [{ header: 'ID', accessorKey: 'id' as const }], onPageSizeChange, pageSize: 50, pageSizeOptions: [10, 25, 50, 100], emptyContent: 'No matches.' }
  const view = render(<DataTable {...props} isLoading />)
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'Rows per page' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByText(/Showing/)).toBeNull()
  view.rerender(<DataTable {...props} />)
  expect(screen.getByText('No matches.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  await userEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
  await userEvent.click(screen.getByRole('option', { name: '25' }))
  expect(onPageSizeChange).toHaveBeenCalledWith(25)
  view.rerender(<DataTable {...props} pagination={false} />)
  expect(screen.queryByRole('navigation')).toBeNull()
})
