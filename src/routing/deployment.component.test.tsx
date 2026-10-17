import { expect, it } from 'vitest'
import config from '../../vercel.json'
import { NAV_ITEM_KEYS, routeForScreen, warehouseDetailsPath } from '@/routes'

it('serves the SPA for application paths without rewriting API or static asset requests', () => {
  expect(config.rewrites).toHaveLength(1)
  const rewrite = config.rewrites[0]
  expect(rewrite.destination).toBe('/index.html')
  const matcher = new RegExp(`^${rewrite.source}$`)
  for (const path of ['/', ...NAV_ITEM_KEYS.map(routeForScreen), warehouseDetailsPath(42),
    '/legacy/employees', '/unknown-page', '/warehouses/invalid']) {
    expect(matcher.test(path), path).toBe(true)
  }
  for (const path of ['/api', '/api/', '/api/users', '/api/warehouses/42', '/assets',
    '/assets/missing-chunk', '/assets/app.js', '/fonts/inter/InterVariable.woff2',
    '/fonts/missing', '/favicon.svg', '/icons.svg', '/missing.js', '/index.html']) {
    expect(matcher.test(path), path).toBe(false)
  }
})
