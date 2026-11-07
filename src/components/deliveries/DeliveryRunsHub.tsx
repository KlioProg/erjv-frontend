import { DateTimeField } from '@/components/common/DateTimeField'
import { toManilaSchedule, manilaScheduleToIso } from '@/lib/manila-schedule'
import { useResourcePage } from '@/lib/use-cursor-page'
import { DataTableFilters, DataTableFilterChips, type DataTableFilter } from '@/components/ui/data-table-filters'
import { DeliveryTableToolbar, DeliveryPageFooter } from './DeliveryTableToolbar'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ROUTES } from '@/routes'
import { toast } from 'sonner'
import { useRecordsById } from '@/lib/use-records-by-id'
import { RUN_STATUS_LABELS } from '@/features/logistics/delivery-workflow'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { AssignDeliveryToRun } from './AssignDeliveryToRun'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/ManagementPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import {
  useDeliveryRunById,
  useCreateDeliveryRun,
  useUpdateDeliveryRunDraft,
  useChangeRunMembers,
  useReopenRunMember,
  useCancelRunMember,
  useCancelDeliveryRun,
} from '@/features/logistics/delivery-runs.hooks'
import type {
  DeliveryRunRecord,
  DeliveryRunStatus,
  DeliveryRunMember,
} from '@/features/logistics/delivery-runs.types'
import { useRunDeliverySelection } from '@/features/logistics/use-run-delivery-selection'
import { RunDeliveryPicker } from './RunDeliveryPicker'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'

const activeStatuses: DeliveryRunStatus[] = ['DRAFT', 'DISPATCHED']
const historyStatuses: DeliveryRunStatus[] = ['COMPLETED', 'CANCELLED']

function RunStatusBadge({ status }: { status: DeliveryRunStatus }) {
  return (
    <StatusBadge
      label={RUN_STATUS_LABELS[status]}
      appearance="emphasis"
      tone={status === 'COMPLETED' ? 'success' : status === 'DISPATCHED' ? 'warning' : status === 'CANCELLED' ? 'destructive' : 'info'}
    />
  )
}
type NamedRecord = { id: number; name: string }
type DriverRecord = {
  id: number
  firstName: string
  lastName: string
  canDrive: boolean
  isActive: boolean
}
type VehicleRecord = {
  id: number
  plateNumber: string
  capacityKg: string | null
  isAvailable: boolean
  operationalStatus: string
}
const dateText = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not set'
const compactDateText = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : 'Not set'

function useRunNames(runs: DeliveryRunRecord[]) {
  const warehouses = useRecordsById<NamedRecord>(
    '/warehouses',
    runs.map((run) => run.warehouseId),
  )
  const drivers = useRecordsById<DriverRecord>(
    '/employees',
    runs.map((run) => run.driverEmployeeId),
  )
  const vehicles = useRecordsById<VehicleRecord>(
    '/delivery-vehicles',
    runs.map((run) => run.deliveryVehicleId),
  )
  return {
    warehouse: (id: number) =>
      warehouses.data.find((record) => record.id === id)?.name ?? `Warehouse #${id}`,
    driver: (id: number | null) => {
      const driver = drivers.data.find((record) => record.id === id)
      return driver
        ? `${driver.firstName} ${driver.lastName}`
        : id
          ? `Employee #${id}`
          : 'Not assigned'
    },
    vehicle: (id: number | null) =>
      vehicles.data.find((record) => record.id === id)?.plateNumber ??
      (id ? `Vehicle #${id}` : 'Not assigned'),
  }
}

