import { useState } from 'react'
import { Briefcase, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useEmployeeJobs,
  useJobs,
  useReplaceEmployeeJobs,
} from '@/features/staffing/staffing.hooks'
import type { Employee } from '@/features/staffing/staffing.types'
import { getErrorMessage } from '@/lib/api-client'

type PositionAssignModalProps = {
  employee: Employee | null
  open: boolean
  onClose: () => void
}

function PositionAssignContent({
  employee,
  onClose,
}: {
  employee: Employee
  onClose: () => void
}) {
  const { data: allJobs = [], isLoading: isLoadingJobs } = useJobs()
  const { data: assignedJobs = [], isLoading: isLoadingAssigned } = useEmployeeJobs(employee.id)
  const replaceJobsMutation = useReplaceEmployeeJobs()

  const [selectedJobIds, setSelectedJobIds] = useState<number[]>(() =>
    assignedJobs ? assignedJobs.map((ej: { jobId: number }) => ej.jobId) : []
  )
  const [errorMsg, setErrorMsg] = useState('')

  // Sync selection when initial data loads
  const currentAssignedIds = assignedJobs.map((ej: { jobId: number }) => ej.jobId)
  const effectiveSelectedIds = selectedJobIds.length > 0 ? selectedJobIds : currentAssignedIds

  const handleToggle = (jobId: number) => {
    setSelectedJobIds((prev) => {
      const base = prev.length > 0 ? prev : currentAssignedIds
      return base.includes(jobId) ? base.filter((id: number) => id !== jobId) : [...base, jobId]
    })
  }

  const handleSave = async () => {
    setErrorMsg('')
    try {
      await replaceJobsMutation.mutateAsync({
        employeeId: employee.id,
        jobIds: effectiveSelectedIds,
      })
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const isPending = replaceJobsMutation.isPending || isLoadingJobs || isLoadingAssigned

  return (
    <>
      <DialogHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
          <Briefcase className="size-5" />
        </div>
        <DialogTitle>Assign Job Positions</DialogTitle>
        <DialogDescription>
          Select the positions and roles assigned to{' '}
          <span className="font-semibold text-foreground">
            {employee.firstName} {employee.lastName}
          </span>
          .
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2.5 py-2 max-h-[300px] overflow-y-auto">
        {isLoadingJobs ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Spinner className="mr-2 size-4" /> Loading positions...
          </div>
        ) : allJobs.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">
            No job positions available. Please create job positions first.
          </p>
        ) : (
          allJobs.map((job) => {
            const isChecked = effectiveSelectedIds.includes(job.id)
            return (
              <div
                key={job.id}
                onClick={() => handleToggle(job.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  isChecked
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  id={`job-${job.id}`}
                  checked={isChecked}
                  onCheckedChange={() => handleToggle(job.id)}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor={`job-${job.id}`}
                    className="text-xs font-semibold cursor-pointer text-foreground"
                  >
                    {job.name}
                  </Label>
                  {job.description && (
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {job.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              Saving...
            </>
          ) : (
            <>
              <Check data-icon="inline-start" className="size-4" />
              Save Assignments
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

export function PositionAssignModal({
  employee,
  open,
  onClose,
}: PositionAssignModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        {open && employee && (
          <PositionAssignContent
            key={`pos-assign-${employee.id}`}
            employee={employee}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
