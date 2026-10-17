import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router'
import {
  Boxes,
  Warehouse as WarehouseIcon,
  Truck,
  Users,
  Briefcase,
  Shield,
  LogOut,
  Package,
  Menu,
  X,
  ChevronRight,
  Building2,
  ChevronDown,
  MapPinned,
  ReceiptText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeliveryNavigation } from './DeliveryNavigation'
import { ErjvPosLogo } from '@/components/ui/ErjvPosLogo'
import { useAuth } from '@/features/auth/AuthContext'
import { USER_ROLES, ROLE_DETAILS } from '@/features/auth/roles'
import { StockNotifications } from './StockNotifications'
import type { InventoryFocusTarget } from '@/features/logistics/stock-warnings'
import { routeForScreen, type NavItemKey } from '@/routes'

type DashboardLayoutProps = {
  onNavigate: () => void
  currentScreen?: NavItemKey
  children: React.ReactNode
  onOpenInventory: (target: InventoryFocusTarget) => void
}

type NavGroup = {
  title: string
  items: {
    key: NavItemKey
    label: string
    icon: React.ComponentType<{ className?: string }>
    requiresStaffAccess?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Sales',
    items: [
      { key: 'clients', label: 'Customers', icon: Users },
      { key: 'orders', label: 'Sales Orders', icon: ReceiptText },
    ],
  },
  {
    title: 'Purchases',
    items: [
      { key: 'suppliers', label: 'Suppliers', icon: Building2 },
      { key: 'purchases', label: 'Purchase Orders', icon: Package },
    ],
  },
  {
    title: 'Logistics',
    items: [
      { key: 'inventory', label: 'Inventory', icon: Boxes },
      { key: 'warehouses', label: 'Warehouses', icon: WarehouseIcon },
      { key: 'deliveries', label: 'Deliveries', icon: MapPinned },
      { key: 'fleet', label: 'Vehicles', icon: Truck },
    ],
  },
  {
    title: 'Staffing & HR',
    items: [
      { key: 'employees', label: 'Staff Directory', icon: Users, requiresStaffAccess: true },
      { key: 'jobs', label: 'Job Positions', icon: Briefcase, requiresStaffAccess: true },
      { key: 'users', label: 'User Roles & Access', icon: Shield, requiresStaffAccess: true },
    ],
  },
]

