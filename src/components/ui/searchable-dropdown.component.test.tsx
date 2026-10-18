import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SearchableDropdown } from './SearchableDropdown'

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
