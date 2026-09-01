import { useState } from 'react'
import { Plus, Briefcase, Edit2, Archive, RotateCcw, CheckCircle2, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllJobs,
  useDeactivateJob,
  useReactivateJob,
  useEmployeesForJob,
} from '@/features/staffing/staffing.hooks'
import type { Job } from '@/features/staffing/staffing.types'
import { JobModal } from './JobModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'

function JobStaffCount({ jobId, isArchived }: { jobId: number; isArchived?: boolean }) {
  const { data: employeeJobs = [], isLoading } = useEmployeesForJob(jobId)

  if (isLoading) {
    return <Spinner className="size-3 text-muted-foreground" />
  }

  return (
    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
      {isArchived ? (
        <>
          <Briefcase className="size-3.5 text-muted-foreground/70" />
          {employeeJobs.length} assigned records
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          {employeeJobs.length} active staff assigned
        </>
      )}
    </span>
  )
}

export function JobList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: jobs = [], isLoading, error } = useAllJobs()
  const deactivateMutation = useDeactivateJob({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateMutation = useReactivateJob()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [jobToDeactivate, setJobToDeactivate] = useState<Job | null>(null)

  const activeJobs = jobs.filter((j) => j.isActive !== false)
  const archivedJobs = jobs.filter((j) => j.isActive === false)
  const currentJobList = activeTab === 'ACTIVE' ? activeJobs : archivedJobs

  const filteredJobList = currentJobList.filter((j) => {
    const term = searchTerm.toLowerCase()
    return (
      j.name.toLowerCase().includes(term) ||
      (j.description && j.description.toLowerCase().includes(term))
    )
  })

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
      {/* Position Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Positions"
        activeCount={activeJobs.length}
        archivedLabel="Archived Positions"
        archivedCount={archivedJobs.length}
        activeIcon={<Briefcase className="size-3.5" />}
        bannerDescription="Showing deactivated job positions. Role definitions and previous staff assignments are safely preserved and can be reactivated anytime."
      />

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search positions by title or duties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} className="font-semibold shadow-xs cursor-pointer">
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
      ) : filteredJobList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border rounded-2xl bg-card">
          <Briefcase className="size-8 stroke-[1.5] text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {searchTerm
                ? 'No matching job positions found'
                : activeTab === 'ACTIVE'
                  ? 'No active positions yet'
                  : 'No archived positions'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
              {searchTerm
                ? `No positions matched "${searchTerm}". Try a different keyword.`
                : activeTab === 'ACTIVE'
                  ? archivedJobs.length > 0
                    ? `All positions are currently archived (${archivedJobs.length} total).`
                    : 'Click "Create Job Position" to establish roles like Cashier, Manager, etc.'
                  : 'Archived job positions will appear here and can be reactivated at any time.'}
            </p>
            {!searchTerm && activeTab === 'ACTIVE' && archivedJobs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('ARCHIVED')}
                className="mt-3 text-xs gap-1.5 cursor-pointer"
              >
                <Archive className="size-3.5 text-amber-600" />
                View Archived Positions ({archivedJobs.length})
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobList.map((job) => {
            const isArchived = job.isActive === false

            return (
              <Card
                key={job.id}
                className={`flex flex-col justify-between transition-all rounded-2xl ${
                  isArchived
                    ? 'bg-amber-500/5 border-dashed border-amber-500/30 shadow-2xs'
                    : 'hover:shadow-md border-border/80'
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isArchived
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Briefcase className="size-4" />
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        {job.name}
                      </CardTitle>
                    </div>
                    {isArchived ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] font-bold gap-1"
                      >
                        <Archive className="size-3" />
                        Archived
                      </Badge>
                    ) : (
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
                  <JobStaffCount jobId={job.id} isArchived={isArchived} />

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
                          Archive
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

      <JobModal job={selectedJob} open={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <ConfirmDeleteModal
        open={!!jobToDeactivate}
        onClose={() => setJobToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Archive Job Position"
        description="Are you sure you want to archive this position? Staff members assigned to this role will no longer have this designation active. You can restore this position at any time from the Archived Positions tab."
        itemName={jobToDeactivate?.name}
        itemDetails={jobToDeactivate?.description || undefined}
        confirmText="Archive Position"
        variant="destructive"
      />
    </div>
  )
}
