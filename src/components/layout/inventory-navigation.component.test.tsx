import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { InventoryNavigation } from './InventoryNavigation'
import { screenFromPath, routeForScreen } from '@/routes'

it('expands the active inventory child and preserves stable product and quarantine URLs', async () => {
  const select = vi.fn()
  render(
    <MemoryRouter initialEntries={['/inventory/quarantined']}>
      <InventoryNavigation view="quarantine" onSelect={select} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Inventory' }).getAttribute('aria-expanded')).toBe(
    'true',
  )
  expect(screen.getByRole('link', { name: 'Quarantined Stock' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(screen.getByRole('link', { name: 'Products & Stock' }).getAttribute('href')).toBe(
    '/inventory',
  )
  await userEvent.click(screen.getByRole('link', { name: 'Products & Stock' }))
  expect(select).toHaveBeenCalledOnce()
  expect(screenFromPath('/inventory/quarantined')).toBe('quarantined-stock')
  expect(routeForScreen('quarantined-stock')).toBe('/inventory/quarantined')
})
