import { useState } from 'react'
import { Briefcase, ChevronDown, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllJobs,
  useEmployeeJobs,
  useReplaceEmployeeJobs,
} from '@/features/staffing/staffing.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type EmployeePositionSelectorProps = {
  employeeId: number
  employeeName: string
  canEdit: boolean
}

export function EmployeePositionSelector({
  employeeId,
  employeeName,
  canEdit,
}: EmployeePositionSelectorProps) {
  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    isError: hasJobsError,
    refetch: refetchJobs,
  } = useAllJobs()
  const {
    data: assignments = [],
    isLoading: isLoadingAssignments,
    isError: hasAssignmentsError,
    refetch: refetchAssignments,
  } = useEmployeeJobs(employeeId)
  const replaceJobsMutation = useReplaceEmployeeJobs()
  const [isSaving, setIsSaving] = useState(false)

  const assignedJobIds = assignments.map((assignment) => assignment.jobId)
  const isLoading = isLoadingJobs || isLoadingAssignments
  const hasError = hasJobsError || hasAssignmentsError

  const handleToggle = async (jobId: number, checked: boolean) => {
    const nextJobIds = checked
      ? [...assignedJobIds, jobId]
      : assignedJobIds.filter((id) => id !== jobId)

    setIsSaving(true)
    try {
      await replaceJobsMutation.mutateAsync({ employeeId, jobIds: nextJobIds })
      toast.success(checked ? 'Position assigned' : 'Position removed')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const positionLabel =
    assignments.length === 0
      ? 'Unassigned'
      : assignments.length === 1
        ? assignments[0].job.name
        : `${assignments.length} positions`
  const allPositionNames = assignments.map((assignment) => assignment.job.name).join(', ')
  const triggerContent = isLoading ? (
    <>
      <Spinner aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">Loading...</span>
    </>
  ) : (
    <>
      <Briefcase aria-hidden="true" className="size-3.5 shrink-0" />
      <OverflowValue
        value={positionLabel}
        fullValue={allPositionNames || positionLabel}
        className="flex-1 text-left"
      />
    </>
  )

  if (!canEdit) {
    return (
      <div
        title={hasError ? 'Roles unavailable' : allPositionNames || 'Unassigned'}
        className={cn(
          'inline-flex h-8 w-36 min-w-36 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold shadow-2xs pointer-coarse:h-11',
          'bg-primary/10 text-primary border-primary/25',
        )}
      >
        {hasError ? 'Roles unavailable' : triggerContent}
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <span>Roles unavailable</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 pointer-coarse:size-11 sm:size-7"
          aria-label={`Retry loading roles for ${employeeName}`}
          onClick={() => {
            void refetchJobs()
            void refetchAssignments()
          }}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 w-36 min-w-36 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold shadow-2xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11',
            'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/20',
          )}
          aria-label={`Change job positions for ${employeeName}; ${assignments.length} assigned`}
          disabled={isSaving || isLoading}
        >
          {triggerContent}
          {isSaving ? (
            <Spinner aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium text-foreground">Job positions</span>
          <span className="text-[11px] text-muted-foreground">
            {employeeName} · Select multiple positions
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {jobs.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            No job positions are available.
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuGroup>
            {jobs.map((job) => {
              const isAssigned = assignedJobIds.includes(job.id)

              return (
                <DropdownMenuCheckboxItem
                  key={job.id}
                  checked={isAssigned}
                  disabled={isSaving || (!job.isActive && !isAssigned)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => {
                    void handleToggle(job.id, checked)
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{job.name}</span>
                    {!job.isActive && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">Archived</span>
                    )}
                  </span>
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
