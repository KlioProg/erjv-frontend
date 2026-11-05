export const NAV_ITEM_KEYS = [
  'dashboard',
  'inventory',
  'quarantined-stock',
  'warehouses',
  'fleet',
  'deliveries',
  'incoming-deliveries',
  'outgoing-deliveries',
  'delivery-history',
  'delivery-runs',
  'warehouse-transfers',
  'purchases',
  'suppliers',
  'clients',
  'employees',
  'jobs',
  'users',
  'orders',
  'financial-reports',
] as const

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number]

export function isNavItemKey(value: string | undefined): value is NavItemKey {
  return value !== undefined && (NAV_ITEM_KEYS as readonly string[]).includes(value)
}

export const ROUTES = {
  home: '/',
  financialReports: '/financial-reports',
  customers: '/customers',
  salesOrders: '/sales-orders',
  suppliers: '/suppliers',
  purchaseOrders: '/purchase-orders',
  staffDirectory: '/staff-directory',
  jobPositions: '/job-positions',
  userRoles: '/user-roles',
  inventory: '/inventory',
  quarantinedStock: '/inventory/quarantined',
  warehouses: '/warehouses',
  vehicles: '/vehicles',
  incomingDeliveries: '/deliveries/incoming',
  outgoingDeliveries: '/deliveries/outgoing',
  deliveryHistory: '/deliveries/history',
  deliveryRuns: '/deliveries/runs',
  warehouseTransfers: '/warehouse-transfers',
} as const

const SCREEN_ROUTES: Record<Exclude<NavItemKey, 'deliveries'>, string> = {
  dashboard: ROUTES.home,
  'financial-reports': ROUTES.financialReports,
  clients: ROUTES.customers,
  orders: ROUTES.salesOrders,
  suppliers: ROUTES.suppliers,
  purchases: ROUTES.purchaseOrders,
  employees: ROUTES.staffDirectory,
  jobs: ROUTES.jobPositions,
  users: ROUTES.userRoles,
  inventory: ROUTES.inventory,
  'quarantined-stock': ROUTES.quarantinedStock,
  warehouses: ROUTES.warehouses,
  fleet: ROUTES.vehicles,
  'incoming-deliveries': ROUTES.incomingDeliveries,
  'outgoing-deliveries': ROUTES.outgoingDeliveries,
  'delivery-history': ROUTES.deliveryHistory,
  'delivery-runs': ROUTES.deliveryRuns,
  'warehouse-transfers': ROUTES.warehouseTransfers,
}

export function warehouseDetailsPath(id: number): string {
  return `${ROUTES.warehouses}/${id}`
}

export function routeForScreen(screen: NavItemKey): string {
  if (screen === 'deliveries') return ROUTES.outgoingDeliveries
  return SCREEN_ROUTES[screen]
}

export function screenFromPath(pathname: string): NavItemKey | undefined {
  const path = pathname.replace(/\/$/, '') || '/'
  const screen = (Object.keys(SCREEN_ROUTES) as (keyof typeof SCREEN_ROUTES)[]).find(
    (key) => SCREEN_ROUTES[key] === path,
  )
  if (screen) return screen
  if (/^\/warehouses\/[^/]+$/.test(path)) return 'warehouses'

  return undefined
}
