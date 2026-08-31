import { useState } from 'react'
import { Plus, Briefcase, Users, Edit2, Archive, RotateCcw, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllJobs,
  useDeactivateJob,
  useReactivateJob,
  useJobEmployees,
} from '@/features/staffing/staffing.hooks'
import type { Job } from '@/features/staffing/staffing.types'
import { JobModal } from './JobModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

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
  const { data: jobs = [], isLoading, error } = useAllJobs()
  const deactivateMutation = useDeactivateJob()
  const reactivateMutation = useReactivateJob()

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [jobToDeactivate, setJobToDeactivate] = useState<Job | null>(null)

  const activeJobs = jobs.filter((j) => j.isActive !== false)
  const archivedJobs = jobs.filter((j) => j.isActive === false)
  const currentJobList = activeTab === 'ACTIVE' ? activeJobs : archivedJobs

  const handleCreate = () => {
    setSelectedJob(null)
    setIsModalOpen(true)
  }

  const handleEdit = (job: Job) => {
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const handleDeactivate = (job: Job) => {
    setJobToDeactivate(job)
  }

  const confirmDeactivate = async () => {
    if (jobToDeactivate) {
      await deactivateMutation.mutateAsync(jobToDeactivate)
      setJobToDeactivate(null)
    }
  }

  const handleReactivate = async (job: Job) => {
    await reactivateMutation.mutateAsync(job.id)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Position Tabs */}
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
          <Briefcase className="size-3.5" />
          Active Positions ({activeJobs.length})
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
          Deactivated Positions ({archivedJobs.length})
        </button>
      </div>

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Job Positions & Roles</h3>
          <p className="text-xs text-muted-foreground">
            Configure POS and operational roles for employee assignment.
          </p>
        </div>
        {activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} className="font-semibold shadow-sm cursor-pointer">
            <Plus data-icon="inline-start" className="size-4" />
            Create Job Position
          </Button>
        )}
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
      ) : currentJobList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 border rounded-2xl bg-card">
          <Briefcase className="size-8 stroke-[1.5] text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'ACTIVE' ? 'No job positions yet' : 'No deactivated job positions'}
          </p>
          <p className="text-xs">
            {activeTab === 'ACTIVE'
              ? 'Click "Create Job Position" to establish roles like Cashier, Manager, etc.'
              : 'Deactivated job positions will appear here and can be reactivated at any time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentJobList.map((job) => {
            const isArchived = job.isActive === false

            return (
              <Card
                key={job.id}
                className={`flex flex-col justify-between transition-all hover:shadow-md rounded-2xl ${
                  isArchived ? 'opacity-75 bg-muted/20 border-dashed' : ''
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isArchived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Briefcase className="size-4" />
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        {job.name}
                      </CardTitle>
                    </div>
                    {!isArchived && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 text-[11px] font-semibold gap-1"
                      >
                        <CheckCircle2 className="size-3" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-2">
                    {job.description || 'No description specified for this position.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-3 border-t bg-muted/10 flex items-center justify-between mt-auto">
                  <JobStaffCount jobId={job.id} />

                  <div className="flex items-center gap-1.5">
                    {isArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8.5 px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl gap-1.5 shadow-2xs cursor-pointer transition-all"
                        onClick={() => handleReactivate(job)}
                        disabled={reactivateMutation.isPending}
                      >
                        <RotateCcw className="size-3.5" />
                        Reactivate Position
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 cursor-pointer"
                          onClick={() => handleEdit(job)}
                        >
                          <Edit2 className="size-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          onClick={() => handleDeactivate(job)}
                        >
                          <Archive className="size-3 mr-1" />
                          Deactivate
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <JobModal
        job={selectedJob}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!jobToDeactivate}
        onClose={() => setJobToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate Job Position"
        description="Are you sure you want to deactivate this position? Staff members assigned to this role will no longer have this designation active."
        itemName={jobToDeactivate?.name}
        itemDetails={jobToDeactivate?.description || undefined}
        confirmText="Deactivate Position"
        variant="destructive"
      />
    </div>
  )
}
