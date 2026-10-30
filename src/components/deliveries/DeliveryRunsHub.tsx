import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { useDeliveryRuns, useDeliveryRunById, useCreateDeliveryRun, useUpdateDeliveryRunDraft,
  useChangeRunMembers, useReopenRunMember, useCancelRunMember, useCancelDeliveryRun } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord, DeliveryRunStatus, DeliveryRunMember } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'

const statuses: DeliveryRunStatus[] = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']
type NamedRecord = { id: number; name: string }
type DriverRecord = { id: number; firstName: string; lastName: string; canDrive: boolean; isActive: boolean }
type VehicleRecord = { id: number; plateNumber: string; capacityKg: string | null; isAvailable: boolean; operationalStatus: string }
const dateText = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not set'

export function DeliveryRunsHub() {
  const { isAdmin, isManager } = useAuth()
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('run')) || undefined
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const query = useDeliveryRuns({ ...(q.trim() ? { q: q.trim() } : {}), ...(status !== 'ALL' ? { statuses: [status as DeliveryRunStatus] } : {}) })
  const runs = [...new Map(query.data?.pages.flatMap((page) => page.items).map((run) => [run.id, run]) ?? []).values()]
  const select = (id?: number) => setParams(id ? { run: String(id) } : {})
  const columns: ColumnDef<DeliveryRunRecord>[] = [
    { id: 'run', header: 'Run', cell: ({ row }) => <Button variant="link" onClick={() => select(row.id)}>{row.runNumber}</Button> },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <Badge variant="outline">{row.status}</Badge> },
    { header: 'Warehouse', accessorKey: 'warehouseId', cell: ({ row }) => `Warehouse #${row.warehouseId}` },
    { id: 'departure', header: 'Departure', cell: ({ row }) => dateText(row.scheduledDepartureAt) },
    { id: 'progress', header: 'Reconciled', cell: ({ row }) => `${row.deliveries.filter((member) => member.status === 'RECONCILED').length} / ${row.deliveries.length}` },
  ]
  return <div className="flex min-w-0 flex-col gap-5">
    <PageHeader description="Plan shared loads, dispatch the entire run, and reconcile each customer delivery independently.">Delivery Runs</PageHeader>
    <PageToolbar><Input aria-label="Search delivery runs" placeholder="Search run number or notes" value={q} onChange={(event) => setQ(event.target.value)} />
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44" aria-label="Run status"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
      </SelectContent></Select>
      {(isAdmin || isManager) && <Button onClick={() => setCreating(true)}>Create Delivery Run</Button>}
    </PageToolbar>
    {query.isError && <Alert variant="destructive"><AlertDescription>{getErrorMessage(query.error)} <Button variant="link" onClick={() => void query.refetch()}>Refresh runs</Button></AlertDescription></Alert>}
    <DataTable data={runs} columns={columns} isLoading={query.isPending} pagination={false} manualSorting getRowKey={(run) => run.id} emptyContent="No delivery runs match these filters." />
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>Load more runs</Button>}
    {creating && <RunEditor onClose={() => setCreating(false)} onSaved={(run) => { setCreating(false); select(run.id) }} />}
    {selectedId && <RunDetails key={selectedId} id={selectedId} onClose={() => select()} />}
  </div>
}

