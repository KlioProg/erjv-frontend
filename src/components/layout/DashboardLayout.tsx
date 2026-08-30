import React, { useState } from 'react'
import {
  Boxes,
  Warehouse as WarehouseIcon,
  Truck,
  Users,
  Briefcase,
  Layers,
  Shield,
  LogOut,
  Package,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Building2,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ErjvPosLogo } from '@/components/ui/ErjvPosLogo'
import { useAuth } from '@/features/auth/AuthContext'
import { useProducts } from '@/features/products/products.hooks'
import { ProductListModal } from '../products/ProductListModal'

export type NavItemKey =
  | 'inventory'
  | 'warehouses'
  | 'fleet'
  | 'clients'
  | 'employees'
  | 'jobs'
  | 'grouping'
  | 'users'

type DashboardLayoutProps = {
  currentTab: NavItemKey
  onSelectTab: (tab: NavItemKey) => void
  children: React.ReactNode
}

type NavGroup = {
  title: string
  items: {
    key: NavItemKey
    label: string
    icon: React.ComponentType<{ className?: string }>
    requiresAdmin?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations & Logistics',
    items: [
      { key: 'inventory', label: 'Inventory & Stock', icon: Boxes },
      { key: 'warehouses', label: 'Warehouses', icon: WarehouseIcon },
      { key: 'fleet', label: 'Delivery Fleet', icon: Truck },
    ],
  },
  {
    title: 'Customer Relations (CRM)',
    items: [
      { key: 'clients', label: 'Client Management', icon: Building2 },
    ],
  },
  {
    title: 'Staffing & HR',
    items: [
      { key: 'employees', label: 'Staff Directory', icon: Users, requiresAdmin: true },
      { key: 'jobs', label: 'Job Positions', icon: Briefcase, requiresAdmin: true },
      { key: 'grouping', label: 'Grouped by Role', icon: Layers, requiresAdmin: true },
      { key: 'users', label: 'User Roles & Access', icon: Shield, requiresAdmin: true },
    ],
  },
]

export function DashboardLayout({
  currentTab,
  onSelectTab,
  children,
}: DashboardLayoutProps) {
  const { user, logout, isOwner, isAdmin, isStaff } = useAuth()
  const { data: products = [] } = useProducts()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false)

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U'

  // Filter out admin-only items if user is Staff
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiresAdmin || isOwner || isAdmin),
  })).filter((group) => group.items.length > 0)

  // Determine current section info
  const currentGroup = NAV_GROUPS.find((g) =>
    g.items.some((item) => item.key === currentTab)
  )
  const currentItem = currentGroup?.items.find((item) => item.key === currentTab)

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-border/80 bg-card/95 backdrop-blur-md transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header & Nav list */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-border/70">
            <ErjvPosLogo />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-8 text-muted-foreground"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Nav List with custom smooth scrollbar */}
          <nav className="flex-1 space-y-5 px-3.5 py-4 overflow-y-auto min-h-0">
            {visibleGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = currentTab === item.key

                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          onSelectTab(item.key)
                          setIsMobileOpen(false)
                        }}
                        className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`size-4 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground group-hover:text-foreground'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {isActive && (
                          <ChevronRight className="size-3.5 text-primary-foreground/80" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer / User Profile & Role Switcher - ALWAYS PINNED ON BOTTOM LEFT */}
        <div className="p-3 border-t border-border/70 bg-card shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-muted/50 border border-border/70 cursor-pointer hover:bg-muted/90 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-9 border border-primary/20 bg-primary/10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-extrabold text-xs">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-bold leading-snug text-foreground truncate max-w-[130px]">
                      {user?.email ? user.email.split('@')[0] : 'User Account'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-extrabold text-primary tracking-tight uppercase">
                        {user?.role || 'OWNER'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60 mb-2">
              <DropdownMenuLabel className="text-xs font-bold">
                Active Session
              </DropdownMenuLabel>
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex flex-col gap-1 bg-muted/40 rounded-lg mx-1">
                <span className="font-semibold text-foreground truncate">{user?.email || 'Logged In'}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-bold text-[9px] text-primary bg-primary/10 py-0 px-1.5">
                    {user?.role || 'OWNER'}
                  </Badge>
                  <span className="text-[10px] text-emerald-600 font-semibold">● Online</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive gap-2 text-xs cursor-pointer font-semibold">
                <LogOut className="size-3.5" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/85 backdrop-blur-md px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-9 text-muted-foreground"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{currentGroup?.title}</span>
                <span>/</span>
                <span className="font-bold text-foreground">{currentItem?.label}</span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProductsModalOpen(true)}
              className="text-xs font-semibold h-8.5 gap-1.5 shadow-2xs"
            >
              <Package className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Product Catalog</span> ({products.length})
            </Button>

            <Badge
              variant="outline"
              className={`hidden sm:flex text-[11px] font-medium gap-1.5 ${
                isStaff
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }`}
            >
              <span className={`size-1.5 rounded-full ${isStaff ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />
              {user?.role || 'OWNER'} Mode
            </Badge>
          </div>
        </header>

        {/* Dynamic Main Body Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-border/60 py-4 px-4 sm:px-8 text-center text-xs text-muted-foreground">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              <span>ERJVPOS Enterprise Production Cloud Suite</span>
            </div>
            <span>v2.0</span>
          </div>
        </footer>
      </div>

      <ProductListModal
        open={isProductsModalOpen}
        onClose={() => setIsProductsModalOpen(false)}
      />
    </div>
  )
}
