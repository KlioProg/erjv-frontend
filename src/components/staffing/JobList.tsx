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
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
      className: 'min-w-48 font-semibold',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Briefcase aria-hidden="true" className="size-4 shrink-0 text-primary" />
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
        <span className="line-clamp-2">
          {row.description || 'No description specified.'}
        </span>
      ),
    },
    {
      id: 'staff',
      header: 'Assigned Staff',
      className: 'min-w-40',
      cell: ({ row }) => (
        <JobStaffCount jobId={row.id} isArchived={row.isActive === false} />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'isActive',
      sortable: true,
      cell: ({ row }) =>
        row.isActive === false ? (
          <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700">
            <Archive aria-hidden="true" className="size-3" />
            Archived
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="size-3" />
            Active
          </Badge>
        ),
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
          <Button
            size="sm"
            onClick={handleCreate}
            className="font-semibold shadow-xs cursor-pointer"
          >
            <Plus data-icon="inline-start" className="size-4" />
            Create Job Position
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center border rounded-2xl bg-card">
          <div className="size-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-3 shadow-2xs">
            <AlertCircle className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Unable to load job positions</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            We encountered an issue connecting to the service. Please check your network connection
            and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4 gap-2 text-xs font-semibold shadow-2xs border-border/80 hover:bg-muted cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Try Again
          </Button>
        </div>
      ) : (
        <DataTable
          data={filteredJobList}
          columns={jobColumns}
          getRowKey={(job) => job.id}
          isLoading={isLoading}
          loadingMessage="Loading job positions..."
          defaultSort={{ key: 'name', direction: 'asc' }}
          emptyContent={
            <Card className="flex min-h-64 flex-col items-center justify-center border-dashed bg-muted/20 px-4 py-12 text-center shadow-none">
              <Briefcase aria-hidden="true" className="mb-3 size-8 text-muted-foreground/50" />
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
                  className="mt-3 gap-1.5 text-xs"
                >
                  <Archive aria-hidden="true" className="size-3.5 text-amber-600" />
                  View Archived Positions ({archivedJobs.length})
                </Button>
              )}
            </Card>
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
