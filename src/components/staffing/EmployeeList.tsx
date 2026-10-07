import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useState } from 'react'
import {
  Search,
  UserPlus,
  Briefcase,
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
  useEmployeeJobs,
} from '@/features/staffing/staffing.hooks'
import type { Employee } from '@/features/staffing/staffing.types'
import { EmployeeModal } from './EmployeeModal'
import { PositionAssignModal } from './PositionAssignModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Card } from '../ui/card'

// Inline helper subcomponent for displaying assigned positions badge
function EmployeeJobBadges({ employeeId }: { employeeId: number }) {
  const { data: assigned = [], isLoading } = useEmployeeJobs(employeeId)

  if (isLoading) {
    return <span className="text-[11px] text-muted-foreground">Loading...</span>
  }

  if (assigned.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
        Unassigned
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assigned.map((ej: { jobId: number; job: { name: string } }) => (
        <Badge
          key={ej.jobId}
          variant="secondary"
          className="text-[10px] font-medium py-0 px-2 bg-primary/10 text-primary border-primary/20"
        >
          {ej.job.name}
        </Badge>
      ))}
    </div>
  )
}

export function EmployeeList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: allEmployees = [], isLoading, error, refetch } = useAllEmployees()
  const deactivateMutation = useDeactivateEmployee({
    onViewArchive: () => setActiveTab('ARCHIVED'),
  })
  const reactivateMutation = useReactivateEmployee()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null)
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

  const handleAssignPositions = (emp: Employee) => {
    setAssigningEmployee(emp)
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

  const isEmptyState = !isLoading && !error && filteredEmployees.length === 0

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
                  className={`text-xs font-bold ${
                    isArchived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-xs">
                    {emp.firstName} {emp.lastName}
                  </span>
                  {isArchived && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-[9px] font-bold px-1.5 py-0"
                    >
                      Deactivated
                    </Badge>
                  )}
                </div>
                {emp.address && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
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
            <div className="flex flex-col gap-0.5 text-xs">
              {emp.email ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="size-3 text-muted-foreground/70" />
                  {emp.email}
                </span>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
              {emp.phone && (
                <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                  <Phone className="size-3 text-muted-foreground/70" />
                  {emp.phone}
                </span>
              )}
            </div>
          </>
        )
      case 'positions':
        return (
          <>
            <EmployeeJobBadges employeeId={emp.id} />
          </>
        )
      case 'hireDate':
        return (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 text-[11px] font-semibold gap-1"
              >
                <ShieldCheck className="size-3 text-emerald-600" />
                Linked (ID #{emp.userId})
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground/70">Unlinked</span>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleReactivate(emp)}
                    disabled={isReactivatingThis}
                    className="group h-8.5 px-3.5 gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 rounded-xl shadow-2xs cursor-pointer transition-all duration-150"
                  >
                    {isReactivatingThis ? (
                      <Spinner className="size-3.5 text-emerald-600 dark:text-emerald-600 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5 text-emerald-600 dark:text-emerald-600 transition-transform duration-200 group-hover:-rotate-45" />
                    )}
                    <span>{isReactivatingThis ? 'Reactivating...' : 'Reactivate Profile'}</span>
                  </Button>
                )
              })()
            ) : (
              <DataTableActions
                onEdit={() => handleEdit(emp)}
                onArchive={() => handleDeactivate(emp)}
                isPending={deactivateMutation.isPending}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 min-w-8 shrink-0 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11 sm:px-3"
                  onClick={() => handleAssignPositions(emp)}
                  title="Assign Roles"
                  aria-label="Assign Roles"
                  disabled={deactivateMutation.isPending}
                >
                  <Briefcase aria-hidden="true" />
                  <span className="hidden sm:inline">Assign Roles</span>
                </Button>
              </DataTableActions>
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search employees by name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        {activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} className="shadow-sm font-semibold cursor-pointer">
            <UserPlus data-icon="inline-start" className="size-4" />
            Register Employee
          </Button>
        )}
      </div>

      {/* Employees Table Card */}
      <div
        className={`rounded-2xl border shadow-xs overflow-hidden ${
          isEmptyState
            ? 'border-dashed bg-muted/20'
            : 'border-0 bg-transparent shadow-none overflow-visible'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading employee directory...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="size-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-3 shadow-2xs">
              <AlertCircle className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Unable to load employees</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              We encountered an issue connecting to the service. Please check your network
              connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4 gap-2 text-xs font-semibold shadow-2xs border-border/80 hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Try Again
            </Button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card className="flex flex-col min-h-[360px] items-center justify-center border-0 bg-transparent shadow-none">
            <Users className="size-10 text-muted-foreground/50 mb-3" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
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
                  className="mt-3 text-xs gap-1.5 cursor-pointer"
                >
                  <Archive className="size-3.5 text-amber-600" />
                  View Archived Staff ({archivedEmployees.length})
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <DataTable
            data={filteredEmployees}
            columns={employeeColumns}
            getRowKey={(row) => row.id}
            pagination={false}
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

      {/* Position Assignment Modal */}
      <PositionAssignModal
        employee={assigningEmployee}
        open={!!assigningEmployee}
        onClose={() => setAssigningEmployee(null)}
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
