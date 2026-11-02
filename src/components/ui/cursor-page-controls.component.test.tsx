import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CursorPageControls } from './CursorPageControls'
import { DataTableFooter } from './DataTableFooter'

const controls = () => ({
  page: 2,
  pageSize: 50,
  setPageSize: vi.fn(),
  hasPrevious: true,
  hasNext: true,
  previous: vi.fn(),
  next: vi.fn(),
  isFetching: false,
  isError: false,
})

describe('CursorPageControls', () => {
  it('retains the compatibility export for the single shared footer presentation', () => {
    expect(CursorPageControls).toBe(DataTableFooter)
  })
  it('renders named icon buttons, announces the page and supports keyboard navigation', async () => {
    const user = userEvent.setup()
    const props = controls()
    render(<CursorPageControls {...props} />)
    expect(screen.getByText('Page 2')).toBeTruthy()
    expect(screen.getByText('Rows')).toBeTruthy()
    expect(screen.queryByText('Rows per page')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeTruthy()
    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })
    for (const button of [previous, next]) {
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(button.getAttribute('type')).toBe('button')
    }
    await user.click(previous)
    next.focus()
    await user.keyboard('{Enter}')
    expect(props.previous).toHaveBeenCalledTimes(1)
    expect(props.next).toHaveBeenCalledTimes(1)
  })

  it.each([
    { hasPrevious: false, hasNext: false },
    { isFetching: true },
  ])('prevents unavailable or loading navigation: %j', async (state) => {
    const user = userEvent.setup()
    const props = { ...controls(), ...state }
    render(<CursorPageControls {...props} />)
    for (const name of ['Previous page', 'Next page']) {
      const button = screen.getByRole('button', { name })
      expect(button.hasAttribute('disabled')).toBe(true)
      await user.click(button)
    }
    expect(props.previous).not.toHaveBeenCalled()
    expect(props.next).not.toHaveBeenCalled()
    if (props.isFetching) expect(screen.getByText('Page 2').textContent).toContain('Loading')
  })

  it('allows previous navigation after an error but prevents next navigation', async () => {
    const user = userEvent.setup()
    const props = { ...controls(), isError: true }
    render(<CursorPageControls {...props} />)
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(props.previous).toHaveBeenCalledOnce()
  })

  it('uses the supplied page sizes and delegates changes to the existing state owner', async () => {
    const user = userEvent.setup()
    const props = controls()
    render(<CursorPageControls {...props} pageSizeOptions={[20, 50]} />)
    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    expect(screen.getAllByRole('option')).toHaveLength(2)
    await user.click(screen.getByRole('option', { name: '20' }))
    expect(props.setPageSize).toHaveBeenCalledWith(20)
  })

  it.each([0, 1, 3, 20])('keeps compact pagination and usable page sizes for a single page with %i rows', async (rowCount) => {
    const props = { ...controls(), page: 1, hasPrevious: false, hasNext: false }
    render(<DataTableFooter {...props} rowCount={rowCount} />)
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getByText('Rows')).toBeTruthy()
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
    await userEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    await userEvent.click(screen.getByRole('option', { name: '10' }))
    expect(props.setPageSize).toHaveBeenCalledWith(10)
  })

  it('does not infer complete results during loading, errors, or unknown counts', () => {
    const props = { ...controls(), page: 1, hasPrevious: false, hasNext: false }
    const view = render(<DataTableFooter {...props} />)
    expect(screen.getByText('Page 1')).toBeTruthy()
    view.rerender(<DataTableFooter {...props} rowCount={0} isFetching />)
    expect(screen.getByRole('combobox', { name: 'Rows per page' }).hasAttribute('disabled')).toBe(true)
    view.rerender(<DataTableFooter {...props} rowCount={0} isError />)
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  })
})
