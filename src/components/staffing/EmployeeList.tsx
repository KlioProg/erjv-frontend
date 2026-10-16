import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useState } from 'react'
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Users,
  Archive,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllEmployees,
  useDeactivateEmployee,
  useReactivateEmployee,
} from '@/features/staffing/staffing.hooks'
import type { Employee } from '@/features/staffing/staffing.types'
import { EmployeeModal } from './EmployeeModal'
import { EmployeePositionSelector } from './EmployeePositionSelector'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function EmployeeList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: allEmployees = [], isLoading, error, refetch } = useAllEmployees()
  const deactivateMutation = useDeactivateEmployee({
    onViewArchive: () => setActiveTab('ARCHIVED'),
  })
  const reactivateMutation = useReactivateEmployee()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null)

  const activeEmployees = allEmployees.filter((emp) => emp.isActive !== false)
  const archivedEmployees = allEmployees.filter((emp) => emp.isActive === false)
  const currentEmployees = activeTab === 'ACTIVE' ? activeEmployees : archivedEmployees

  const filteredEmployees = currentEmployees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
    const email = (emp.email || '').toLowerCase()
    const phone = (emp.phone || '').toLowerCase()
    const q = searchQuery.toLowerCase()
    return fullName.includes(q) || email.includes(q) || phone.includes(q)
  })

  const handleCreate = () => {
    setSelectedEmployee(null)
    setIsModalOpen(true)
  }

  const handleEdit = (emp: Employee) => {
    setSelectedEmployee(emp)
    setIsModalOpen(true)
  }

  const handleDeactivate = (emp: Employee) => {
    setEmployeeToDeactivate(emp)
  }

  const confirmDeactivate = async () => {
    if (employeeToDeactivate) {
      const emp = employeeToDeactivate
      setEmployeeToDeactivate(null)
      await deactivateMutation.mutateAsync(emp)
    }
  }

  const handleReactivate = (emp: Employee) => {
    reactivateMutation.mutate(emp)
  }

  const renderEmployeeCell = (
    emp: Employee,
    column: 'employee' | 'contact' | 'positions' | 'hireDate' | 'account' | 'actions',
  ) => {
    const initials = (emp.firstName.charAt(0) + emp.lastName.charAt(0)).toUpperCase()
    const formattedHireDate = emp.hireDate
      ? new Date(emp.hireDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'
    const isArchived = emp.isActive === false
    switch (column) {
      case 'employee':
        return (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="size-9 ring-1 ring-border">
                <AvatarFallback
                  className={`text-ui font-medium ${
                    isArchived ? 'bg-muted text-muted-foreground' : 'bg-secondary text-foreground'
                  }`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {emp.firstName} {emp.lastName}
                  </span>
                </div>
                {emp.address && (
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {emp.address}
                  </span>
                )}
              </div>
            </div>
          </>
        )
      case 'contact':
        return (
          <>
            <div className="flex flex-col gap-1 text-sm">
              {emp.email ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="size-3 text-muted-foreground" />
                  {emp.email}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {emp.phone && (
                <span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
                  <Phone className="size-3 text-muted-foreground" />
                  {emp.phone}
                </span>
              )}
            </div>
          </>
        )
      case 'positions':
        return (
          <EmployeePositionSelector
            employeeId={emp.id}
            employeeName={`${emp.firstName} ${emp.lastName}`}
            canEdit={!isArchived}
          />
        )
      case 'hireDate':
        return (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
              <Calendar className="size-3" />
              {formattedHireDate}
            </span>
          </>
        )
      case 'account':
        return (
          <>
            {emp.userId ? (
              <Badge
                variant="outline"
                className="bg-status-success text-status-success-foreground border-status-success-foreground/20 text-xs font-medium gap-1"
              >
                <ShieldCheck className="size-3" />
                Linked (ID #{emp.userId})
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Unlinked</span>
            )}
          </>
        )
      case 'actions':
        return (
          <>
            {isArchived ? (
              (() => {
                const isReactivatingThis =
                  reactivateMutation.isPending &&
                  (typeof reactivateMutation.variables === 'number'
                    ? reactivateMutation.variables === emp.id
                    : reactivateMutation.variables?.id === emp.id)

                return (
                  <DataTableActions
                    onRestore={() => handleReactivate(emp)}
                    restoreLabel="Reactivate Profile"
                    isPending={isReactivatingThis}
                  />
                )
              })()
            ) : (
              <DataTableActions
                onEdit={() => handleEdit(emp)}
                onArchive={() => handleDeactivate(emp)}
                isPending={deactivateMutation.isPending}
              />
            )}
          </>
        )
      default:
        return null
    }
  }

  const employeeColumns: ColumnDef<Employee>[] = [
    { id: 'employee', header: 'Employee', cell: ({ row }) => renderEmployeeCell(row, 'employee') },
    { id: 'contact', header: 'Contact', cell: ({ row }) => renderEmployeeCell(row, 'contact') },
    {
      id: 'assigned-roles-positions',
      header: 'Assigned Roles / Positions',
      cell: ({ row }) => renderEmployeeCell(row, 'positions'),
    },
    {
      id: 'hire-date',
      header: 'Hire Date',
      cell: ({ row }) => renderEmployeeCell(row, 'hireDate'),
    },
    {
      id: 'user-account',
      header: 'User Account',
      cell: ({ row }) => renderEmployeeCell(row, 'account'),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'w-px whitespace-nowrap',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row }) => renderEmployeeCell(row, 'actions'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader>Staff Directory</PageHeader>
      {/* Staff Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Staff"
        activeCount={activeEmployees.length}
        archivedLabel="Archived Staff"
        archivedCount={archivedEmployees.length}
        activeIcon={<Users className="size-3.5" />}
        bannerDescription="Showing deactivated staff profiles. Historical assignments and user credentials are preserved and can be reactivated at any time."
      />

      {/* Search and Action Bar */}
      <PageToolbar>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search staff"
            placeholder="Search employees by name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        {activeTab === 'ACTIVE' && (
          <Button size="sm" onClick={handleCreate} className="font-medium cursor-pointer">
            <UserPlus data-icon="inline-start" className="size-4" />
            Register Employee
          </Button>
        )}
      </PageToolbar>

      {/* Employees Table Card */}
      <div className="min-w-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading employee directory...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <AlertCircle className="mb-3 size-6 text-destructive" />
            <h3 className="text-sm font-medium text-foreground">Unable to load employees</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              We encountered an issue connecting to the service. Please check your network
              connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4 gap-2 text-ui font-medium border-border/80 hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Try Again
            </Button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 py-12">
            <Users className="size-10 text-muted-foreground mb-3" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {activeTab === 'ACTIVE' ? 'No active employees found' : 'No archived staff found'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                {searchQuery
                  ? 'Try adjusting your search criteria.'
                  : activeTab === 'ACTIVE'
                    ? archivedEmployees.length > 0
                      ? `All staff records in this view are currently archived (${archivedEmployees.length} total).`
                      : 'Click "Register Employee" above to add your first staff member.'
                    : 'Archived staff profiles will appear here and can be reactivated at any time.'}
              </p>
              {!searchQuery && activeTab === 'ACTIVE' && archivedEmployees.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('ARCHIVED')}
                  className="mt-3 gap-2"
                >
                  <Archive className="size-3.5 text-status-warning-foreground" />
                  View Archived Staff ({archivedEmployees.length})
                </Button>
              )}
            </div>
          </div>
        ) : (
          <DataTable
            appearance="management"
            data={filteredEmployees}
            columns={employeeColumns}
            getRowKey={(row) => row.id}
            pageSizeOptions={[10, 25, 50, 100]}
            tableClassName="min-w-[980px]"
            rowClassName={(row) => (row.isActive === false ? 'bg-muted/10 opacity-75' : '')}
          />
        )}
      </div>

      {/* Registration & Edit Modal */}
      <EmployeeModal
        employee={selectedEmployee}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Themed Deactivation / Archive Modal */}
      <ConfirmDeleteModal
        open={!!employeeToDeactivate}
        onClose={() => setEmployeeToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Archive Employee Profile"
        description="Are you sure you want to archive this employee? They will be removed from active staff rosters. All profile details and role history are safely preserved and can be restored anytime from the Archived Staff tab."
        itemName={
          employeeToDeactivate
            ? `${employeeToDeactivate.firstName} ${employeeToDeactivate.lastName}`
            : undefined
        }
        itemDetails={
          employeeToDeactivate
            ? `Email: ${employeeToDeactivate.email || 'N/A'} • Phone: ${employeeToDeactivate.phone || 'N/A'}`
            : undefined
        }
        confirmText="Archive Employee"
        variant="destructive"
      />
    </div>
  )
}