function RunEditor({ run, onClose, onSaved }: { run?: DeliveryRunRecord; onClose: () => void; onSaved: (run: DeliveryRunRecord) => void }) {
  const create = useCreateDeliveryRun()
  const update = useUpdateDeliveryRunDraft()
  const [warehouseId, setWarehouseId] = useState(run ? String(run.warehouseId) : '')
  const [driverId, setDriverId] = useState(run?.driverEmployeeId ? String(run.driverEmployeeId) : '')
  const [vehicleId, setVehicleId] = useState(run?.deliveryVehicleId ? String(run.deliveryVehicleId) : '')
  const [departure, setDeparture] = useState(() => {
    if (!run?.scheduledDepartureAt) return ''
    const date = new Date(run.scheduledDepartureAt)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState(run?.notes ?? '')
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const busy = create.isPending || update.isPending
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || review) return
    if (!warehouseId) return setError('Choose an active warehouse.')
    try {
      setError('')
      const payload = { warehouseId: Number(warehouseId), scheduledDepartureAt: departure ? new Date(departure).toISOString() : null,
        driverEmployeeId: driverId ? Number(driverId) : null, deliveryVehicleId: vehicleId ? Number(vehicleId) : null, notes: notes.trim() || null }
      const saved = run ? await update.mutateAsync({ id: run.id, payload: { ...payload, expectedRevision: run.revision } }) : await create.mutateAsync(payload)
      onSaved(saved)
    } catch (cause) {
      setError(getErrorMessage(cause))
      if (getApiError(cause)?.code === 'STALE_REVISION' || !getApiError(cause)?.status || (getApiError(cause)?.status ?? 0) >= 500) setReview(true)
    }
  }
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent closeDisabled={busy} className="sm:max-w-xl">
    <DialogHeader><DialogTitle>{run ? `Edit ${run.runNumber}` : 'Create Delivery Run'}</DialogTitle><DialogDescription>Assignments and departure apply to every included delivery. Add READY deliveries after saving.</DialogDescription></DialogHeader>
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}{review && ' Close and reopen the latest run to review before submitting again. Your input remains here.'}</AlertDescription></Alert>}
      <fieldset disabled={busy || review} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2"><Label htmlFor="run-warehouse">Warehouse</Label><CursorLookup<NamedRecord> id="run-warehouse" path="/warehouses" value={warehouseId} label="Warehouse" getLabel={(warehouse) => warehouse.name}
          disabled={!!run?.deliveries.length} onChange={setWarehouseId} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="run-departure">Scheduled departure</Label><Input id="run-departure" type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="run-driver">Eligible available driver</Label><CursorLookup<DriverRecord> id="run-driver" path="/employees" filter={{ canDrive: 'true', available: 'true' }} value={driverId} label="Driver"
          getLabel={(driver) => `${driver.firstName} ${driver.lastName}`} accept={(driver) => driver.canDrive && driver.isActive} onChange={setDriverId} />
          {driverId && <Button type="button" variant="link" size="sm" onClick={() => setDriverId('')}>Clear driver</Button>}</div>
        <div className="flex flex-col gap-2"><Label htmlFor="run-vehicle">Available vehicle</Label><CursorLookup<VehicleRecord> id="run-vehicle" path="/delivery-vehicles/available" value={vehicleId} label="Vehicle"
          getLabel={(vehicle) => `${vehicle.plateNumber} · ${vehicle.capacityKg ?? 'Capacity not set'} kg`} accept={(vehicle) => vehicle.isAvailable && vehicle.operationalStatus === 'SERVICEABLE'} onChange={setVehicleId} />
          {vehicleId && <Button type="button" variant="link" size="sm" onClick={() => setVehicleId('')}>Clear vehicle</Button>}</div>
        <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="run-notes">Notes</Label><Input id="run-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      </fieldset>
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button disabled={busy || review}>{busy ? 'Saving…' : 'Save Run'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}

function RunDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const { isAdmin, isManager, isStaff } = useAuth()
  const canManage = isAdmin || isManager
  const canOperate = canManage || isStaff
  const query = useDeliveryRunById(id)
  const run = query.data
  const changeMembers = useChangeRunMembers()
  const reopen = useReopenRunMember()
  const cancelMember = useCancelRunMember()
  const cancelRun = useCancelDeliveryRun()
  const [editing, setEditing] = useState<DeliveryRunRecord>()
  const [dispatching, setDispatching] = useState(false)
  const [reconcileId, setReconcileId] = useState<number>()
  const [candidate, setCandidate] = useState<OutgoingDeliveryRecord>()
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [confirmation, setConfirmation] = useState<{ member?: DeliveryRunMember; expectedRunRevision: number; action: 'remove' | 'reopen' | 'cancel' | 'cancel-run' }>()
  const busy = [changeMembers, reopen, cancelMember, cancelRun].some((mutation) => mutation.isPending)
  async function perform(action: () => Promise<unknown>) {
    if (busy || review) throw Error('Refresh and review this run before continuing.')
    try { setError(''); await action() } catch (cause) { setError(getErrorMessage(cause)); if (getApiError(cause)?.code === 'STALE_REVISION') setReview(true); throw cause }
  }
  async function confirm() {
    if (!run || !confirmation) return
    const member = confirmation.member
    const payload = member ? { expectedRunRevision: confirmation.expectedRunRevision, expectedDeliveryRevision: member.revision } : undefined
    await perform(() => confirmation.action === 'cancel-run' ? cancelRun.mutateAsync({ id, expectedRevision: confirmation.expectedRunRevision })
      : confirmation.action === 'remove' ? changeMembers.mutateAsync({ id, payload: { expectedRevision: confirmation.expectedRunRevision, remove: [{ deliveryId: member!.id, expectedRevision: member!.revision }] } })
      : (confirmation.action === 'reopen' ? reopen : cancelMember).mutateAsync({ id, deliveryId: member!.id, payload: payload! }))
  }
  const columns: ColumnDef<DeliveryRunMember>[] = [
    { header: 'Delivery', accessorKey: 'deliveryNumber' }, { header: 'Status', accessorKey: 'status' },
    { id: 'order', header: 'Sales order', cell: ({ row }) => `#${row.salesOrderId}` },
    { id: 'actions', header: 'Actions', cell: ({ row }) => <div className="flex flex-wrap gap-1">
      {canManage && run?.status === 'DRAFT' && row.status === 'READY' && (['remove', 'reopen', 'cancel'] as const).map((action) => <Button key={action} variant="outline" size="sm" disabled={busy || review} onClick={() => setConfirmation({ member: row, expectedRunRevision: run.revision, action })}>{action === 'remove' ? 'Remove from run' : action === 'reopen' ? 'Reopen draft' : 'Cancel delivery'}</Button>)}
      {canOperate && run?.status === 'DISPATCHED' && row.status === 'DISPATCHED' && <Button size="sm" onClick={() => setReconcileId(row.id)}>Reconcile delivery</Button>}
    </div> },
  ]
  return <>
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent closeDisabled={busy} className="flex max-h-[90dvh] flex-col overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>{run?.runNumber ?? 'Delivery Run'}</DialogTitle><DialogDescription>Dispatch moves goods into transit. A run completes only after every member delivery is reconciled.</DialogDescription></DialogHeader>
      {query.isPending && <p role="status">Loading run…</p>}
      {(query.isError || error) && <Alert variant="destructive"><AlertDescription>{error || getErrorMessage(query.error)}</AlertDescription></Alert>}
      <Button type="button" variant="outline" size="sm" disabled={busy || query.isFetching} onClick={() => void query.refetch().then((result) => { if (!result.isError) { setReview(false); setError(''); setCandidate(undefined) } })}>Refresh run for review</Button>
      {run && <>
        <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt>Status</dt><dd><Badge variant="outline">{run.status}</Badge></dd></div><div><dt>Warehouse</dt><dd>#{run.warehouseId}</dd></div><div><dt>Departure</dt><dd>{dateText(run.scheduledDepartureAt)}</dd></div>
          <div><dt>Driver</dt><dd>{run.driverEmployeeId ? `Employee #${run.driverEmployeeId}` : 'Not assigned'}</dd></div><div><dt>Vehicle</dt><dd>{run.deliveryVehicleId ? `Vehicle #${run.deliveryVehicleId}` : 'Not assigned'}</dd></div><div><dt>Loaded weight / capacity at departure</dt><dd>{run.loadedWeightKg ?? '—'} / {run.capacityKgAtDeparture ?? '—'} kg</dd></div></dl>
        {run.notes && <p className="text-sm">{run.notes}</p>}
        <DataTable data={run.deliveries} columns={columns} getRowKey={(member) => member.id} pagination={false} emptyContent="No deliveries in this run." />
        {canManage && run.status === 'DRAFT' && <div className="flex flex-col gap-3 border-t pt-4">
          <Label htmlFor="run-ready-delivery">Add a READY delivery from this warehouse</Label>
          <CursorLookup<OutgoingDeliveryRecord> key={run.revision} id="run-ready-delivery" path="/outgoing-deliveries" filter={{ statuses: ['READY'], warehouseId: run.warehouseId, unassigned: 'true' }} value={candidate ? String(candidate.id) : ''} label="READY delivery" getLabel={(delivery) => `${delivery.deliveryNumber} · Sales Order #${delivery.salesOrderId}`}
            accept={(delivery) => delivery.status === 'READY' && delivery.runId === null && delivery.warehouseId === run.warehouseId} disabled={busy || review} onChange={(_, delivery) => setCandidate(delivery)} />
          <Button disabled={!candidate || busy || review || run.deliveries.length >= 100} onClick={() => void perform(() => changeMembers.mutateAsync({ id, payload: { expectedRevision: run.revision, add: [{ deliveryId: candidate!.id, expectedRevision: candidate!.revision }] } })).then(() => setCandidate(undefined)).catch(() => undefined)}>Add Delivery</Button>
        </div>}
        <DialogFooter className="flex-wrap">
          {canManage && run.status === 'DRAFT' && <><Button variant="outline" disabled={busy || review} onClick={() => setEditing(run)}>Edit Run</Button><Button variant="destructive" disabled={busy || review} onClick={() => setConfirmation({ action: 'cancel-run', expectedRunRevision: run.revision })}>Cancel Run</Button></>}
          {canOperate && run.status === 'DRAFT' && <Button disabled={busy || review || !run.deliveries.length} onClick={() => setDispatching(true)}>Dispatch Run</Button>}
          <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        </DialogFooter>
      </>}
    </DialogContent></Dialog>
    {editing && <RunEditor run={editing} onClose={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} />}
    {dispatching && <DispatchDeliveryModal runId={id} onClose={() => setDispatching(false)} />}
    {reconcileId && <CompleteDeliveryModal runId={id} deliveryId={reconcileId} onClose={() => setReconcileId(undefined)} />}
    <ConfirmDeleteModal open={!!confirmation} onClose={() => setConfirmation(undefined)} onConfirm={confirm} title={confirmation?.action === 'cancel-run' ? 'Cancel Delivery Run' : `${confirmation?.action ?? ''} delivery`}
      description="This changes the run membership or delivery lifecycle. Review the selected record before confirming." itemName={confirmation?.member?.deliveryNumber ?? run?.runNumber} confirmText="Confirm change" />
  </>
}
