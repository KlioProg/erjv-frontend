import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { useState } from 'react'
import {
  Plus,
  Briefcase,
  Archive,
  RotateCcw,
  CheckCircle2,
  Search,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
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
    <span className="text-sm text-muted-foreground flex items-center gap-2">
      {isArchived ? (
        <>
          <Briefcase className="size-3.5 text-muted-foreground" />
          {employeeJobs.length} assigned records
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3.5 text-status-success-foreground" />
          {employeeJobs.length} active staff assigned
        </>
      )}
    </span>
  )
}

export function JobList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: jobs = [], isLoading, error, refetch } = useAllJobs()
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
      const job = jobToDeactivate
      setJobToDeactivate(null)
      await deactivateMutation.mutateAsync(job)
    }
  }

  const handleReactivate = (job: Job) => {
    reactivateMutation.mutate(job)
  }

  const jobColumns: ColumnDef<Job>[] = [
    {
      id: 'name',
      header: 'Position',
      accessorKey: 'name',
      sortable: true,
      className: 'min-w-48 font-medium',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Briefcase aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{row.name}</span>
        </div>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      accessorKey: 'description',
      sortable: true,
      sortKey: (job) => job.description || '',
      className: 'min-w-64 max-w-xl text-muted-foreground',
      cell: ({ row }) => (
        <span className="line-clamp-2">{row.description || 'No description specified.'}</span>
      ),
    },
    {
      id: 'staff',
      header: 'Assigned Staff',
      className: 'min-w-40',
      cell: ({ row }) => <JobStaffCount jobId={row.id} isArchived={row.isActive === false} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'w-px whitespace-nowrap',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row }) => {
        const isArchived = row.isActive === false
        const isReactivatingThis =
          reactivateMutation.isPending &&
          (typeof reactivateMutation.variables === 'number'
            ? reactivateMutation.variables === row.id
            : (reactivateMutation.variables as Job | undefined)?.id === row.id)

        return isArchived ? (
          <DataTableActions
            onRestore={() => handleReactivate(row)}
            restoreLabel="Reactivate position"
            isPending={isReactivatingThis}
          />
        ) : (
          <DataTableActions
            onEdit={() => handleEdit(row)}
            onArchive={() => handleDeactivate(row)}
            isPending={deactivateMutation.isPending}
          />
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader description="Manage job positions and assigned staff duties.">
        Job Positions
      </PageHeader>
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
      <PageToolbar>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search job positions"
            placeholder="Search positions by title or duties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {activeTab === 'ACTIVE' && (
          <Button size="sm" onClick={handleCreate} className="font-medium cursor-pointer">
            <Plus data-icon="inline-start" className="size-4" />
            Create Job Position
          </Button>
        )}
      </PageToolbar>

      {error ? (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
          <AlertCircle className="mb-3 size-6 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Unable to load job positions</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            We encountered an issue connecting to the service. Please check your network connection
            and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4 gap-2 text-ui font-medium border-border/80 hover:bg-muted cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Try Again
          </Button>
        </div>
      ) : (
        <DataTable
          appearance="management"
          data={filteredJobList}
          columns={jobColumns}
          getRowKey={(job) => job.id}
          isLoading={isLoading}
          loadingMessage="Loading job positions..."
          defaultSort={{ key: 'name', direction: 'asc' }}
          emptyContent={
            <div className="flex min-h-64 flex-col items-center justify-center px-4 py-12 text-center">
              <Briefcase aria-hidden="true" className="mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {searchTerm
                  ? 'No matching job positions found'
                  : activeTab === 'ACTIVE'
                    ? 'No active positions yet'
                    : 'No archived positions'}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {searchTerm
                  ? `No positions matched "${searchTerm}". Try a different keyword.`
                  : activeTab === 'ACTIVE'
                    ? archivedJobs.length > 0
                      ? `All positions are archived (${archivedJobs.length} total).`
                      : 'Create a job position to define roles such as Cashier or Manager.'
                    : 'Archived job positions can be restored at any time.'}
              </p>
              {!searchTerm && activeTab === 'ACTIVE' && archivedJobs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('ARCHIVED')}
                  className="mt-3 gap-2"
                >
                  <Archive aria-hidden="true" className="size-3.5 text-status-warning-foreground" />
                  View Archived Positions ({archivedJobs.length})
                </Button>
              )}
            </div>
          }
          rowClassName={(job) => (job.isActive === false ? 'bg-muted/10 opacity-75' : '')}
          tableClassName="min-w-[760px]"
        />
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
