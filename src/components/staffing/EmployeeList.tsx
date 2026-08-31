import { useState } from 'react'
import {
  Search,
  UserPlus,
  MoreVertical,
  Briefcase,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Building2,
  Users,
  Archive,
  RotateCcw,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const { data: allEmployees = [], isLoading, error } = useAllEmployees()
  const deactivateMutation = useDeactivateEmployee()
  const reactivateMutation = useReactivateEmployee()

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
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
      await deactivateMutation.mutateAsync(employeeToDeactivate)
      setEmployeeToDeactivate(null)
    }
  }

  const handleReactivate = async (emp: Employee) => {
    await reactivateMutation.mutateAsync(emp)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Staff Tabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Users className="size-3.5" />
          Active Staff ({activeEmployees.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ARCHIVED')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ARCHIVED'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Archive className="size-3.5" />
          Deactivated Staff ({archivedEmployees.length})
        </button>
      </div>

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
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading employee directory...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive gap-1 text-xs">
            <p className="font-semibold">Unable to fetch employees from backend server.</p>
            <p className="text-muted-foreground">Make sure the backend is running on port 3000.</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Building2 className="size-8 stroke-[1.5] text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {activeTab === 'ACTIVE' ? 'No active employees found' : 'No deactivated staff found'}
            </p>
            <p className="text-xs">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : activeTab === 'ACTIVE'
                  ? 'Click "Register Employee" above to add your first staff member.'
                  : 'Deactivated staff profiles will appear here and can be reactivated at any time.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Assigned Roles / Positions</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead>User Account</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const initials = `${emp.firstName.charAt(0)}${emp.lastName.charAt(0)}`.toUpperCase()
                const formattedHireDate = emp.hireDate
                  ? new Date(emp.hireDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'
                const isArchived = emp.isActive === false

                return (
                  <TableRow
                    key={emp.id}
                    className={`hover:bg-muted/30 ${isArchived ? 'opacity-75 bg-muted/10' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 ring-1 ring-border">
                          <AvatarFallback
                            className={`text-xs font-bold ${
                              isArchived
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary'
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
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell>
                      <EmployeeJobBadges employeeId={emp.id} />
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {formattedHireDate}
                      </span>
                    </TableCell>

                    <TableCell>
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
                    </TableCell>

                    <TableCell className="text-right">
                      {isArchived ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReactivate(emp)}
                          disabled={reactivateMutation.isPending}
                          className="h-8.5 px-3.5 gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl shadow-2xs cursor-pointer transition-all"
                        >
                          <RotateCcw className="size-3.5" />
                          Reactivate Profile
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 cursor-pointer">
                              <MoreVertical className="size-4" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Staff Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleAssignPositions(emp)}>
                                <Briefcase className="size-4 mr-2 text-primary" />
                                Assign Roles
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(emp)}>
                                <Edit2 className="size-4 mr-2" />
                                Edit Profile
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => handleDeactivate(emp)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                              >
                                <Trash2 className="size-4 mr-2" />
                                Deactivate Employee
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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

      {/* Themed Deactivation Modal */}
      <ConfirmDeleteModal
        open={!!employeeToDeactivate}
        onClose={() => setEmployeeToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate Employee Profile"
        description="Are you sure you want to deactivate this employee? They will no longer be listed in active staff rosters."
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
        confirmText="Deactivate Employee"
        variant="destructive"
      />
    </div>
  )
}
