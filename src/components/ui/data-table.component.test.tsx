import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DataTable } from './data-table'

describe('DataTable accessibility', () => {
  it('announces loading without exposing stale records, then reveals the ready table', () => {
    const props = {
      data: [{ id: 1, name: 'Customer account' }],
      columns: [{ header: 'Name', accessorKey: 'name' as const }],
      loadingMessage: 'Loading customers...',
    }
    const view = render(<DataTable {...props} isLoading />)
    expect(screen.getByRole('status').textContent).toContain('Loading customers...')
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
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page')
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('cell').textContent).toBe('2')
  })
})
