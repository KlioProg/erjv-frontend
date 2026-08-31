import { useState } from 'react'
import {
  Warehouse as WarehouseIcon,
  Boxes,
  Truck,
  Package,
  Layers,
  LogOut,
  Sparkles,
  Users,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { ErjvPosLogo } from '@/components/ui/ErjvPosLogo'
import { useAuth } from '@/features/auth/AuthContext'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { WarehouseList } from './WarehouseList'
import { InventoryStockList } from './InventoryStockList'
import { VehicleList } from './VehicleList'

type OperationsDashboardProps = {
  onSwitchToStaffing?: () => void
}

export function OperationsDashboard({ onSwitchToStaffing }: OperationsDashboardProps) {
  const { user, logout } = useAuth()
  const { data: warehouses = [] } = useWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const { data: vehicles = [] } = useDeliveryVehicles()
  const { data: products = [] } = useProducts()

  const [activeTab, setActiveTab] = useState<string>('inventory')

  const totalStockUnits = stockItems.reduce((acc, s) => acc + parseFloat(s.quantity), 0)
  const availableVehiclesCount = vehicles.filter((v) => v.status === 'AVAILABLE').length

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U'

  return (
    <div className="min-h-svh bg-background text-foreground flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <ErjvPosLogo />

            <div className="hidden md:flex items-center gap-1.5 pl-4 border-l border-border/60">
              <Badge variant="secondary" className="font-semibold text-xs gap-1 py-0.5 px-2.5">
                <Layers className="size-3 text-primary" />
                Operations & Logistics
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchToStaffing && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToStaffing}
                className="hidden sm:flex text-xs font-semibold gap-1.5 h-8.5 shadow-2xs"
              >
                <Users className="size-3.5 text-primary" />
                Switch to Staffing & HR
              </Button>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-border/60">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold leading-none text-foreground truncate max-w-[140px]">
                  {user?.email}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {user?.role} Access
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="size-8 text-muted-foreground hover:text-destructive transition-colors"
              title="Sign Out"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* KPI Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Warehouses</span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <WarehouseIcon className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-foreground">{warehouses.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Logistics & distribution hubs</p>
            </div>
          </Card>

          <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Stored Units</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Boxes className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-foreground">
                {totalStockUnits.toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across all facilities</p>
            </div>
          </Card>

          <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Available Fleet</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Truck className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-foreground">
                {availableVehiclesCount} <span className="text-sm font-normal text-muted-foreground">/ {vehicles.length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ready for dispatch</p>
            </div>
          </Card>

          <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Catalog Products</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Package className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-foreground">{products.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active product catalog</p>
            </div>
          </Card>
        </div>

        {/* Navigation Tabs and Active Views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
            <TabsList className="bg-secondary/70 p-1">
              <TabsTrigger value="inventory" className="gap-1.5 text-xs">
                <Boxes className="size-3.5" />
                Inventory & Stock
              </TabsTrigger>
              <TabsTrigger value="warehouses" className="gap-1.5 text-xs">
                <WarehouseIcon className="size-3.5" />
                Warehouses
              </TabsTrigger>
              <TabsTrigger value="fleet" className="gap-1.5 text-xs">
                <Truck className="size-3.5" />
                Delivery Fleet
              </TabsTrigger>
            </TabsList>

            {onSwitchToStaffing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSwitchToStaffing}
                className="sm:hidden text-xs text-primary font-medium gap-1"
              >
                <Users className="size-3" /> Switch to Staffing & HR →
              </Button>
            )}
          </div>

          <TabsContent value="inventory" className="focus-visible:outline-none">
            <InventoryStockList />
          </TabsContent>

          <TabsContent value="warehouses" className="focus-visible:outline-none">
            <WarehouseList />
          </TabsContent>

          <TabsContent value="fleet" className="focus-visible:outline-none">
            <VehicleList />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary" />
            <span>ERJVPOS Operations & Logistics Enterprise Suite</span>
          </div>
          <span>v2.0</span>
        </div>
      </footer>
    </div>
  )
}
