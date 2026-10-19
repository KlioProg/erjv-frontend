import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { SearchableDropdown } from './SearchableDropdown'

afterEach(() => vi.restoreAllMocks())

it('reveals clipped selected text on trigger focus and hover while keeping full options available', async () => {
  const user = userEvent.setup()
  const longType = 'Heavy Truck (6-Wheeler)'
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-overflow-text') && this.textContent === longType ? 240 : 60
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  const props = {
    options: ['Van', longType],
    value: longType,
    onValueChange: vi.fn(),
    onCreateValue: vi.fn(),
    getOptionValue: (value: string) => value,
    getOptionLabel: (value: string) => value,
    placeholder: 'Select type',
    searchPlaceholder: 'Search vehicle types',
    emptyMessage: 'No types',
    ariaLabel: 'Vehicle Type',
  }
  const view = render(<SearchableDropdown {...props} />)
  const trigger = screen.getByRole('button', { name: 'Vehicle Type' })
  expect(screen.queryByRole('tooltip')).toBeNull()
  await user.tab()
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole('tooltip').textContent).toBe(longType)
  expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).toBeNull()
  await user.hover(trigger)
  expect(screen.getByRole('tooltip').textContent).toBe(longType)
  await user.click(trigger)
  expect(screen.getByRole('menuitem', { name: longType }).textContent).toBe(longType)
  await user.keyboard('{Escape}')
  await user.tab()
  view.rerender(<SearchableDropdown {...props} value="Van" />)
  await user.hover(trigger)
  expect(screen.queryByRole('tooltip')).toBeNull()
  view.rerender(<SearchableDropdown {...props} value="Custom refrigerated delivery truck" />)
  await user.click(trigger)
  expect(screen.getByText('Selected: Custom refrigerated delivery truck')).toBeTruthy()
})

it('supports searching, arrow-key selection, and Escape with focus restoration', async () => {
  const user = userEvent.setup()
  const change = vi.fn()
  render(
    <SearchableDropdown
      options={['Alpha', 'Beta']}
      value=""
      onValueChange={change}
      getOptionValue={(value) => value}
      getOptionLabel={(value) => value}
      placeholder="Choose customer"
      searchPlaceholder="Search customers"
      emptyMessage="No customers found"
      ariaLabel="Customer"
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Customer' })
  await user.click(trigger)
  expect(document.activeElement).toBe(screen.getByRole('searchbox'))
  await user.keyboard('Bet{ArrowDown}')
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Beta' }))
  await user.keyboard('{ArrowUp}')
  expect(document.activeElement).toBe(screen.getByRole('searchbox'))
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{Enter}')
  expect(change).toHaveBeenCalledWith('Beta', 'Beta')
  expect(document.activeElement).toBe(trigger)
  await user.click(trigger)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  await user.keyboard('{Enter}')
  expect(document.activeElement).toBe(screen.getByRole('searchbox'))
})

it('accepts trimmed custom values, reuses case/spacing matches, and rejects blank or long entries', async () => {
  const user = userEvent.setup()
  const create = vi.fn()
  const change = vi.fn()
  render(
    <SearchableDropdown
      options={['Delivery Van']}
      value="Refrigerated Truck"
      onValueChange={change}
      onCreateValue={create}
      maxCustomLength={100}
      getOptionValue={(value) => value}
      getOptionLabel={(value) => value}
      placeholder="Choose type"
      searchPlaceholder="Search vehicle types"
      emptyMessage="No types"
      ariaLabel="Vehicle Type"
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Vehicle Type' })
  expect(trigger.textContent).toContain('Refrigerated Truck')
  await user.click(trigger)
  await user.type(screen.getByRole('searchbox'), '   ')
  expect(screen.queryByRole('menuitem', { name: /^Use/ })).toBeNull()
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'delivery   VAN')
  expect(screen.queryByRole('menuitem', { name: /^Use/ })).toBeNull()
  await user.keyboard('{Enter}')
  expect(change).toHaveBeenCalledWith('Delivery Van', 'Delivery Van')
  expect(create).not.toHaveBeenCalled()
  await user.click(trigger)
  await user.type(screen.getByRole('searchbox'), '  Refrigerated   Truck  ')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(create).toHaveBeenCalledWith('Refrigerated Truck')
  expect(document.activeElement).toBe(trigger)
  await user.click(trigger)
  await user.type(screen.getByRole('searchbox'), 'x'.repeat(101))
  expect(screen.getByRole('status').textContent).toContain('100')
  await user.keyboard('{Enter}')
  expect(create).toHaveBeenCalledTimes(1)
  await user.keyboard('{Escape}')
  expect(document.activeElement).toBe(trigger)
})
