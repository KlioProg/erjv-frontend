import { useState, useMemo } from 'react'
import {
  Boxes,
  Warehouse as WarehouseIcon,
  Truck,
  Package,
  Building2,
  Users,
  Briefcase,
  Layers,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DashboardLayout, type NavItemKey } from '../layout/DashboardLayout'
import { InventoryStockList } from '../operations/InventoryStockList'
import { WarehouseList } from '../operations/WarehouseList'
import { VehicleList } from '../operations/VehicleList'
import { ClientList } from '../crm/ClientList'
import { EmployeeList } from '../staffing/EmployeeList'
import { JobList } from '../staffing/JobList'
import { RoleGroupingView } from '../staffing/RoleGroupingView'
import { UserRolesList } from '../staffing/UserRolesList'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useEmployees, useJobs } from '@/features/staffing/staffing.hooks'
import { useAuth } from '@/features/auth/AuthContext'

export function MainDashboard() {
  const [currentTab, setCurrentTab] = useState<NavItemKey>('inventory')
  const { isStaff } = useAuth()

  const { data: warehouses = [] } = useWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const { data: vehicles = [] } = useDeliveryVehicles()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: employees = [] } = useEmployees()
  const { data: jobs = [] } = useJobs()

  const totalStockUnits = useMemo(
    () => stockItems.reduce((acc, s) => acc + parseFloat(s.quantity || '0'), 0),
    [stockItems]
  )
  const availableVehiclesCount = useMemo(
    () => vehicles.filter((v) => v.status === 'AVAILABLE').length,
    [vehicles]
  )
  const activeStaffCount = useMemo(
    () => employees.filter((e) => e.isActive).length,
    [employees]
  )

  const isOperationsTab =
    currentTab === 'inventory' || currentTab === 'warehouses' || currentTab === 'fleet'

  const isStaffingTab =
    currentTab === 'employees' ||
    currentTab === 'jobs' ||
    currentTab === 'grouping' ||
    currentTab === 'users'

  // Safety fallback if staff clicks restricted tab
  const effectiveTab = isStaff && isStaffingTab ? 'inventory' : currentTab

  return (
    <DashboardLayout currentTab={effectiveTab} onSelectTab={setCurrentTab}>
      <div className="flex flex-col gap-6">
        {/* KPI Top Bar when inside Operations */}
        {isOperationsTab && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Warehouse Locations</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <WarehouseIcon className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{warehouses.length}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Active facilities & storage hubs</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Stored Units</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Boxes className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">
                  {totalStockUnits.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">units</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Inventory across storage hubs</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Available Fleet</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Truck className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">
                  {availableVehiclesCount}{' '}
                  <span className="text-sm font-normal text-muted-foreground">/ {vehicles.length} vehicles</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ready for order dispatch</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Catalog Products</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Package className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{products.length}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Active product catalog items</p>
              </div>
            </Card>
          </div>
        )}

        {/* KPI Top Bar when inside CRM */}
        {effectiveTab === 'clients' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Commercial Clients</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{clients.length}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Supermarkets, distributors & retailers</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Active Products</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Package className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{products.length} Products</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ready for POS & wholesale orders</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Delivery Fleet Ready</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Truck className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{availableVehiclesCount} Vehicles</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fleet units on standby</p>
              </div>
            </Card>
          </div>
        )}

        {/* KPI Top Bar when inside Staffing & HR */}
        {isStaffingTab && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Active Staff Members</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{activeStaffCount}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Operations, logistics & administration</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Job Roles Defined</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <Briefcase className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{jobs.length}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Organizational designations</p>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border/80 shadow-xs flex flex-col justify-between rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Warehouse Hubs</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Layers className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-foreground">{warehouses.length} Facilities</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fulfillment & distribution centers</p>
              </div>
            </Card>
          </div>
        )}

        {/* Lightweight Main Section Card View */}
        <Card className="border-border/80 bg-card shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            {effectiveTab === 'inventory' && <InventoryStockList />}
            {effectiveTab === 'warehouses' && <WarehouseList />}
            {effectiveTab === 'fleet' && <VehicleList />}
            {effectiveTab === 'clients' && <ClientList />}
            {effectiveTab === 'employees' && <EmployeeList />}
            {effectiveTab === 'jobs' && <JobList />}
            {effectiveTab === 'grouping' && <RoleGroupingView />}
            {effectiveTab === 'users' && <UserRolesList />}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
