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
  inventory: '/inventory',
  warehouses: '/warehouses',
  vehicles: '/vehicles',
  incomingDeliveries: '/deliveries/incoming',
  outgoingDeliveries: '/deliveries/outgoing',
  deliveryHistory: '/deliveries/history',
  legacyPrefix: '/legacy',
  default: '/inventory',
} as const

const SCREEN_ROUTES: Partial<Record<NavItemKey, string>> = {
  clients: ROUTES.customers,
  orders: ROUTES.salesOrders,
  inventory: ROUTES.inventory,
  warehouses: ROUTES.warehouses,
  fleet: ROUTES.vehicles,
  'incoming-deliveries': ROUTES.incomingDeliveries,
  'outgoing-deliveries': ROUTES.outgoingDeliveries,
  'delivery-history': ROUTES.deliveryHistory,
}

export function warehouseDetailsPath(id: number): string {
  return `${ROUTES.warehouses}/${id}`
}

export function routeForScreen(screen: NavItemKey): string {
  if (screen === 'deliveries') return ROUTES.outgoingDeliveries
  return SCREEN_ROUTES[screen] ?? `${ROUTES.legacyPrefix}/${screen}`
}

export function screenFromPath(pathname: string): NavItemKey | undefined {
  const path = pathname.replace(/\/$/, '')
  const screen = (Object.keys(SCREEN_ROUTES) as NavItemKey[]).find(
    (key) => SCREEN_ROUTES[key] === path,
  )
  if (screen) return screen
  if (/^\/warehouses\/[^/]+$/.test(path)) return 'warehouses'

  const legacyScreen = pathname.match(/^\/legacy\/([^/]+)\/?$/)?.[1]
  return isNavItemKey(legacyScreen) ? legacyScreen : undefined
}
