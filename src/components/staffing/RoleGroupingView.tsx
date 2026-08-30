import { useState } from 'react'
import {
  Users,
  Briefcase,
  UserX,
  UserPlus,
  Shield,
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
} from '@/features/staffing/staffing.hooks'
import type { Job, Employee } from '@/features/staffing/staffing.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

// Single role section with member cards and quick assignment
function RoleSection({ job, allEmployees }: { job: Job; allEmployees: Employee[] }) {
  const { data: members = [], isLoading } = useJobEmployees(job.id)
  const assignMutation = useAssignEmployeeJob()
  const removeMutation = useRemoveEmployeeJob()

  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ employeeId: number; name: string } | null>(null)

  // Unassigned employees for this specific job
  const assignedEmployeeIds = members.map((m) => m.employeeId)
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
    <Card className="border border-border shadow-xs overflow-hidden">
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAssigning ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="w-full sm:w-56 h-8 text-xs bg-card">
                    <SelectValue placeholder="Select active employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAssign.length === 0 ? (
                      <SelectItem value="none" disabled>
                        All active staff assigned
                      </SelectItem>
                    ) : (
                      availableToAssign.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          {emp.firstName} {emp.lastName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-8 text-xs px-2.5"
                  onClick={handleAssign}
                  disabled={!selectedEmpId || selectedEmpId === 'none' || assignMutation.isPending}
                >
                  {assignMutation.isPending ? <Spinner className="size-3" /> : 'Assign'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => setIsAssigning(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 shadow-2xs"
                onClick={() => setIsAssigning(true)}
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
            {members.map((m) => {
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
                        {new Date(m.assignedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
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
  const { data: jobs = [], isLoading, error } = useJobs()
  const { data: employees = [] } = useEmployees()

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Summary Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Employees Grouped by Role</h3>
          <p className="text-xs text-muted-foreground">
            Explore operational staffing distribution and active department assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs py-1 px-3">
            <Users className="size-3 text-primary" />
            <span className="font-bold text-foreground">{employees.length}</span> Total Staff
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs py-1 px-3">
            <Shield className="size-3 text-primary" />
            <span className="font-bold text-foreground">{jobs.length}</span> Roles Defined
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-6 text-primary" />
          <p className="text-xs">Loading role groups...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive gap-1 text-xs">
          <p className="font-semibold">Unable to fetch roles from backend server.</p>
          <p className="text-muted-foreground">Make sure the backend is running on port 3000.</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 border rounded-2xl bg-card">
          <Briefcase className="size-8 stroke-[1.5] text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No roles configured</p>
          <p className="text-xs">Create job positions first to view employees grouped by role.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <RoleSection key={job.id} job={job} allEmployees={employees} />
          ))}
        </div>
      )}
    </div>
  )
}
