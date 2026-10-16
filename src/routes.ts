export const NAV_ITEM_KEYS = [
  'inventory',
  'warehouses',
  'fleet',
  'deliveries',
  'incoming-deliveries',
  'outgoing-deliveries',
  'delivery-history',
  'purchases',
  'suppliers',
  'clients',
  'employees',
  'jobs',
  'users',
  'orders',
] as const

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number]

export function isNavItemKey(value: string | undefined): value is NavItemKey {
  return value !== undefined && (NAV_ITEM_KEYS as readonly string[]).includes(value)
}

export const ROUTES = {
  home: '/',
  customers: '/customers',
  salesOrders: '/sales-orders',
  legacyPrefix: '/legacy',
  default: '/legacy/inventory',
} as const

export function routeForScreen(screen: NavItemKey): string {
  if (screen === 'clients') return ROUTES.customers
  if (screen === 'orders') return ROUTES.salesOrders
  return `${ROUTES.legacyPrefix}/${screen}`
}

export function screenFromPath(pathname: string): NavItemKey | undefined {
  if (pathname === ROUTES.customers) return 'clients'
  if (pathname === ROUTES.salesOrders) return 'orders'

  const legacyScreen = pathname.match(/^\/legacy\/([^/]+)\/?$/)?.[1]
  return isNavItemKey(legacyScreen) ? legacyScreen : undefined
}
