import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { SearchableDropdown } from './SearchableDropdown'
import { useState } from 'react'

afterEach(() => vi.restoreAllMocks())

it('describes required selectors without changing their menu-button semantics', () => {
  render(<SearchableDropdown required options={['Main']} value="" onValueChange={vi.fn()}
    getOptionValue={(value) => value} getOptionLabel={(value) => value} placeholder="Choose"
    searchPlaceholder="Search" emptyMessage="Empty" ariaLabel="Warehouse" />)
  const trigger = screen.getByRole('button', { name: 'Warehouse' })
  expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe('Required.')
})

it('searches safely when labels are missing or contain multilingual markup-looking text', async () => {
  const user = userEvent.setup()
  const text = '倉庫 <b>safe</b>'
  render(<SearchableDropdown
    options={[{ id: 1, label: null }, { id: 2, label: text }]}
    value="1" onValueChange={vi.fn()} getOptionValue={(option) => String(option.id)}
    getOptionLabel={(option) => option.label as string}
    placeholder="Choose a location" searchPlaceholder="Find location"
    emptyMessage="No locations" ariaLabel="Location" />)
  await user.click(screen.getByRole('button', { name: 'Location' }))
  await user.type(screen.getByRole('searchbox', { name: 'Find location' }), '倉庫')
  expect(screen.getByRole('menuitem', { name: text })).toBeTruthy()
  expect(document.body.querySelector('b')).toBeNull()
})

it('prevents opening or choosing options while disabled', async () => {
  const user = userEvent.setup()
  const props = {
    options: ['Alpha'], value: '', onValueChange: vi.fn(),
    getOptionValue: (value: string) => value, getOptionLabel: (value: string) => value,
    placeholder: 'Choose', searchPlaceholder: 'Search', emptyMessage: 'Empty', ariaLabel: 'Picker',
  }
  const view = render(<SearchableDropdown {...props} />)
  await user.click(screen.getByRole('button', { name: 'Picker' }))
  expect(screen.getByRole('menuitem', { name: 'Alpha' })).toBeTruthy()
  view.rerender(<SearchableDropdown {...props} disabled />)
  expect(screen.queryByRole('menuitem')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Picker' }))
  expect(screen.queryByRole('menuitem')).toBeNull()
  expect(props.onValueChange).not.toHaveBeenCalled()
  view.rerender(<SearchableDropdown {...props} />)
  expect(screen.queryByRole('menu')).toBeNull()
})

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

it('honors disabled and loading states without exposing selectable options', async () => {
  const props = {
    options: ['Warehouse'],
    value: '',
    onValueChange: vi.fn(),
    getOptionValue: (x: string) => x,
    getOptionLabel: (x: string) => x,
    placeholder: 'Select warehouse',
    searchPlaceholder: 'Search',
    emptyMessage: 'Empty',
    ariaLabel: 'Warehouse',
  }
  const view = render(<SearchableDropdown {...props} disabled />)
  const user = userEvent.setup()
  const button = screen.getByRole('button', { name: 'Warehouse' })
  expect(button.hasAttribute('disabled')).toBe(true)
  await user.click(button)
  expect(screen.queryByRole('menu')).toBeNull()
  view.rerender(<SearchableDropdown {...props} isLoading />)
  expect(button.hasAttribute('disabled')).toBe(true)
  view.rerender(<SearchableDropdown {...props} />)
  await user.click(button)
  expect(screen.getByRole('menuitem', { name: 'Warehouse' })).toBeTruthy()
  view.rerender(<SearchableDropdown {...props} disabled />)
  expect(screen.queryByRole('menu')).toBeNull()
})


it('keeps validation and overflow tooltip descriptions associated with the same trigger', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(240)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  const user = userEvent.setup()
  render(<SearchableDropdown options={['Long selected value']} value="Long selected value" onValueChange={vi.fn()} getOptionValue={value => value} getOptionLabel={value => value} placeholder="Choose" searchPlaceholder="Search" emptyMessage="Empty" ariaLabel="Record" error="Review this record" />)
  await user.tab()
  const trigger = screen.getByRole('button', { name: 'Record' })
  const descriptions = trigger.getAttribute('aria-describedby')?.split(' ')
  expect(descriptions).toContain(screen.getByRole('alert').id)
  expect(descriptions).toContain(screen.getByRole('tooltip').id)
  await user.keyboard('{Escape}')
  expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
})

it('notifies the parent when Enter creates a value and closes the menu', async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(<SearchableDropdown options={[]} value="" onValueChange={vi.fn()} onCreateValue={vi.fn()} getOptionValue={(value: string) => value} getOptionLabel={(value: string) => value} placeholder="Choose" searchPlaceholder="Search" emptyMessage="Empty" ariaLabel="Type" onOpenChange={onOpenChange} />)
  await user.click(screen.getByRole('button', { name: 'Type' }))
  await user.type(screen.getByRole('searchbox'), 'New type')
  await user.keyboard('{Enter}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(onOpenChange).toHaveBeenLastCalledWith(false)
})

it('cannot change a selection through its portal after the parent fieldset is disabled', async () => {
  const user = userEvent.setup()
  const change = vi.fn()
  const picker = <SearchableDropdown options={['Alpha']} value="" onValueChange={change} getOptionValue={(value) => value} getOptionLabel={(value) => value} placeholder="Choose" searchPlaceholder="Search" emptyMessage="Empty" ariaLabel="Picker" />
  const view = render(<fieldset>{picker}</fieldset>)
  await user.click(screen.getByRole('button', { name: 'Picker' }))
  view.rerender(<fieldset disabled>{picker}</fieldset>)
  await user.click(screen.getByRole('menuitem', { name: 'Alpha' }))
  expect(change).not.toHaveBeenCalled()
})

it('keeps multi-selection open, supports keyboard deselection, and restores trigger focus', async () => {
  function Harness() {
    const [selected, setSelected] = useState<string[]>([])
    return <SearchableDropdown options={['Alpha', 'Beta']} value="" selectedValues={selected} onValueChange={(value) => setSelected((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value])} getOptionValue={(value) => value} getOptionLabel={(value) => value} placeholder="Choose" searchPlaceholder="Search" emptyMessage="Empty" ariaLabel="Records" />
  }
  render(<Harness />)
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Records' })
  await user.click(trigger)
  await user.type(screen.getByRole('searchbox'), 'Bet')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByRole('menuitemcheckbox', { name: 'Beta', checked: true })).toBeTruthy()
  await user.keyboard(' ')
  expect(screen.getByRole('menuitemcheckbox', { name: 'Beta', checked: false })).toBeTruthy()
  await user.keyboard('{Enter}')
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  await user.click(trigger)
  expect(screen.getByRole('menuitemcheckbox', { name: 'Beta', checked: true })).toBeTruthy()
})
