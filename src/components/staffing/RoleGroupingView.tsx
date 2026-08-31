import { useState } from 'react'
import {
  Users,
  Briefcase,
  UserX,
  UserPlus,
  Shield,
  CheckCircle2,
  Crown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  useJobs,
  useEmployees,
  useJobEmployees,
  useAssignEmployeeJob,
  useRemoveEmployeeJob,
  useUsers,
} from '@/features/staffing/staffing.hooks'
import { normalizeUserRole } from '@/features/auth/AuthContext'
import type { Job, Employee } from '@/features/staffing/staffing.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

// Single job position section with member cards and quick assignment
function JobPositionSection({ job, allEmployees }: { job: Job; allEmployees: Employee[] }) {
  const { data: members = [], isLoading } = useJobEmployees(job.id)
  const assignMutation = useAssignEmployeeJob()
  const removeMutation = useRemoveEmployeeJob()

  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ employeeId: number; name: string } | null>(null)

  // Unassigned employees for this specific job
  const assignedEmployeeIds = members.map((m: { employeeId: number }) => m.employeeId)
  const availableToAssign = allEmployees.filter(
    (emp) => !assignedEmployeeIds.includes(emp.id) && emp.isActive
  )

  const handleAssign = async () => {
    if (!selectedEmpId) return
    await assignMutation.mutateAsync({
      employeeId: Number(selectedEmpId),
      jobId: job.id,
    })
    setSelectedEmpId('')
    setIsAssigning(false)
  }

  const handleRemove = (employeeId: number, name: string) => {
    setMemberToRemove({ employeeId, name })
  }

  const confirmRemove = async () => {
    if (memberToRemove) {
      await removeMutation.mutateAsync({
        employeeId: memberToRemove.employeeId,
        jobId: job.id,
      })
      setMemberToRemove(null)
    }
  }

  return (
    <Card className="border border-border/80 shadow-xs overflow-hidden rounded-2xl">
      <ConfirmDeleteModal
        open={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={confirmRemove}
        title="Remove Employee from Role"
        description="Are you sure you want to unassign this employee from this position? They will no longer hold this designation."
        itemName={memberToRemove?.name}
        itemDetails={`Role: ${job.name}`}
        confirmText="Remove from Role"
        variant="destructive"
      />
      <CardHeader className="bg-muted/30 p-4 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-foreground">{job.name}</CardTitle>
                <Badge variant="secondary" className="text-[10px] font-semibold py-0 px-2">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {job.description || 'General operational department and staff roles.'}
              </p>
            </div>
          </div>

          {/* Quick Assign Action */}
          <div className="flex items-center gap-2 w-full sm:w-auto self-end sm:self-center">
            {isAssigning ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-48 bg-card">
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAssign.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">All active staff assigned</div>
                    ) : (
                      availableToAssign.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.firstName} {emp.lastName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedEmpId || assignMutation.isPending}
                  className="h-8 text-xs font-bold gap-1 cursor-pointer"
                >
                  {assignMutation.isPending ? <Spinner className="size-3" /> : 'Assign'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAssigning(false)}
                  className="h-8 text-xs text-muted-foreground cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssigning(true)}
                className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <UserPlus className="size-3.5 text-primary" />
                Assign Member
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <Spinner className="size-4 text-primary" />
            Loading assigned staff...
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
            No employees currently assigned to the {job.name} role.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m: { employeeId: number; assignedAt?: string; employee: { firstName: string; lastName: string; phone?: string | null; email?: string | null } }) => {
              const emp = m.employee
              const initials = `${emp.firstName.charAt(0)}${emp.lastName.charAt(0)}`.toUpperCase()

              return (
                <div
                  key={m.employeeId}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8 ring-1 ring-border">
                      <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        {emp.firstName} {emp.lastName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ID #{m.employeeId} •{' '}
                        {m.assignedAt
                          ? new Date(m.assignedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Assigned'}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => handleRemove(m.employeeId, `${emp.firstName} ${emp.lastName}`)}
                    title="Remove from role"
                  >
                    <UserX className="size-3.5" />
                    <span className="sr-only">Remove from role</span>
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RoleGroupingView() {
  const { data: jobs = [], isLoading: isJobsLoading } = useJobs()
  const { data: employees = [] } = useEmployees()
  const { data: users = [], isLoading: isUsersLoading } = useUsers()

  const [viewMode, setViewMode] = useState<'SYSTEM_ROLE' | 'JOB_POSITION'>('SYSTEM_ROLE')

  const ownerUsers = users.filter((u) => {
    const rec = u as unknown as Record<string, unknown>
    return normalizeUserRole(u.role || rec.userRole) === 'OWNER'
  })
  const adminUsers = users.filter((u) => {
    const rec = u as unknown as Record<string, unknown>
    return normalizeUserRole(u.role || rec.userRole) === 'ADMIN'
  })
  const staffUsers = users.filter((u) => {
    const rec = u as unknown as Record<string, unknown>
    return normalizeUserRole(u.role || rec.userRole) === 'STAFF'
  })

  const getLinkedEmployee = (userId: number, email?: string) => {
    return employees.find(
      (e) => e.userId === userId || (email && e.email?.toLowerCase() === email.toLowerCase())
    )
  }

  const renderUserCards = (userList: typeof users, tierBadge: string, tierColor: string) => {
    if (userList.length === 0) {
      return (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
          No users assigned to this role tier yet.
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {userList.map((u) => {
          const emp = getLinkedEmployee(u.id, u.email)
          const displayName =
            u.fullName || (emp ? `${emp.firstName} ${emp.lastName}` : u.email.split('@')[0])
          const initial = displayName.charAt(0).toUpperCase()

          return (
            <div
              key={u.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all shadow-2xs gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="size-8.5 ring-1 ring-border shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs font-bold text-foreground truncate">
                      {displayName}
                    </span>
                    {emp && (
                      <span title="Linked Staff Profile" className="inline-flex">
                        <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono truncate">
                    {u.email}
                  </span>
                </div>
              </div>

              <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${tierColor}`}>
                {tierBadge}
              </Badge>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Staffing Grouped by Role
          </h3>
          <p className="text-xs text-muted-foreground">
            Explore database accounts grouped by System Role hierarchy or operational Job Positions.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border/60">
          <Button
            variant={viewMode === 'SYSTEM_ROLE' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('SYSTEM_ROLE')}
            className="h-7 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Shield className="size-3 text-primary" />
            System Roles ({users.length})
          </Button>
          <Button
            variant={viewMode === 'JOB_POSITION' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('JOB_POSITION')}
            className="h-7 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Briefcase className="size-3 text-primary" />
            Job Positions ({jobs.length})
          </Button>
        </div>
      </div>

      {viewMode === 'SYSTEM_ROLE' ? (
        isUsersLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading database user accounts...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 1. Super Admins (Owners) */}
            <Card className="border border-primary/20 shadow-2xs overflow-hidden rounded-2xl">
              <CardHeader className="bg-primary/5 p-4 border-b border-primary/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs">
                      <Crown className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">
                          Enterprise Owners (Owner)
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
                          {ownerUsers.length} {ownerUsers.length === 1 ? 'member' : 'members'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Full enterprise authority across all logistics, HR, and role assignments.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {renderUserCards(ownerUsers, 'OWNER', 'bg-primary/10 text-primary border-primary/30')}
              </CardContent>
            </Card>

            {/* 2. System Administrators */}
            <Card className="border border-border/80 shadow-2xs overflow-hidden rounded-2xl">
              <CardHeader className="bg-muted/40 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Shield className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">
                          System Administrators (Admins)
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {adminUsers.length} {adminUsers.length === 1 ? 'member' : 'members'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Full operational oversight, inventory management, and staff directory management.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {renderUserCards(adminUsers, 'ADMIN', 'bg-blue-500/10 text-blue-600 border-blue-200')}
              </CardContent>
            </Card>

            {/* 3. Operational Staff */}
            <Card className="border border-border/80 shadow-2xs overflow-hidden rounded-2xl">
              <CardHeader className="bg-muted/30 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">
                          Operational Staff & Logistics Personnel
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {staffUsers.length} {staffUsers.length === 1 ? 'member' : 'members'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Standard accounts with access restricted to Operations, Stock, and CRM modules.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {renderUserCards(staffUsers, 'STAFF', 'bg-muted text-muted-foreground border-border')}
              </CardContent>
            </Card>
          </div>
        )
      ) : (
        /* Grouped by Job Position */
        isJobsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading job positions...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 border rounded-2xl bg-card">
            <Briefcase className="size-8 stroke-[1.5] text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No job positions configured</p>
            <p className="text-xs">Create job positions in the Job Positions tab.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map((job) => (
              <JobPositionSection key={job.id} job={job} allEmployees={employees} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