export function DashboardLayout({
  currentScreen,
  onNavigate,
  children,
  onOpenInventory,
}: DashboardLayoutProps) {
  const queryClient = useQueryClient()
  const { user, logout, isAdmin, isManager } = useAuth()
  const roleConfig =
    ROLE_DETAILS[user?.role || USER_ROLES.UNKNOWN] || ROLE_DETAILS[USER_ROLES.UNKNOWN]
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isSidebarScrolling, setIsSidebarScrolling] = useState(false)
  const sidebarScrollTimeout = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (sidebarScrollTimeout.current !== null) {
        window.clearTimeout(sidebarScrollTimeout.current)
      }
    }
  }, [])

  const handleSidebarScroll = () => {
    setIsSidebarScrolling(true)
    if (sidebarScrollTimeout.current !== null) {
      window.clearTimeout(sidebarScrollTimeout.current)
    }
    sidebarScrollTimeout.current = window.setTimeout(() => {
      setIsSidebarScrolling(false)
      sidebarScrollTimeout.current = null
    }, 700)
  }

  const handleNavigate = () => {
    onNavigate()
    void queryClient.invalidateQueries()
  }

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User Account')
  const userInitial = displayName.charAt(0).toUpperCase()

  // Staffing pages are available to admins and managers.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiresStaffAccess || isAdmin || isManager),
  })).filter((group) => group.items.length > 0)

  const deliveryView =
    currentScreen === 'incoming-deliveries'
      ? 'incoming'
      : currentScreen === 'delivery-history'
        ? 'history'
        : currentScreen === 'outgoing-deliveries' || currentScreen === 'deliveries'
          ? 'outgoing'
          : null
  // Determine current section info
  const currentGroup = NAV_GROUPS.find((g) =>
    g.items.some((item) => item.key === (deliveryView ? 'deliveries' : currentScreen)),
  )
  const currentItem = currentGroup?.items.find(
    (item) => item.key === (deliveryView ? 'deliveries' : currentScreen),
  )

  return (
    <div className="min-h-svh w-full bg-background flex text-foreground antialiased selection:bg-primary/20">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        data-sidebar
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r bg-card transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header & Nav list */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex h-14 shrink-0 items-center justify-between px-5 border-b">
            <ErjvPosLogo />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              className="lg:hidden size-8 text-muted-foreground"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Nav List with a subtle native scrollbar */}
          <nav
            aria-label="Main navigation"
            tabIndex={0}
            data-scrolling={isSidebarScrolling}
            onScroll={handleSidebarScroll}
            className="scrollbar-subtle flex-1 flex flex-col gap-6 px-3 py-5 overflow-y-auto min-h-0"
          >
            {visibleGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <div className="px-3 text-xs font-medium text-muted-foreground">{group.title}</div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    if (item.key === 'deliveries')
                      return (
                        <DeliveryNavigation
                          key={item.key}
                          view={deliveryView}
                          onSelect={() => {
                            handleNavigate()
                            setIsMobileOpen(false)
                          }}
                        />
                      )
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.key}
                        to={routeForScreen(item.key)}
                        end={item.key !== 'warehouses'}
                        onClick={() => {
                          handleNavigate()
                          setIsMobileOpen(false)
                        }}
                        className={({ isActive }) =>
                          `group relative flex h-9 w-full items-center justify-between rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150 cursor-pointer select-none pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isActive
                              ? 'bg-primary-subtle text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`size-4 shrink-0 ${
                              currentScreen === item.key
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-foreground'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {currentScreen === item.key && item.key !== 'inventory' && (
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer / User Profile & Role Switcher - ALWAYS PINNED ON BOTTOM LEFT */}
        <div className="p-3 border-t bg-card shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex w-full items-center justify-between gap-3 p-2 rounded-md bg-card cursor-pointer hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-9 border border-border bg-muted shrink-0">
                    {user?.avatarUrl && (
                      <AvatarImage
                        src={user.avatarUrl}
                        alt={displayName}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-muted text-foreground font-semibold text-ui">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 text-left">
                    <span
                      className="text-ui font-medium leading-snug text-foreground truncate max-w-[130px]"
                      title={displayName}
                    >
                      {displayName}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{roleConfig.label}</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-64 mb-2">
              <div className="px-2.5 py-2 text-xs text-muted-foreground flex flex-col gap-1 rounded-xl mx-1">
                <span className="font-medium text-foreground truncate text-sm">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.email || 'Logged In'}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant="outline"
                    className={`font-medium text-xs py-0.5 px-2 ${roleConfig.badgeClass}`}
                  >
                    {roleConfig.label}
                  </Badge>
                  <span className="text-xs text-status-success-foreground font-medium">
                    ● Online
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive gap-2 text-ui cursor-pointer font-medium py-2 hover:bg-muted focus:bg-muted focus:text-destructive"
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="lg:hidden size-9 text-muted-foreground"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex flex-col select-none">
              <div className="flex items-center gap-2 text-ui text-muted-foreground">
                <span className="font-medium">{currentGroup?.title}</span>
                <span>/</span>
                <span className="font-medium text-foreground">
                  {deliveryView
                    ? `Deliveries / ${deliveryView === 'incoming' ? 'Incoming' : deliveryView === 'outgoing' ? 'Outgoing' : 'History'}`
                    : currentItem?.label}
                </span>
              </div>
            </div>
          </div>

          <StockNotifications
            onOpenInventory={(target) => {
              onOpenInventory(target)
              setIsMobileOpen(false)
            }}
          />
        </header>

        {/* Dynamic Main Body Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1600px] w-full mx-auto">{children}</main>

        {/* Global Footer */}
        <footer className="border-t border-border/60 py-4 px-4 sm:px-8 text-center text-xs text-muted-foreground">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="font-medium tracking-tight">
              ERJV POS Enterprise Operations Suite © {new Date().getFullYear()}
            </span>
            <span className="text-xs text-muted-foreground">v1.0.0 (Production)</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
