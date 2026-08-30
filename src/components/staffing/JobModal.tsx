import { useState, type FormEvent } from 'react'
import { Briefcase, Plus } from 'lucide-react'
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
import { useCreateJob, useUpdateJobDetails } from '@/features/staffing/staffing.hooks'
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
  const createMutation = useCreateJob()
  const updateMutation = useUpdateJobDetails()

  const [name, setName] = useState(job?.name || '')
  const [description, setDescription] = useState(job?.description || '')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('Job position name is required.')
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

  const isPending = createMutation.isPending || updateMutation.isPending

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

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
            onChange={(e) => setName(e.target.value)}
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

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                {isEditing ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              <>{isEditing ? 'Save Position' : 'Create Position'}</>
            )}
          </Button>
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
