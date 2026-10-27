import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useAllJobs,
  useCreateJob,
  useUpdateJobDetails,
  useReactivateJob,
} from '@/features/staffing/staffing.hooks'
import type { Job } from '@/features/staffing/staffing.types'
import { getErrorMessage } from '@/lib/api-client'

type JobModalProps = {
  job: Job | null
  open: boolean
  onClose: () => void
}

function JobFormContent({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const isEditing = !!job
  const { data: allJobs = [] } = useAllJobs()
  const createMutation = useCreateJob()
  const updateMutation = useUpdateJobDetails()
  const reactivateMutation = useReactivateJob()

  const [name, setName] = useState(job?.name || '')
  const [description, setDescription] = useState(job?.description || '')
  const [errorMsg, setErrorMsg] = useState('')
  const [deactivatedJobMatch, setDeactivatedJobMatch] = useState<Job | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setDeactivatedJobMatch(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Job position name is required.')
      return
    }

    if (!isEditing) {
      const match = allJobs.find(
        (j) => j.name.toLowerCase() === cleanName.toLowerCase() && j.isActive === false,
      )
      if (match) {
        setDeactivatedJobMatch(match)
        return
      }
    }

    try {
      if (isEditing && job) {
        await updateMutation.mutateAsync({
          id: job.id,
          payload: {
            name: name.trim(),
            description: description.trim() || null,
          },
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          isActive: true,
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const handleRestoreFoundJob = async () => {
    try {
      if (deactivatedJobMatch) {
        await reactivateMutation.mutateAsync(deactivatedJobMatch.id)
        onClose()
      }
    } catch (error) {
      setErrorMsg(getErrorMessage(error))
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Job Position' : 'Create Job Position'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modify the title and description for this position.'
            : 'Add a new staffing position/role for the ERJVPOS team.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (!deactivatedJobMatch || reactivateMutation.isError) && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedJobMatch && (
        <div className="my-1 flex items-start gap-3 rounded-lg border border-status-warning-foreground/20 bg-status-warning p-4 text-status-warning-foreground">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-status-warning-foreground" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-foreground">Deactivated Position Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived job position titled{' '}
              <strong className="text-foreground">{deactivatedJobMatch.name}</strong> already
              exists. Click <strong>"Reactivate Position"</strong> below to restore it.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-name" className="text-ui font-medium">
            Position Title <span className="text-primary">*</span>
          </Label>
          <Input
            id="job-name"
            placeholder="e.g. Warehouse Supervisor, Delivery Driver, POS Cashier"
            value={name}
            onChange={(e) => {
              const val = e.target.value
              setName(val)
              if (errorMsg) setErrorMsg('')
              if (!isEditing && val.trim()) {
                const match = allJobs.find(
                  (j) => j.name.toLowerCase() === val.trim().toLowerCase() && j.isActive === false,
                )
                setDeactivatedJobMatch(match || null)
              } else {
                setDeactivatedJobMatch(null)
              }
            }}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-desc" className="text-ui font-medium">
            Description
          </Label>
          <Textarea
            id="job-desc"
            placeholder="Key responsibilities and duties for this position..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedJobMatch ? (
            <Button
              type="button"
              size="sm"
              onClick={handleRestoreFoundJob}
              disabled={isPending}
              className="gap-2"
            >
              {reactivateMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Reactivating Position...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reactivate Position
                </>
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="font-medium cursor-pointer"
            >
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>{isEditing ? 'Save Position' : 'Create Position'}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export function JobModal({ job, open, onClose }: JobModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        {open && (
          <JobFormContent key={job ? `job-${job.id}` : 'new-job'} job={job} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
