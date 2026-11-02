import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { useDeliveryRunById, useCreateDeliveryRun, useUpdateDeliveryRunDraft,
  useChangeRunMembers, useReopenRunMember, useCancelRunMember, useCancelDeliveryRun } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord, DeliveryRunStatus, DeliveryRunMember } from '@/features/logistics/delivery-runs.types'
import { useRunDeliverySelection } from '@/features/logistics/use-run-delivery-selection'
import { RunDeliveryPicker } from './RunDeliveryPicker'
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
  const query = useResourcePage<DeliveryRunRecord>('/delivery-runs', { ...(q.trim() ? { q: q.trim() } : {}), ...(status !== 'ALL' ? { statuses: [status as DeliveryRunStatus] } : {}) })
  const runs = query.items
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
    {query.isError && <Alert variant="destructive"><AlertDescription>{getErrorMessage(query.error)} <Button variant="link" onClick={() => void query.reload()}>Refresh runs</Button></AlertDescription></Alert>}
    <DataTable data={runs} columns={columns} isLoading={query.isFetching} pagination={false} manualSorting getRowKey={(run) => run.id} emptyContent="No delivery runs match these filters." />
    <CursorPageControls {...query} label="Run" />
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
  const selection = useRunDeliverySelection(Number(warehouseId) || undefined)
  const submitting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [saving, setSaving] = useState(false)
  const busy = saving || create.isPending || update.isPending
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || busy || review) return
    if (!warehouseId) return setError('Choose an active warehouse.')
    submitting.current = true
    setSaving(true)
    try {
      setError('')
      if (!run && !(await selection.verify())) { if (mounted.current) setError('Review the selected deliveries before saving.'); return }
      const payload = { warehouseId: Number(warehouseId), scheduledDepartureAt: departure ? new Date(departure).toISOString() : null,
        driverEmployeeId: driverId ? Number(driverId) : null, deliveryVehicleId: vehicleId ? Number(vehicleId) : null, notes: notes.trim() || null, ...(!run && selection.selected.length ? { deliveries: selection.selected.map((delivery) => ({ deliveryId: delivery.id, expectedRevision: delivery.revision })) } : {}) }
      const saved = run ? await update.mutateAsync({ id: run.id, payload: { ...payload, expectedRevision: run.revision } }) : await create.mutateAsync(payload)
      if (mounted.current) onSaved(saved)
    } catch (cause) {
      if (!mounted.current) return
      setError(getErrorMessage(cause))
      if (getApiError(cause)?.code === 'STALE_REVISION' || !getApiError(cause)?.status || (getApiError(cause)?.status ?? 0) >= 500) setReview(true)
    } finally { submitting.current = false; if (mounted.current) setSaving(false) }
  }
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent closeDisabled={busy} className="gap-4 sm:max-w-xl">
    <DialogHeader><DialogTitle>{run ? `Edit ${run.runNumber}` : 'Create Delivery Run'}</DialogTitle><DialogDescription>Assignments and departure apply to every included delivery. Choose READY deliveries now or add them after saving.</DialogDescription></DialogHeader>
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      {error && <Alert variant="destructive"><AlertDescription>{error}{review && ' Close and reopen the latest run to review before submitting again. Your input remains here.'}</AlertDescription></Alert>}
      <fieldset disabled={busy || review} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="run-warehouse">Warehouse</Label><CursorLookup<NamedRecord> id="run-warehouse" path="/warehouses" value={warehouseId} label="Warehouse" getLabel={(warehouse) => warehouse.name}
          disabled={!!run?.deliveries.length} onChange={setWarehouseId} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="run-departure">Scheduled departure</Label><Input id="run-departure" type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-6 items-center justify-between gap-2"><Label htmlFor="run-driver">Eligible available driver</Label>
            {driverId && <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" aria-label="Clear driver" onClick={() => setDriverId('')}>Clear</Button>}</div>
          <CursorLookup<DriverRecord> id="run-driver" path="/employees" filter={{ canDrive: 'true', available: 'true' }} value={driverId} label="Driver"
            getLabel={(driver) => `${driver.firstName} ${driver.lastName}`} accept={(driver) => driver.canDrive && driver.isActive} onChange={setDriverId} /></div>
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-6 items-center justify-between gap-2"><Label htmlFor="run-vehicle">Available vehicle</Label>
            {vehicleId && <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" aria-label="Clear vehicle" onClick={() => setVehicleId('')}>Clear</Button>}</div>
          <CursorLookup<VehicleRecord> id="run-vehicle" path="/delivery-vehicles/available" value={vehicleId} label="Vehicle"
            getLabel={(vehicle) => `${vehicle.plateNumber} · ${vehicle.capacityKg ?? 'Capacity not set'} kg`} accept={(vehicle) => vehicle.isAvailable && vehicle.operationalStatus === 'SERVICEABLE'} onChange={setVehicleId} /></div>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="run-notes">Notes</Label><Textarea id="run-notes" rows={2} className="min-h-14 resize-y focus-visible:ring-2 focus-visible:ring-ring" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        {!run && <div className="sm:col-span-2"><RunDeliveryPicker selection={selection} warehouseId={Number(warehouseId) || undefined} disabled={busy || review} /></div>}
      </fieldset>
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button disabled={busy || review || (!run && !selection.canSave)}>{busy ? 'Saving…' : 'Save Run'}</Button></DialogFooter>
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
  const existingIds = run?.deliveries.map((delivery) => delivery.id) ?? []
  const selection = useRunDeliverySelection(run?.warehouseId, existingIds)
  const pendingAction = useRef(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [confirmation, setConfirmation] = useState<{ member?: DeliveryRunMember; expectedRunRevision: number; action: 'remove' | 'reopen' | 'cancel' | 'cancel-run' }>()
  const busy = acting || [changeMembers, reopen, cancelMember, cancelRun].some((mutation) => mutation.isPending)
  async function perform(action: () => Promise<unknown>) {
    if (pendingAction.current || busy || review) throw Error('Refresh and review this run before continuing.')
    pendingAction.current = true
    setActing(true)
    try { setError(''); await action() } catch (cause) { setError(getErrorMessage(cause)); if (getApiError(cause)?.code === 'STALE_REVISION' || !getApiError(cause)?.status || (getApiError(cause)?.status ?? 0) >= 500) setReview(true); throw cause }
    finally { pendingAction.current = false; setActing(false) }
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
      <Button type="button" variant="outline" size="sm" disabled={busy || query.isFetching} onClick={() => void query.refetch().then((result) => { if (!result.isError) { setReview(false); setError('') } })}>Refresh run for review</Button>
      {run && <>
        <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt>Status</dt><dd><Badge variant="outline">{run.status}</Badge></dd></div><div><dt>Warehouse</dt><dd>#{run.warehouseId}</dd></div><div><dt>Departure</dt><dd>{dateText(run.scheduledDepartureAt)}</dd></div>
          <div><dt>Driver</dt><dd>{run.driverEmployeeId ? `Employee #${run.driverEmployeeId}` : 'Not assigned'}</dd></div><div><dt>Vehicle</dt><dd>{run.deliveryVehicleId ? `Vehicle #${run.deliveryVehicleId}` : 'Not assigned'}</dd></div><div><dt>Loaded weight / capacity at departure</dt><dd>{run.loadedWeightKg ?? '—'} / {run.capacityKgAtDeparture ?? '—'} kg</dd></div></dl>
        {run.notes && <p className="text-sm">{run.notes}</p>}
        <DataTable data={run.deliveries} columns={columns} getRowKey={(member) => member.id} pagination={false} emptyContent="No deliveries in this run." />
        {canManage && run.status === 'DRAFT' && <div className="flex flex-col gap-3 border-t pt-4">
          <RunDeliveryPicker selection={selection} warehouseId={run.warehouseId} existingIds={existingIds} disabled={busy || review} />
          <Button disabled={!selection.selected.length || !selection.canSave || busy || review || run.deliveries.length >= 100} onClick={() => void perform(async () => {
            if (!(await selection.verify())) { setError('Review the selected deliveries before adding them.'); return }
            await changeMembers.mutateAsync({ id, payload: { expectedRevision: run.revision, add: selection.selected.map((delivery) => ({ deliveryId: delivery.id, expectedRevision: delivery.revision })) } })
            selection.clear()
          }).catch(() => undefined)}>Add {selection.selected.length > 1 ? `${selection.selected.length} Deliveries` : 'Delivery'}</Button>
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
