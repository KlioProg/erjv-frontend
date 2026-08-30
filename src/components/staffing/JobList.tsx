import { useState } from 'react'
import { Plus, Briefcase, Users, Edit2, Archive, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  useJobs,
  useDeactivateJob,
  useReactivateJob,
  useJobEmployees,
} from '@/features/staffing/staffing.hooks'
import type { Job } from '@/features/staffing/staffing.types'
import { JobModal } from './JobModal'

// Inline component displaying count of active staff assigned to this role
function JobStaffCount({ jobId }: { jobId: number }) {
  const { data: employees = [], isLoading } = useJobEmployees(jobId)

  if (isLoading) return <span className="text-[11px] text-muted-foreground">...</span>

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
      <Users className="size-3 text-muted-foreground" />
      {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
    </span>
  )
}

export function JobList() {
  const { data: jobs = [], isLoading, error } = useJobs()
  const deactivateMutation = useDeactivateJob()
  const reactivateMutation = useReactivateJob()

  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCreate = () => {
    setSelectedJob(null)
    setIsModalOpen(true)
  }

  const handleEdit = (job: Job) => {
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const handleDeactivate = async (id: number) => {
    if (window.confirm('Are you sure you want to deactivate this job position?')) {
      await deactivateMutation.mutateAsync(id)
    }
  }

  const handleReactivate = async (id: number) => {
    await reactivateMutation.mutateAsync(id)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Job Positions & Roles</h3>
          <p className="text-xs text-muted-foreground">
            Configure POS and operational roles for employee assignment.
          </p>
        </div>
        <Button onClick={handleCreate} className="font-semibold shadow-sm">
          <Plus data-icon="inline-start" className="size-4" />
          Create Job Position
        </Button>
      </div>

      {/* Grid of Job Position Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-6 text-primary" />
          <p className="text-xs">Loading job positions...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive gap-1 text-xs">
          <p className="font-semibold">Unable to fetch jobs from backend server.</p>
          <p className="text-muted-foreground">Make sure the backend is running on port 3000.</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 border rounded-2xl bg-card">
          <Briefcase className="size-8 stroke-[1.5] text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No job positions yet</p>
          <p className="text-xs">
            Click &quot;Create Job Position&quot; to establish roles like Cashier, Manager, etc.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className={`flex flex-col justify-between transition-all hover:shadow-md ${
                !job.isActive ? 'opacity-70 bg-muted/20 border-dashed' : ''
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="size-4" />
                    </div>
                    <CardTitle className="text-sm font-bold text-foreground">
                      {job.name}
                    </CardTitle>
                  </div>
                  <Badge
                    variant={job.isActive ? 'default' : 'secondary'}
                    className="text-[10px] font-semibold"
                  >
                    {job.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-2">
                  {job.description || 'No description specified for this position.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-3 border-t bg-muted/10 flex items-center justify-between mt-auto">
                <JobStaffCount jobId={job.id} />

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => handleEdit(job)}
                  >
                    <Edit2 className="size-3 mr-1" />
                    Edit
                  </Button>
                  {job.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeactivate(job.id)}
                    >
                      <Archive className="size-3 mr-1" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-primary hover:bg-primary/10"
                      onClick={() => handleReactivate(job.id)}
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Reactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JobModal
        job={selectedJob}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
