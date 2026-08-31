import { useState, type FormEvent } from 'react'
import { Briefcase, Plus, RotateCcw } from 'lucide-react'
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
  useJobs,
  useCreateJob,
  useUpdateJobDetails,
  useReactivateJob,
} from '@/features/staffing/staffing.hooks'
import { fetchJobByNameApi } from '@/features/staffing/staffing.api'
import type { Job } from '@/features/staffing/staffing.types'
import { getErrorMessage } from '@/lib/api-client'

type JobModalProps = {
  job: Job | null
  open: boolean
  onClose: () => void
}

function JobFormContent({
  job,
  onClose,
}: {
  job: Job | null
  onClose: () => void
}) {
  const isEditing = !!job
  const { data: allJobs = [] } = useJobs()
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

    let backendMatch: Job | null = null
    if (cleanName) {
      try {
        backendMatch = await fetchJobByNameApi(cleanName)
      } catch {
        // Ignore
      }
    }

    if (
      backendMatch &&
      typeof backendMatch === 'object' &&
      backendMatch.id &&
      backendMatch.id !== job?.id &&
      backendMatch.isActive === false
    ) {
      setDeactivatedJobMatch(backendMatch)
      setErrorMsg(
        `Job position "${cleanName}" is currently deactivated. You can reactivate it directly.`
      )
      return
    }

    // 2. Check active duplicates
    const isDuplicate = allJobs.some(
      (j) => j.id !== job?.id && j.name.toLowerCase().trim() === cleanName.toLowerCase() && j.isActive !== false
    )
    if (isDuplicate || (backendMatch && typeof backendMatch === 'object' && backendMatch.id && backendMatch.id !== job?.id && backendMatch.isActive !== false)) {
      setErrorMsg(`A job position titled "${cleanName}" already exists in the directory.`)
      return
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
    if (deactivatedJobMatch) {
      await reactivateMutation.mutateAsync(deactivatedJobMatch.id)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
          {isEditing ? <Briefcase className="size-5" /> : <Plus className="size-5" />}
        </div>
        <DialogTitle>{isEditing ? 'Edit Job Position' : 'Create Job Position'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modify the title and description for this position.'
            : 'Add a new staffing position/role for the ERJVPOS team.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedJobMatch && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedJobMatch && (
        <div className="my-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Position Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived job position titled <strong className="text-foreground">{deactivatedJobMatch.name}</strong> already exists. Click <strong>"Reactivate Position"</strong> below to restore it.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-name" className="text-xs font-medium">
            Position Title <span className="text-primary">*</span>
          </Label>
          <Input
            id="job-name"
            placeholder="e.g. Head Cashier, Delivery Driver, Inventory Clerk"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (deactivatedJobMatch) setDeactivatedJobMatch(null)
              if (errorMsg) setErrorMsg('')
            }}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="job-desc" className="text-xs font-medium">
            Role Description
          </Label>
          <Textarea
            id="job-desc"
            placeholder="Brief summary of duties, responsibilities, and operational scope..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2.5 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedJobMatch ? (
            <Button
              type="button"
              onClick={handleRestoreFoundJob}
              disabled={isPending}
              className="gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
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
            <Button type="submit" disabled={isPending} className="font-semibold shadow-xs cursor-pointer">
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
          <JobFormContent
            key={job ? `job-${job.id}` : 'new-job'}
            job={job}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
