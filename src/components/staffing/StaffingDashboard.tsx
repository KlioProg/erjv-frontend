import { useState } from 'react'
import { Users, Briefcase, Layers, Shield, LogOut, Package, Sparkles } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { ErjvPosLogo } from '@/components/ui/ErjvPosLogo'
import { useAuth } from '@/features/auth/AuthContext'
import { useEmployees, useJobs, useUsers } from '@/features/staffing/staffing.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { EmployeeList } from './EmployeeList'
import { JobList } from './JobList'
import { RoleGroupingView } from './RoleGroupingView'
import { UserRolesList } from './UserRolesList'
import { ProductListModal } from '../products/ProductListModal'

type StaffingDashboardProps = {
  onSwitchToOperations?: () => void
}

export function StaffingDashboard({ onSwitchToOperations }: StaffingDashboardProps = {}) {
  const { user, logout } = useAuth()
  const { data: employees = [] } = useEmployees()
  const { data: jobs = [] } = useJobs()
  const { data: users = [] } = useUsers()
  const { data: products = [] } = useProducts()

  const [activeTab, setActiveTab] = useState<'employees' | 'jobs' | 'grouping' | 'users'>(
    'employees',
  )
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false)

  const activeEmployeesCount = employees.filter((e) => e.isActive).length
  const activeJobsCount = jobs.filter((j) => j.isActive).length

  return (
    <div className="min-h-svh w-full bg-background flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/85 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <ErjvPosLogo />
            <div className="hidden md:flex items-center gap-1.5 pl-6 border-l border-border">
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] font-semibold text-primary bg-primary/10"
              >
                <Sparkles className="size-3" />
                Staffing & HR Management
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchToOperations && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8.5 gap-1.5 shadow-2xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={onSwitchToOperations}
              >
                <Layers className="size-3.5" />
                Operations & Logistics
              </Button>
            )}

            {/* View Products Preview Button */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold h-8.5 gap-1.5 shadow-xs"
              onClick={() => setIsProductsModalOpen(true)}
            >
              <Package className="size-3.5 text-primary" />
              Products ({products.length})
            </Button>

            {/* User Profile & Role Info */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <Avatar className="size-8 ring-1 ring-border">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                  {user?.email || 'Authenticated User'}
                </span>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1.5 font-bold uppercase tracking-wider text-primary border-primary/30"
                  >
                    {user?.role || 'OWNER'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Logout Action */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Staff</span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {activeEmployeesCount}
              </span>
              <span className="text-[11px] text-muted-foreground">employees</span>
            </div>
          </Card>

          <Card className="p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Job Positions</span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Briefcase className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {activeJobsCount}
              </span>
              <span className="text-[11px] text-muted-foreground">roles active</span>
            </div>
          </Card>

          <Card className="p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Registered Users</span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Shield className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {users.length}
              </span>
              <span className="text-[11px] text-muted-foreground">accounts</span>
            </div>
          </Card>

          <Card
            className="p-4 shadow-xs cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setIsProductsModalOpen(true)}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Inventory Items</span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                <Package className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {products.length}
              </span>
              <span className="text-[11px] text-muted-foreground">products catalog</span>
            </div>
          </Card>
        </div>

        {/* Primary Management Tabs */}
        <div className="w-full">
          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(val as 'employees' | 'jobs' | 'grouping' | 'users')
            }
            className="w-full flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b pb-3">
              <TabsList className="h-10 p-1 bg-secondary/80 justify-start w-full sm:w-auto">
                <TabsTrigger value="employees" className="gap-1.5 text-xs">
                  <Users className="size-3.5" />
                  Employee Directory
                </TabsTrigger>
                <TabsTrigger value="jobs" className="gap-1.5 text-xs">
                  <Briefcase className="size-3.5" />
                  Job Positions
                </TabsTrigger>
                <TabsTrigger value="grouping" className="gap-1.5 text-xs">
                  <Layers className="size-3.5" />
                  Grouped by Role
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1.5 text-xs">
                  <Shield className="size-3.5" />
                  User Roles
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="employees" className="mt-0 focus-visible:outline-none">
              <EmployeeList />
            </TabsContent>

            <TabsContent value="jobs" className="mt-0 focus-visible:outline-none">
              <JobList />
            </TabsContent>

            <TabsContent value="grouping" className="mt-0 focus-visible:outline-none">
              <RoleGroupingView />
            </TabsContent>

            <TabsContent value="users" className="mt-0 focus-visible:outline-none">
              <UserRolesList />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Product Catalog Live Modal */}
      <ProductListModal open={isProductsModalOpen} onClose={() => setIsProductsModalOpen(false)} />
    </div>
  )
}