export function DeliveryRunsHub({ history = false }: { history?: boolean }) {
  const { isAdmin, isManager, isStaff } = useAuth()
  const canViewHistory = isAdmin || isManager || isStaff
  const [params, setParams] = useSearchParams()
  const runValue = Number(params.get('run'))
  const assignmentValue = Number(params.get('assign'))
  const selectedId = Number.isSafeInteger(runValue) && runValue > 0 ? runValue : undefined
  const assignmentId =
    Number.isSafeInteger(assignmentValue) && assignmentValue > 0 ? assignmentValue : undefined
  const invalidLink = (params.has('run') && !selectedId) || (!history && params.has('assign') && !assignmentId)
  const [creating, setCreating] = useState(false)
  const [initialDelivery, setInitialDelivery] = useState<OutgoingDeliveryRecord>()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [scheduledFrom, setScheduledFrom] = useState('')
  const [scheduledThrough, setScheduledThrough] = useState('')
  const statuses = history ? historyStatuses : activeStatuses
  const query = useResourcePage<DeliveryRunRecord>('/delivery-runs', {
    ...(q.trim() ? { q: q.trim() } : {}),
    statuses: statuses.includes(status as DeliveryRunStatus) ? [status as DeliveryRunStatus] : statuses,
    ...(warehouseFilter ? { warehouseId: Number(warehouseFilter) } : {}),
    ...(driverFilter ? { driverEmployeeId: Number(driverFilter) } : {}),
    ...(vehicleFilter ? { deliveryVehicleId: Number(vehicleFilter) } : {}),
    ...(scheduledFrom
      ? { scheduledFrom: new Date(`${scheduledFrom}T00:00:00+08:00`).toISOString() }
      : {}),
    ...(scheduledThrough
      ? {
          scheduledBefore: new Date(
            Date.parse(`${scheduledThrough}T00:00:00+08:00`) + 86400000,
          ).toISOString(),
        }
      : {}),
  }, !history || canViewHistory)
  const hasFilters =
    !!q.trim() ||
    status !== 'ALL' ||
    !!warehouseFilter ||
    !!driverFilter ||
    !!vehicleFilter ||
    !!scheduledFrom ||
    !!scheduledThrough

  const accessDenied = [401, 403].includes(getApiError(query.error)?.status ?? 0)
  const hasTripData = query.data !== undefined && !accessDenied
  const runs = accessDenied || (history && !canViewHistory) ? []
    : query.items.filter((run) => (history ? historyStatuses : activeStatuses).includes(run.status))
  const names = useRunNames(runs)
  const select = (id?: number) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('assign')
      if (id) next.set('run', String(id))
      else next.delete('run')
      return next
    })
  const preparation = (run: DeliveryRunRecord) =>
    run.status === 'DRAFT'
      ? !run.deliveries.length
        ? 'No deliveries in this trip'
        : !run.driverEmployeeId || !run.deliveryVehicleId
          ? 'Assign driver / vehicle, then review load'
          : 'Review load and eligibility before departure'
      : run.status === 'DISPATCHED'
        ? `${run.deliveries.filter((member) => member.status === 'RECONCILED').length} of ${run.deliveries.length} deliveries recorded`
        : run.status === 'COMPLETED'
          ? 'Trip completed · review delivery results'
          : 'Cancelled'
  const filterHeaders: Record<string, DataTableFilter> = {
    warehouse: {
      kind: 'custom',
      id: 'warehouse',
      valueLabel: warehouseFilter ? names.warehouse(Number(warehouseFilter)) : undefined,
      label: 'Warehouse',
      active: !!warehouseFilter,
      onClear: () => setWarehouseFilter(''),
      content: (
        <>
          <Label htmlFor="run-filter-warehouse">Warehouse</Label>
          <CursorLookup<NamedRecord>
            id="run-filter-warehouse"
            path="/warehouses"
            filter={{ includeInactive: 'true' }}
            value={warehouseFilter}
            label="Warehouse"
            getLabel={(warehouse) => warehouse.name}
            onChange={setWarehouseFilter}
          />
        </>
      ),
    },
    crew: {
      kind: 'custom',
      id: 'crew',
      valueLabel: [driverFilter && names.driver(Number(driverFilter)), vehicleFilter && names.vehicle(Number(vehicleFilter))].filter(Boolean).join(' / '),
      label: 'Driver / Vehicle',
      active: !!driverFilter || !!vehicleFilter,
      onClear: () => {
        setDriverFilter('')
        setVehicleFilter('')
      },
      content: (
        <>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="run-filter-driver">Driver</Label>
              {driverFilter && (
                <Button variant="ghost" size="sm" onClick={() => setDriverFilter('')}>
                  Clear driver
                </Button>
              )}
            </div>
            <CursorLookup<DriverRecord>
              id="run-filter-driver"
              path="/employees"
              filter={{ includeInactive: 'true' }}
              value={driverFilter}
              label="Driver"
              getLabel={(driver) => driver.firstName + ' ' + driver.lastName}
              onChange={setDriverFilter}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="run-filter-vehicle">Vehicle</Label>
              {vehicleFilter && (
                <Button variant="ghost" size="sm" onClick={() => setVehicleFilter('')}>
                  Clear vehicle
                </Button>
              )}
            </div>
            <CursorLookup<VehicleRecord>
              id="run-filter-vehicle"
              path="/delivery-vehicles"
              filter={{ includeInactive: 'true' }}
              value={vehicleFilter}
              label="Vehicle"
              getLabel={(vehicle) => vehicle.plateNumber}
              onChange={setVehicleFilter}
            />
          </div>
        </>
      ),
    },
    departure: {
      kind: 'custom',
      id: 'departure',
      valueLabel: [scheduledFrom, scheduledThrough].filter(Boolean).join(' to '),
      label: 'Scheduled departure',
      active: !!scheduledFrom || !!scheduledThrough,
      onClear: () => {
        setScheduledFrom('')
        setScheduledThrough('')
      },
      content: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="run-filter-from">Departure from</Label>
            <Input
              id="run-filter-from"
              type="date"
              value={scheduledFrom}
              onChange={(event) => setScheduledFrom(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="run-filter-through">Departure through</Label>
            <Input
              id="run-filter-through"
              type="date"
              value={scheduledThrough}
              min={scheduledFrom || undefined}
              onChange={(event) => setScheduledThrough(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Scheduled departure dates use Asia/Manila.</p>
        </>
      ),
    },
    status: {
      kind: 'custom',
      id: 'status',
      valueLabel: status !== 'ALL' ? RUN_STATUS_LABELS[status as DeliveryRunStatus] : undefined,
      label: 'Status',
      active: status !== 'ALL',
      onClear: () => setStatus('ALL'),
      content: (
        <>
          <Label htmlFor="run-status-filter">Trip status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="run-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All statuses</SelectItem>
                {statuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {RUN_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </>
      ),
    },
  }
  const columns: ColumnDef<DeliveryRunRecord>[] = [
    {
      id: 'run',
      header: history ? 'Trip Number' : 'Trip',
      cell: ({ row }) => (
        <OverflowValue asChild value={row.runNumber} fullValue={`${row.runNumber}: ${preparation(row)}`} showFullValueOnHover>
          <Button
            variant="link"
            className="h-auto whitespace-normal break-words px-0 text-left"
            onClick={() => select(row.id)}
          >
            {row.runNumber}
          </Button>
        </OverflowValue>
      ),
    },
    {
      header: 'Warehouse',
      accessorKey: 'warehouseId',
      cell: ({ row }) => names.warehouse(row.warehouseId),
    },
    {
      id: 'crew',
      header: 'Driver / Vehicle',
      cell: ({ row }) => (
        <OverflowValue value={`${names.driver(row.driverEmployeeId)} / ${names.vehicle(row.deliveryVehicleId)}`} />
      ),
    },
    {
      id: 'departure',
      header: history ? 'Departure Date' : 'Scheduled Departure',
      width: history ? 224 : 256,
      cell: ({ row }) => history ? (
        <OverflowValue
          asChild
          value={row.dispatchedAt ? compactDateText(row.dispatchedAt) : 'Not recorded'}
          fullValue={row.dispatchedAt ? `Actual departure: ${dateText(row.dispatchedAt)} (Manila time)` : 'Not recorded'}
          showFullValueOnHover
        >
          <span tabIndex={row.dispatchedAt ? 0 : undefined} className="block w-48 max-w-full truncate">
            {row.dispatchedAt ? <time dateTime={row.dispatchedAt}>{compactDateText(row.dispatchedAt)}</time> : 'Not recorded'}
          </span>
        </OverflowValue>
      ) : (
        <OverflowValue
          value={compactDateText(row.scheduledDepartureAt)}
          fullValue={row.scheduledDepartureAt ? `${dateText(row.scheduledDepartureAt)} (Manila time)` : 'Not set'}
          className="max-w-56"
          showFullValueOnHover
        />
      ),
    },
    {
      id: 'progress',
      header: history ? 'Deliveries' : 'Delivery Progress',
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      cell: ({ row }) => (
        <div>
          <p className={history ? 'text-xs text-muted-foreground' : undefined}>
            {row.deliveries.length
              ? `${row.deliveries.filter((member) => member.status === 'RECONCILED').length} / ${row.deliveries.length} results recorded`
              : 'No deliveries added'}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <RunStatusBadge status={row.status} />,
    },
    {
      id: 'next',
      header: history ? 'Action' : 'Next Action',
      align: 'right',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => select(row.id)}>
          {history ? 'View Trip' : row.status === 'DRAFT' && (isAdmin || isManager || isStaff)
            ? 'Review Trip'
            : row.status === 'DISPATCHED' &&
                row.deliveries.some((member) => member.status === 'DISPATCHED') &&
                (isAdmin || isManager || isStaff)
              ? 'Record Results'
              : 'View Details'}
        </Button>
      ),
    },
  ]
  if (history && !canViewHistory) return <Alert><AlertDescription>You do not have permission to view Delivery Trips.</AlertDescription></Alert>
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!history && <PageHeader description="Group customer deliveries, review departure loads, then record results after departure.">
        Delivery Trips
      </PageHeader>}
      <DeliveryTableToolbar
        search={q}
        onSearch={setQ}
        searchLabel="Search delivery trips"
        placeholder="Search delivery trip..."
        filters={<DataTableFilters filters={Object.values(filterHeaders)} />}
      >
        {history && canViewHistory && (
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.deliveryRuns}>
              Active Delivery Trips
            </Link>
          </Button>
        )}
        {!history && (isAdmin || isManager) && (
          <Button size="sm" onClick={() => setCreating(true)}>
            Create Delivery Trip
          </Button>
        )}
      </DeliveryTableToolbar>
      <DataTableFilterChips filters={Object.values(filterHeaders)} />
      {invalidLink && (
        <Alert variant="destructive">
          <AlertDescription>
            This delivery link does not contain a valid record ID.{' '}
            <Button variant="link" onClick={() => select()}>
              Clear invalid link
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div data-delivery-table className="min-w-0 overflow-hidden rounded-lg border bg-card">
        {query.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {hasTripData && 'Latest trip update could not be retrieved. Showing previously loaded trips. '}
              {getErrorMessage(query.error)}{' '}
              <Button variant="link" onClick={() => void query.refetch()}>
                Refresh trips
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {query.isFetching && hasTripData && <p role="status" className="px-3 py-1 text-xs text-muted-foreground">Updating trips...</p>}
        {query.isError && !runs.length ? (
          <p role="status">Delivery trips are unavailable. Refresh to try again.</p>
        ) : (
          <DataTable
            className="rounded-none border-0"
            tableClassName="min-w-[1000px]"
            appearance="management"
            retainHeaders
            data={runs}
            columns={columns}
            isLoading={query.isLoading}
            pagination={false}
            manualSorting
            getRowKey={(run) => run.id}
            emptyContent={hasFilters || query.hasPrevious || query.hasNext || query.items.length ? (
              history ? 'No historical trips shown on this page. Try another page or change the filters.' : 'No active delivery trips match these filters.'
            ) : (
              <div className="flex flex-col gap-1">
                <p className="font-medium">{history ? 'No past trips found' : 'No active delivery trips'}</p>
                <p className="text-sm text-muted-foreground">
                  {history ? 'Completed and cancelled trips will appear here.' : 'Create a delivery trip or add a ready delivery to a new trip.'}
                </p>
              </div>
            )}
          />
        )}
        <DeliveryPageFooter query={query} count={runs.length} unit="trip" label="Trip" />
      </div>
      {!history && creating && (
        <RunEditor
          initialDelivery={initialDelivery}
          onReview={select}
          onClose={() => {
            setCreating(false)
            setInitialDelivery(undefined)
          }}
          onSaved={(run) => {
            setCreating(false)
            setInitialDelivery(undefined)
            select(run.id)
          }}
        />
      )}
      {!history && assignmentId && !creating && (isAdmin || isManager) && (
        <AssignDeliveryToRun
          key={assignmentId}
          deliveryId={assignmentId}
          onClose={() => select()}
          onAssigned={select}
          onCreate={(delivery) => {
            setInitialDelivery(delivery)
            setCreating(true)
          }}
        />
      )}
      {!history && assignmentId && !(isAdmin || isManager) && (
        <Alert>
          <AlertDescription>
            Only administrators and managers can assign deliveries to runs.
          </AlertDescription>
        </Alert>
      )}
      {selectedId && (history || !assignmentId) && (
        <RunDetails key={selectedId} id={selectedId} readOnly={history} onClose={() => select()} />
      )}
    </div>
  )
}
function RunEditor({
  run,
  initialDelivery,
  onReview,
  onClose,
  onSaved,
}: {
  run?: DeliveryRunRecord
  initialDelivery?: OutgoingDeliveryRecord
  onReview?: (id: number) => void
  onClose: () => void
  onSaved: (run: DeliveryRunRecord) => void
}) {
  const create = useCreateDeliveryRun()
  const update = useUpdateDeliveryRunDraft()
  const [warehouseId, setWarehouseId] = useState(
    run
      ? String(run.warehouseId)
      : initialDelivery?.warehouseId
        ? String(initialDelivery.warehouseId)
        : '',
  )
  const [driverId, setDriverId] = useState(
    run?.driverEmployeeId ? String(run.driverEmployeeId) : '',
  )
  const [vehicleId, setVehicleId] = useState(
    run?.deliveryVehicleId ? String(run.deliveryVehicleId) : '',
  )
  const [departure, setDeparture] = useState(() => {
    return toManilaSchedule(run?.scheduledDepartureAt)
  })
  let validDeparture = false
  try {
    validDeparture = !!manilaScheduleToIso(departure) && !departure.startsWith('0000-')
  } catch {
    validDeparture = false
  }
  const [notes, setNotes] = useState(run?.notes ?? '')
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [savedTripId, setSavedTripId] = useState<number>()
  const selection = useRunDeliverySelection(Number(warehouseId) || undefined)
  const warehouseLocked = !!run?.deliveries.length || !!initialDelivery
  const fixedWarehouse = useRecordsById<NamedRecord>(
    '/warehouses',
    [warehouseLocked ? Number(warehouseId) || undefined : undefined],
  )
  const seeded = useRef(false)
  useEffect(() => {
    if (initialDelivery && !seeded.current) {
      seeded.current = true
      selection.toggle(initialDelivery)
    }
  }, [initialDelivery, selection])
  const submitting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [saving, setSaving] = useState(false)
  const busy = saving || create.isPending || update.isPending
  const [warehouseError, setWarehouseError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!(event.currentTarget as HTMLFormElement).reportValidity()) return
    if (submitting.current || busy || review) return
    if (!warehouseId) {
      setWarehouseError('Choose an active warehouse.')
      return
    }
    if (!validDeparture) {
      setError('Choose a complete departure date and time before saving the trip.')
      return
    }
    submitting.current = true
    setSaving(true)
    try {
      setError('')
      if (
        !run && initialDelivery &&
        !selection.selected.some((entry) => entry.id === initialDelivery.id)
      )
        return setError('Keep the original delivery selected before saving this trip.')
      if (!run && !(await selection.verify())) {
        if (mounted.current) setError('Review the selected deliveries before saving.')
        return
      }
      const payload = {
        warehouseId: Number(warehouseId),
        scheduledDepartureAt: run?.scheduledDepartureAt && departure === toManilaSchedule(run.scheduledDepartureAt) ? run.scheduledDepartureAt : manilaScheduleToIso(departure),
        driverEmployeeId: driverId ? Number(driverId) : null,
        deliveryVehicleId: vehicleId ? Number(vehicleId) : null,
        notes: notes.trim() || null,
        ...(!run && selection.selected.length
          ? {
              deliveries: selection.selected.map((delivery) => ({
                deliveryId: delivery.id,
                expectedRevision: delivery.revision,
              })),
            }
          : {}),
      }
      const saved = run
        ? await update.mutateAsync({
            id: run.id,
            payload: { ...payload, expectedRevision: run.revision },
          })
        : await create.mutateAsync(payload)
      if (
        !run &&
        (!Number.isSafeInteger(saved.id) || saved.id < 1 ||
          !Number.isSafeInteger(saved.revision) || saved.revision < 1 ||
          saved.warehouseId !== Number(warehouseId) ||
          selection.selected.some(
            (delivery) => !saved.deliveries?.some((member) => member.id === delivery.id),
          ))
      ) {
        if (Number.isSafeInteger(saved.id) && saved.id > 0) setSavedTripId(saved.id)
        setReview(true)
        throw Error(
          'Trip membership was not confirmed. Review the saved trip before submitting again.',
        )
      }
      toast.success(run ? 'Trip updated.' : 'Trip created.')
      if (mounted.current) onSaved(saved)
    } catch (cause) {
      if (!mounted.current) return
      setError(getErrorMessage(cause))
      if (
        getApiError(cause)?.code === 'STALE_REVISION' ||
        !getApiError(cause)?.status ||
        (getApiError(cause)?.status ?? 0) >= 500
      )
        setReview(true)
    } finally {
      submitting.current = false
      if (mounted.current) setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        closeDisabled={busy}
        className="flex h-auto min-h-0 max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{run ? `Edit ${run.runNumber}` : 'Create Delivery Trip'}</DialogTitle>
          <DialogDescription>
            Choose a warehouse, schedule, transport, and deliveries for this trip.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void submit(event)}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error}
                    {review &&
                      ' Close and reopen the latest trip to review before submitting again. Your input remains here.'}
                  </AlertDescription>
                </Alert>
              )}
              <fieldset disabled={busy || review} className="flex min-w-0 flex-col gap-4">
                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label
                      id="run-warehouse-label"
                      htmlFor={warehouseLocked ? undefined : 'run-warehouse'}
                    >
                      Warehouse {!warehouseLocked && <span className="text-primary">*</span>}
                    </Label>
                    {warehouseLocked ? (
                      <output
                        id="run-warehouse"
                        aria-labelledby="run-warehouse-label"
                        className="flex h-10 min-w-0 items-center rounded-md border border-input bg-muted/40 px-3 text-sm"
                      >
                        <OverflowValue value={fixedWarehouse.data[0]?.name ?? `Warehouse #${warehouseId}`} />
                      </output>
                    ) : (
                      <CursorLookup<NamedRecord>
                        id="run-warehouse"
                        path="/warehouses"
                        value={warehouseId}
                        label="Warehouse"
                        getLabel={(warehouse) => warehouse.name}
                        error={warehouseError}
                        onChange={(value) => {
                          setWarehouseId(value)
                          setWarehouseError('')
                        }}
                      />
                    )}
                    {warehouseLocked ? (
                      <p className="text-xs text-muted-foreground">
                        {initialDelivery
                          ? 'Fixed by the selected outgoing delivery.'
                          : 'Fixed by the deliveries in this trip.'}
                      </p>
                    ) : null}
                    {warehouseLocked && fixedWarehouse.isError && (
                      <p role="alert" className="text-xs text-destructive">
                        Warehouse name could not be loaded. The trip warehouse is #{warehouseId}.
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <DateTimeField
                      id="run-departure"
                      label="Scheduled Departure"
                      value={departure}
                      onChange={setDeparture}
                      required
                      disabled={busy || review}
                      helperText="Required · Manila time · 24-hour HH:mm"
                    />
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-h-5 items-center justify-between gap-2">
                      <Label htmlFor="run-driver">Driver</Label>
                      {driverId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-[11px]"
                          aria-label="Clear driver"
                          onClick={() => setDriverId('')}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <CursorLookup<DriverRecord>
                      id="run-driver"
                      path="/employees"
                      filter={{ canDrive: 'true', available: 'true' }}
                      value={driverId}
                      label="Driver"
                      getLabel={(driver) => `${driver.firstName} ${driver.lastName}`}
                      accept={(driver) => driver.canDrive && driver.isActive}
                      onChange={setDriverId}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-h-5 items-center justify-between gap-2">
                      <Label htmlFor="run-vehicle">Vehicle</Label>
                      {vehicleId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-[11px]"
                          aria-label="Clear vehicle"
                          onClick={() => setVehicleId('')}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <CursorLookup<VehicleRecord>
                      id="run-vehicle"
                      path="/delivery-vehicles/available"
                      value={vehicleId}
                      label="Vehicle"
                      getLabel={(vehicle) =>
                        `${vehicle.plateNumber} · ${vehicle.capacityKg ?? 'Capacity not set'} kg`
                      }
                      accept={(vehicle) =>
                        vehicle.isAvailable && vehicle.operationalStatus === 'SERVICEABLE'
                      }
                      onChange={setVehicleId}
                    />
                  </div>
                </div>

                {!run && (
                  <RunDeliveryPicker
                    selection={selection}
                    warehouseId={Number(warehouseId) || undefined}
                    disabled={busy || review}
                    heading="Deliveries in This Trip"
                    scrollSelected={false}
                  />
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="run-notes">Notes (optional)</Label>
                  <Textarea
                    id="run-notes"
                    rows={2}
                    className="min-h-14 resize-y text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </fieldset>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            {savedTripId && onReview && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => {
                onClose()
                onReview(savedTripId)
              }}>
                Review Trip
              </Button>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || review || !warehouseId || !validDeparture || (!run && !selection.canSave)}>
              {busy ? 'Saving…' : run ? 'Save Trip' : 'Create Trip'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RunDetails({ id, onClose, readOnly = false }: { id: number; onClose: () => void; readOnly?: boolean }) {
  const { isAdmin, isManager, isStaff } = useAuth()
  const canManage = !readOnly && (isAdmin || isManager)
  const canOperate = !readOnly && (isAdmin || isManager || isStaff)
  const query = useDeliveryRunById(id)
  const run = query.data
  const names = useRunNames(run ? [run] : [])
  const orders = useRecordsById<{ id: number; clientId: number | null }>('/sales-orders', readOnly ? run?.deliveries.map((member) => member.salesOrderId) ?? [] : [])
  const clients = useRecordsById<NamedRecord>('/clients', orders.data.map((order) => order.clientId))
  const [viewDeliveryId, setViewDeliveryId] = useState<number>()
  const changeMembers = useChangeRunMembers()
  const reopen = useReopenRunMember()
  const cancelMember = useCancelRunMember()
  const cancelRun = useCancelDeliveryRun()
  const [editing, setEditing] = useState<DeliveryRunRecord>()
  const [dispatching, setDispatching] = useState(false)
  const [reconcileId, setReconcileId] = useState<number>()
  const [resultsFeedback, setResultsFeedback] = useState('')
  const nextDelivery = run?.deliveries.find((member) => member.status === 'DISPATCHED')
  const existingIds = run?.deliveries.map((delivery) => delivery.id) ?? []
  const selection = useRunDeliverySelection(run?.warehouseId, existingIds)
  const pendingAction = useRef(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    member?: DeliveryRunMember
    expectedRunRevision: number
    action: 'remove' | 'reopen' | 'cancel' | 'cancel-run'
  }>()
  const busy =
    acting ||
    [changeMembers, reopen, cancelMember, cancelRun].some((mutation) => mutation.isPending)
  async function perform(action: () => Promise<unknown>) {
    if (readOnly || pendingAction.current || busy || review)
      throw Error('Refresh and review this trip before continuing.')
    pendingAction.current = true
    setActing(true)
    try {
      setError('')
      await action()
    } catch (cause) {
      setError(getErrorMessage(cause))
      if (
        getApiError(cause)?.code === 'STALE_REVISION' ||
        !getApiError(cause)?.status ||
        (getApiError(cause)?.status ?? 0) >= 500
      )
        setReview(true)
      throw cause
    } finally {
      pendingAction.current = false
      setActing(false)
    }
  }
  async function confirm() {
    if (!run || !confirmation) return
    const member = confirmation.member
    const payload = member
      ? {
          expectedRunRevision: confirmation.expectedRunRevision,
          expectedDeliveryRevision: member.revision,
        }
      : undefined
    await perform(() =>
      confirmation.action === 'cancel-run'
        ? cancelRun.mutateAsync({ id, expectedRevision: confirmation.expectedRunRevision })
        : confirmation.action === 'remove'
          ? changeMembers.mutateAsync({
              id,
              payload: {
                expectedRevision: confirmation.expectedRunRevision,
                remove: [{ deliveryId: member!.id, expectedRevision: member!.revision }],
              },
            })
          : (confirmation.action === 'reopen' ? reopen : cancelMember).mutateAsync({
              id,
              deliveryId: member!.id,
              payload: payload!,
            }),
    )
  }
  const columns: ColumnDef<DeliveryRunMember>[] = [
    { header: 'Delivery', accessorKey: 'deliveryNumber' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <DeliveryStatusBadge status={row.status} runId={run?.id} />,
    },
    { id: 'order', header: 'Sales order', cell: ({ row }) => `#${row.salesOrderId}` },
    ...(readOnly ? [{ id: 'customer', header: 'Customer', cell: ({ row }: { row: DeliveryRunMember }) =>
      clients.data.find((client) => client.id === orders.data.find((order) => order.id === row.salesOrderId)?.clientId)?.name ?? 'Customer unavailable' }] : []),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(readOnly || row.status !== 'DISPATCHED') && <Button variant="outline" size="sm" onClick={() => setViewDeliveryId(row.id)}>
            {row.status === 'RECONCILED' ? 'View Results' : 'View Delivery'}
          </Button>}
          {canManage && run?.status === 'DRAFT' && row.status === 'READY' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy || review} aria-label={`Manage ${row.deliveryNumber}`}>Manage</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {(['remove', 'reopen', 'cancel'] as const).map((action) => (
                    <div key={action}>
                      {action === 'cancel' && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        className={action === 'cancel' ? 'text-destructive' : undefined}
                        onSelect={() => setConfirmation({ member: row, expectedRunRevision: run.revision, action })}
                      >
                        {action === 'remove' ? 'Remove from Trip' : action === 'reopen' ? 'Reopen draft' : 'Cancel delivery'}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canOperate && run?.status === 'DISPATCHED' && row.status === 'DISPATCHED' && (
            <Button size="sm" onClick={() => setReconcileId(row.id)}>
              Record Results
            </Button>
          )}
        </div>
      ),
    },
  ]
  return (
    <>
      <Dialog open={!editing && !dispatching && !reconcileId && !viewDeliveryId} onOpenChange={(open) => !open && !busy && onClose()}>
        <DialogContent
          closeDisabled={busy}
          className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-5xl"
        >
          <DialogHeader>
            <div className="flex items-center gap-3 pr-6"><DialogTitle>{run ? readOnly ? run.runNumber : `Delivery Trip ${run.runNumber}` : 'Delivery Trip'}</DialogTitle>{run && <RunStatusBadge status={run.status} />}</div>
            <DialogDescription>
              {readOnly ? 'Review the saved trip and its member deliveries.' : run?.status === 'DRAFT' ? 'Review the deliveries and load before sending this trip.' : run?.status === 'DISPATCHED' ? 'Record results for each delivery after departure.' : 'Review the saved trip and delivery information.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {query.isPending && <p role="status">Loading trip…</p>}
          {(query.isError || error) && (
            <Alert variant="destructive">
              <AlertDescription>{error || getErrorMessage(query.error)}</AlertDescription>
            </Alert>
          )}
          {(query.isError || review || error) && <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-end"
            aria-label="Refresh trip for review"
            disabled={busy || query.isFetching}
            onClick={() =>
              void query.refetch().then((result) => {
                if (!result.isError) {
                  setReview(false)
                  setError('')
                }
              })
            }
          >
            Refresh
          </Button>}
          {readOnly && run && !historyStatuses.includes(run.status) && <Alert><AlertDescription>This trip is not completed or cancelled.</AlertDescription></Alert>}
          {readOnly && (orders.isError || clients.isError) && <Alert variant="destructive"><AlertDescription>Some customer details could not be loaded.</AlertDescription></Alert>}
          {run && (!readOnly || historyStatuses.includes(run.status)) && (
            <>
              <section aria-label="Trip Summary" className="flex flex-col gap-3">
              <h2 className="font-semibold">Trip Summary</h2>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-medium">
                <div>
                  <dt>Warehouse</dt>
                  <dd>{names.warehouse(run.warehouseId)}</dd>
                </div>
                <div>
                  <dt>Scheduled departure</dt>
                  <dd>{dateText(run.scheduledDepartureAt)}</dd>
                </div>
                {readOnly && <div><dt>Actual departure</dt><dd>{run.dispatchedAt ? dateText(run.dispatchedAt) : 'Not recorded'}</dd></div>}
                <div>
                  <dt>Driver</dt>
                  <dd>{names.driver(run.driverEmployeeId)}</dd>
                </div>
                <div>
                  <dt>Vehicle</dt>
                  <dd>{names.vehicle(run.deliveryVehicleId)}</dd>
                </div>
                <div>
                  <dt>Loaded weight / capacity at departure</dt>
                  <dd>
                    {run.loadedWeightKg != null && run.capacityKgAtDeparture != null ? `${run.loadedWeightKg} / ${run.capacityKgAtDeparture} kg` : run.status === 'DRAFT' ? 'Checked during departure review' : 'Not recorded'}
                  </dd>
                </div>
              </dl>
              </section>
              {!readOnly && run.status === 'DRAFT' && (
                <p className="text-sm text-muted-foreground">
                  {!run.deliveries.length
                    ? 'Add ready deliveries before reviewing departure.'
                    : 'Review the driver, vehicle, and every loaded quantity before departure. Capacity and availability are checked in the departure review.'}
                </p>
              )}
              {(run.status === 'DISPATCHED' || run.status === 'COMPLETED') && (
                <p role="status" className="text-sm font-medium">
                  {run.deliveries.filter((member) => member.status === 'RECONCILED').length} of {run.deliveries.length} deliveries recorded
                </p>
              )}
              {resultsFeedback && <Alert><AlertDescription><p role="status">{resultsFeedback}</p></AlertDescription></Alert>}
              {run.notes && <p className="text-sm">{run.notes}</p>}
              <section aria-label="Deliveries in This Trip" className="flex flex-col gap-3">
              <h2 className="font-semibold">Deliveries in This Trip</h2>
              <DataTable
                data={run.deliveries}
                columns={columns}
                getRowKey={(member) => member.id}
                pagination={false}
                emptyContent="No deliveries in this trip."
              />
              </section>
              {canManage && run.status === 'DRAFT' && (
                <section aria-label="Add Deliveries" className="flex flex-col gap-3 border-t pt-4">
                  <h2 className="font-semibold">Add Deliveries</h2>
                  <RunDeliveryPicker
                    selection={selection}
                    warehouseId={run.warehouseId}
                    existingIds={existingIds}
                    disabled={busy || review}
                  />
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={
                      !selection.selected.length ||
                      !selection.canSave ||
                      busy ||
                      review ||
                      run.deliveries.length >= 100
                    }
                    onClick={() =>
                      void perform(async () => {
                        if (!(await selection.verify())) {
                          setError('Review the selected deliveries before adding them.')
                          return
                        }
                        const saved = await changeMembers.mutateAsync({
                          id,
                          payload: {
                            expectedRevision: run.revision,
                            add: selection.selected.map((delivery) => ({
                              deliveryId: delivery.id,
                              expectedRevision: delivery.revision,
                            })),
                          },
                        })
                        if (
                          selection.selected.some(
                            (delivery) =>
                              !saved.deliveries?.some((member) => member.id === delivery.id),
                          )
                        )
                          throw Error(
                            'Trip membership was not confirmed. Refresh and review the trip before trying again.',
                          )
                        selection.clear()
                        toast.success(
                          selection.selected.length === 1
                            ? 'Delivery added to trip.'
                            : 'Deliveries added to trip.',
                        )
                      }).catch(() => undefined)
                    }
                  >
                    Add to Trip
                  </Button>
                </section>
              )}
              <DialogFooter className="sticky bottom-0 flex-wrap border-t bg-background py-3">
                {canOperate && run.status === 'DISPATCHED' && nextDelivery && (
                  <Button disabled={busy || review || query.isFetching || query.isError} onClick={() => setReconcileId(nextDelivery.id)}>
                    {resultsFeedback ? 'Record Next' : 'Record Results'}
                  </Button>
                )}
                {canManage && run.status === 'DRAFT' && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy || review}
                      onClick={() => setEditing(run)}
                    >
                      Edit Trip
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      disabled={busy || review}
                      onClick={() =>
                        setConfirmation({ action: 'cancel-run', expectedRunRevision: run.revision })
                      }
                    >
                      Cancel Trip
                    </Button>
                  </>
                )}
                {canOperate && run.status === 'DRAFT' && (
                  <Button
                    disabled={busy || review || !run.deliveries.length}
                    onClick={() => setDispatching(true)}
                  >
                    Review Departure
                  </Button>
                )}
                <Button variant="outline" disabled={busy} onClick={onClose}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
          </div>
        </DialogContent>
      </Dialog>
      {viewDeliveryId && <DeliveryDetailModal deliveryId={viewDeliveryId} open onClose={() => setViewDeliveryId(undefined)} />}
      {!readOnly && dispatching && (
        <DispatchDeliveryModal
          runId={id}
          onClose={() => setDispatching(false)}
        />
      )}
      {!readOnly && editing && (
        <RunEditor
          run={editing}
          onClose={() => {
            setEditing(undefined)
          }}
          onSaved={() => {
            setEditing(undefined)
          }}
        />
      )}
      {!readOnly && reconcileId && (
        <CompleteDeliveryModal
          key={reconcileId}
          runId={id}
          deliveryId={reconcileId}
          onSaved={(saved) => {
            const remaining = saved.run.deliveries.filter((member) => member.status === 'DISPATCHED').length
            setResultsFeedback(`Results saved for ${saved.delivery.deliveryNumber}. ${remaining
              ? `${remaining} ${remaining === 1 ? 'delivery still needs' : 'deliveries still need'} results.`
              : saved.run.status === 'COMPLETED' ? 'This trip is completed.' : 'No deliveries are awaiting results. Review the trip status.'}`)
          }}
          onClose={() => setReconcileId(undefined)}
        />
      )}
      <ConfirmDeleteModal
        open={!readOnly && !!confirmation}
        onClose={() => setConfirmation(undefined)}
        onConfirm={confirm}
        title={
          confirmation?.action === 'cancel-run'
            ? 'Cancel Delivery Trip'
            : confirmation?.action === 'remove'
              ? 'Remove Delivery from Trip?'
              : confirmation?.action === 'reopen'
                ? 'Reopen Delivery Draft?'
                : 'Cancel Delivery?'
        }
        description={
          confirmation?.action === 'cancel-run'
            ? 'This cancels the draft delivery trip.'
            : confirmation?.action === 'remove'
              ? 'This removes the delivery from the draft trip. Its Ready status does not change.'
              : confirmation?.action === 'reopen'
                ? 'This returns the delivery to Draft for planning.'
                : 'This cancels the delivery.'
        }
        itemName={confirmation?.member?.deliveryNumber ?? run?.runNumber}
        confirmText={
          confirmation?.action === 'cancel-run'
            ? 'Cancel Trip'
            : confirmation?.action === 'remove'
              ? 'Remove from Trip'
              : confirmation?.action === 'reopen'
                ? 'Reopen Draft'
                : 'Cancel Delivery'
        }
      />
    </>
  )
}
