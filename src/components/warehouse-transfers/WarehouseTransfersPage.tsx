import { ProductTableLabel, ProductTableQuantity } from '@/components/common/ProductTableCells'
import {
  DataTableFilters,
  DataTableFilterChips,
  type DataTableFilter,
} from '@/components/ui/data-table-filters'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useResourcePage } from '@/lib/use-cursor-page'
import { useRecordsById } from '@/lib/use-records-by-id'
import { getErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/ManagementPage'
import { ROUTES } from '@/routes'
import {
  DeliveryTableToolbar,
  DeliveryPageFooter,
} from '@/components/deliveries/DeliveryTableToolbar'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTableFrame } from '@/components/ui/DataTableFooter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableLoadError } from '@/components/ui/TableLoadError'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { DateTimeField } from '@/components/common/DateTimeField'
import { manilaScheduleToIso } from '@/lib/manila-schedule'
import { Label } from '@/components/ui/label'
import { CursorLookup } from '@/components/ui/CursorLookup'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  transferStatuses,
  outcomeFields,
  type TransferStatus,
  type WarehouseTransfer,
} from '@/features/warehouse-transfers/warehouse-transfers.types'
import { useTransfer } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
import { TransferActionForm, TransferDraftForm } from './TransferForms'
import {
  MovementDetailFields,
  MovementDetailHeader,
} from '@/components/deliveries/shared/MovementDetailLayout'

type Warehouse = { id: number; name: string; isActive: boolean }
const statusLabel = (status: TransferStatus) =>
  transferStatuses.find((item) => item.value === status)?.label ?? status
function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return (
    <StatusBadge
      label={statusLabel(status)}
      tone={
        status === 'COMPLETED'
          ? 'success'
          : status === 'DISPATCHED'
            ? 'warning'
            : status === 'CANCELLED'
              ? 'destructive'
              : 'neutral'
      }
    />
  )
}
const transferTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not scheduled'
const compactTransferTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not scheduled'

export function WarehouseTransfersPage({ view = 'active' }: { view?: 'active' | 'history' } = {}) {
  const history = view === 'history'
  const allowedStatuses: TransferStatus[] = history
    ? ['COMPLETED', 'CANCELLED']
    : ['DRAFT', 'DISPATCHED']
  const navigate = useNavigate()
  const { isAdmin, isManager, isStaff } = useAuth()
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [from, setFrom] = useState('')
  const [before, setBefore] = useState('')
  const [opened, setOpened] = useState<number | 'create' | null>(null)
  const [entryAction, setEntryAction] = useState<'reconcile'>()
  const [scheduledFrom, scheduledBefore] = [from, before].map((value) => {
    try {
      return manilaScheduleToIso(value)
    } catch {
      return undefined
    }
  })
  const dateError =
    scheduledFrom === undefined || scheduledBefore === undefined
      ? 'Choose a complete, valid departure date and time.'
      : scheduledFrom && scheduledBefore && scheduledFrom >= scheduledBefore
        ? 'Departure before must be later than departure from.'
        : ''
  const query = useResourcePage<WarehouseTransfer>(
    '/warehouse-transfers',
    {
      statuses: allowedStatuses.includes(status as TransferStatus) ? [status] : allowedStatuses,
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(source ? { sourceWarehouseId: Number(source) } : {}),
      ...(destination ? { destinationWarehouseId: Number(destination) } : {}),
      ...(scheduledFrom ? { scheduledFrom } : {}),
      ...(scheduledBefore ? { scheduledBefore } : {}),
    },
    (isAdmin || isManager || isStaff) && !dateError,
  )
  const { data: warehouses } = useRecordsById<Warehouse>(
    '/warehouses',
    query.items.flatMap((item) => [item.sourceWarehouseId, item.destinationWarehouseId]),
  )
  const name = (id: number) => warehouses.find((item) => item.id === id)?.name ?? `Warehouse #${id}`
  const visibleTransfers = query.items.filter((item) => allowedStatuses.includes(item.status))
  const openDetails = (transfer: WarehouseTransfer) => {
    setEntryAction(undefined)
    setOpened(transfer.id)
  }
  const columns: ColumnDef<WarehouseTransfer>[] = [
    {
      header: 'Transfer #',
      accessorKey: 'transferNumber',
      width: '17%',
      cell: ({ row }) => (
        <OverflowValue asChild value={row.transferNumber}>
          <Button
            variant="link"
            size="sm"
            className="max-w-full px-0"
            aria-label={'View transfer ' + row.transferNumber}
            onClick={() => openDetails(row)}
          >
            {row.transferNumber}
          </Button>
        </OverflowValue>
      ),
    },
    {
      header: 'Source / Destination',
      className: 'max-w-0',
      cell: ({ row }) => (
        <OverflowValue
          value={name(row.sourceWarehouseId) + ' → ' + name(row.destinationWarehouseId)}
        />
      ),
    },
    {
      header: 'Trip',
      width: '12%',
      cell: ({ row }) =>
        row.runId != null ? (
          <Button asChild variant="link" size="sm" className="px-0">
            <Link to={ROUTES.deliveryRuns + '?run=' + row.runId}>Trip #{row.runId}</Link>
          </Button>
        ) : (
          <span className="text-muted-foreground">Not assigned</span>
        ),
    },
    {
      header: 'Departure',
      width: 224,
      cell: ({ row }) => {
        const showActual =
          !!row.dispatchedAt || row.status === 'DISPATCHED' || row.status === 'COMPLETED'
        const departure = showActual ? row.dispatchedAt : row.scheduledDepartureAt
        const text = departure ? compactTransferTime(departure) : showActual ? 'Not recorded' : '—'
        return (
          <OverflowValue
            asChild
            value={text}
            fullValue={
              departure
                ? `${showActual ? 'Actual' : 'Planned'} departure: ${transferTime(departure)} (Manila time)`
                : text
            }
            showFullValueOnHover
          >
            <span tabIndex={departure ? 0 : undefined} className="block w-48 max-w-full truncate">
              {departure ? <time dateTime={departure}>{text}</time> : text}
            </span>
          </OverflowValue>
        )
      },
    },
    {
      header: 'Status',
      className: 'min-w-32 whitespace-nowrap',
      headerClassName: 'min-w-32 whitespace-nowrap',
      cell: ({ row }) => <TransferStatusBadge status={row.status} />,
    },
    {
      header: history ? 'Details' : 'Next Action',
      align: 'right',
      cell: ({ row }) => (
        <DataTableActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (history) {
                openDetails(row)
                return
              }
              if (row.status === 'DRAFT' && (row.runId != null || isAdmin || isManager)) {
                navigate(
                  ROUTES.deliveryRuns +
                    '?' +
                    (row.runId != null ? 'run=' + row.runId : 'transfer=' + row.id),
                )
                return
              }
              setEntryAction(
                (isAdmin || isManager || isStaff) && row.status === 'DISPATCHED'
                  ? 'reconcile'
                  : undefined,
              )
              setOpened(row.id)
            }}
          >
            {history
              ? 'View Details'
              : row.status === 'DRAFT'
                ? row.runId != null
                  ? 'View Trip'
                  : isAdmin || isManager
                    ? 'Add to Trip'
                    : 'View Details'
                : 'Receive Goods'}
          </Button>
        </DataTableActions>
      ),
    },
  ]
  const tableFilters: DataTableFilter[] = [
    {
      kind: 'select',
      id: 'transfer-status',
      label: 'Transfer status',
      value: allowedStatuses.includes(status as TransferStatus) ? status : 'ALL',
      emptyValue: 'ALL',
      options: [
        { value: 'ALL', label: history ? 'All finished states' : 'All active states' },
        ...transferStatuses.filter((item) =>
          allowedStatuses.includes(item.value as TransferStatus),
        ),
      ],
      onChange: setStatus,
    },
    ...[
      { id: 'source', label: 'From Warehouse', value: source, set: setSource },
      { id: 'destination', label: 'To Warehouse', value: destination, set: setDestination },
    ].map((field): DataTableFilter => ({
      kind: 'custom',
      id: field.id,
      label: field.label,
      active: !!field.value,
      valueLabel: field.value ? name(Number(field.value)) : undefined,
      onClear: () => field.set(''),
      content: (
        <>
          <Label htmlFor={`transfer-filter-${field.id}`}>{field.label}</Label>
          <CursorLookup<Warehouse>
            id={`transfer-filter-${field.id}`}
            path="/warehouses"
            label={`Filter ${field.label}`}
            value={field.value}
            onChange={field.set}
            getLabel={(item) => item.name}
            filter={{ includeInactive: 'true' }}
          />
        </>
      ),
    })),
    ...[
      { id: 'from', label: 'Scheduled departure from (Manila)', value: from, set: setFrom },
      { id: 'before', label: 'Scheduled departure before (Manila)', value: before, set: setBefore },
    ].map((field): DataTableFilter => ({
      kind: 'custom',
      id: field.id,
      label: field.label,
      active: !!field.value,
      valueLabel: field.value,
      onClear: () => field.set(''),
      content: (
        <DateTimeField
          id={`transfer-${field.id}`}
          label={field.label}
          value={field.value}
          onChange={field.set}
        />
      ),
    })),
  ]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={
          history
            ? 'Review completed and cancelled warehouse transfers.'
            : 'Plan warehouse movements, add drafts to trips, and receive goods after arrival.'
        }
      >
        {history ? 'Warehouse Transfer History' : 'Warehouse Transfers'}
      </PageHeader>
      <DeliveryTableToolbar
        search={search}
        onSearch={setSearch}
        searchLabel="Search warehouse transfers"
        placeholder="Search transfer number..."
        filters={<DataTableFilters filters={tableFilters} />}
      >
        {history && (
          <Button asChild variant="outline">
            <Link to={ROUTES.warehouseTransfers}>Active Transfers</Link>
          </Button>
        )}
        {!history && (isAdmin || isManager) && (
          <Button
            onClick={() => {
              setEntryAction(undefined)
              setOpened('create')
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Create Transfer
          </Button>
        )}
      </DeliveryTableToolbar>
      <DataTableFilterChips filters={tableFilters} />
      {dateError && (
        <p role="alert" className="text-sm text-destructive">
          {dateError}
        </p>
      )}
      <DataTableFrame>
        {query.isError ? (
          <TableLoadError
            message="Warehouse transfers could not be loaded."
            description={getErrorMessage(query.error)}
            onRetry={() => void query.reload()}
            retrying={query.isFetching}
          />
        ) : (
          <DataTable
            appearance="management"
            retainHeaders
            data={dateError ? [] : visibleTransfers}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={openDetails}
            pagination={false}
            manualSorting
            isLoading={query.isFetching}
            emptyContent={
              <div className="py-2 text-center">
                <p className="text-sm font-semibold">
                  {search.trim() || status !== 'ALL' || source || destination || from || before
                    ? 'No warehouse transfers match these filters.'
                    : history
                      ? 'No transfer history yet.'
                      : 'No active warehouse transfers.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {history
                    ? 'Completed and cancelled transfers appear here.'
                    : isAdmin || isManager
                      ? 'Adjust the filters or create a transfer to plan a warehouse movement.'
                      : 'Adjust the filters to review current warehouse movements.'}
                </p>
              </div>
            }
            tableClassName="w-full min-w-[960px]"
          />
        )}
        <DeliveryPageFooter
          query={{ ...query, isError: query.isError || !!dateError }}
          count={dateError ? 0 : visibleTransfers.length}
          label="Warehouse transfer"
          unit="transfer"
        />
      </DataTableFrame>
      {opened !== null && (
        <TransferDialog
          key={opened}
          id={opened}
          onOpen={setOpened}
          initialAction={entryAction}
          onClose={() => setOpened(null)}
          canEdit={!history && (isAdmin || isManager)}
          canOperate={!history && (isAdmin || isManager || isStaff)}
          onOpenTrip={
            history
              ? undefined
              : (transfer) =>
                  navigate(
                    `/deliveries/runs?${transfer.runId != null ? `run=${transfer.runId}` : `transfer=${transfer.id}`}`,
                  )
          }
        />
      )}
    </div>
  )
}

type Action = 'draft' | 'reconcile' | 'cancel'
export function TransferDialog({
  id,
  onClose,
  canEdit,
  canOperate,
  onOpen,
  initialAction,
  onOpenTrip,
}: {
  id: number | 'create'
  onClose: () => void
  canEdit: boolean
  canOperate: boolean
  onOpen: (id: number) => void
  initialAction?: 'reconcile'
  onOpenTrip?: (transfer: WarehouseTransfer) => void
}) {
  const query = useTransfer(typeof id === 'number' ? id : undefined)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dismissal, setDismissal] = useState<'close' | 'back' | null>(null)
  const [session, setSession] = useState<{ action: Action; record: WarehouseTransfer } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const record = query.data
  const [entered, setEntered] = useState(false)
  if (!entered && initialAction && record && !query.isFetching && !query.isError) {
    setEntered(true)
    if (canOperate && record.status === 'DISPATCHED')
      setSession({ action: initialAction, record })
  }
  const { data: warehouses } = useRecordsById<Warehouse>(
    '/warehouses',
    record ? [record.sourceWarehouseId, record.destinationWarehouseId] : [],
  )
  const { data: products } = useRecordsById<{ id: number; name: string; unit: string }>(
    '/inventory-items',
    record?.items.map((item) => item.inventoryItemId) ?? [],
  )
  const warehouseName = (id: number) =>
    warehouses.find((item) => item.id === id)?.name ?? `Warehouse #${id}`
  const start = (action: Action) => {
    if (record && !busy && !query.isFetching && !query.isError) setSession({ action, record })
  }
  const review = async () => {
    setDirty(false)
    setReviewing(true)
    setSession(null)
    await query.refetch()
    setReviewing(false)
  }
  const requestDismiss = (target: 'close' | 'back') => {
    if (busy) return
    if (dirty) setDismissal(target)
    else if (target === 'close') onClose()
    else void review()
  }
  const formProps = {
    onSaved: (saved: WarehouseTransfer) => {
      setDirty(false)
      if (session?.action === 'cancel') return onClose()
      setSession(null)
      if (id === 'create') onOpen(saved.id)
    },
    onCancel: () => requestDismiss(id === 'create' ? 'close' : 'back'),
    onBusy: setBusy,
    onDirtyChange: setDirty,
  }
  const title =
    id === 'create'
      ? 'Create Transfer'
      : session?.action === 'draft'
        ? 'Edit Transfer Draft'
        : session?.action === 'reconcile'
            ? 'Record Goods Received'
            : session?.action === 'cancel'
              ? 'Cancel Transfer'
              : (record?.transferNumber ?? 'Warehouse Transfer')
  const showingDetails =
    id !== 'create' && !session && !!record && !query.isPending && !query.isError && !reviewing
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestDismiss('close')
      }}
    >
      <DialogContent
        className={showingDetails
          ? 'flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11'
          : id === 'create' || session?.action === 'draft'
            ? 'flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-[min(96vw,80rem)]'
            : session?.action === 'reconcile'
              ? 'max-h-[90dvh] overflow-y-auto sm:max-w-6xl'
              : 'max-h-[90dvh] overflow-y-auto sm:max-w-4xl'}
        closeDisabled={busy}
      >
        {showingDetails && record ? (
          <>
            <MovementDetailHeader
              title={record.transferNumber}
              description="Warehouse transfer"
              status={<TransferStatusBadge status={record.status} />}
              className="px-5 py-5 pr-14 sm:pl-6"
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
              <div className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">
                  {record.status === 'DRAFT'
                    ? record.runId != null ? 'Assigned to a delivery trip. Departure is confirmed in the trip.' : 'Draft saved. Add this transfer to a delivery trip before sending.'
                    : record.status === 'DISPATCHED' ? 'Departure recorded. Goods are In Transit. Return here when the destination confirms what arrived.'
                      : record.status === 'COMPLETED' ? 'Receipt saved. Review the actual quantities below.' : 'This transfer was cancelled.'}
                </p>
                <section aria-label="Movement details">
                  <MovementDetailFields
                    fields={[
                      { label: 'From warehouse', value: warehouseName(record.sourceWarehouseId) },
                      { label: 'To warehouse', value: warehouseName(record.destinationWarehouseId) },
                      {
                        label: 'Scheduled departure',
                        value: record.scheduledDepartureAt
                          ? <time dateTime={record.scheduledDepartureAt}>{compactTransferTime(record.scheduledDepartureAt)}</time>
                          : 'Not scheduled',
                      },
                      ...(record.status === 'DISPATCHED' || record.status === 'COMPLETED'
                        ? [{
                            label: 'Actual departure',
                            value: record.dispatchedAt
                              ? <time dateTime={record.dispatchedAt}>{compactTransferTime(record.dispatchedAt)}</time>
                              : 'Not recorded',
                          }]
                        : []),
                      ...(record.status === 'COMPLETED'
                        ? [{
                            label: 'Completed at',
                            value: record.reconciledAt
                              ? <time dateTime={record.reconciledAt}>{compactTransferTime(record.reconciledAt)}</time>
                              : 'Not recorded',
                          }]
                        : []),
                    ]}
                  />
                </section>
                <section aria-labelledby="transfer-items-heading" className="border-t border-border pt-4">
                  <h2 id="transfer-items-heading" className="mb-3 text-base font-semibold">
                    {record.status === 'COMPLETED' ? 'Transfer results' : 'Items'} ({record.items.length})
                  </h2>
                  {record.status === 'COMPLETED' && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      Received includes damaged goods. Returned and missing quantities are recorded separately.
                    </p>
                  )}
                  <DataTable
                    density="compact"
                    data={record.items}
                    columns={[
                      {
                        id: 'product',
                        header: 'Item',
                        cell: ({ row }) => {
                          const product = products.find((item) => item.id === row.inventoryItemId)
                          return <ProductTableLabel product={product} fallback={`Item #${row.inventoryItemId}`} />
                        },
                      },
                      {
                        header: 'Sent',
                        cell: ({ row }) => <ProductTableQuantity value={row.quantity} unit={products.find((product) => product.id === row.inventoryItemId)?.unit} />,
                        align: 'right',
                      },
                      ...(record.status === 'COMPLETED'
                        ? outcomeFields.map((field) => ({
                            id: field,
                            header: {
                              receivedQuantity: 'Received at Destination',
                              damagedQuantity: 'Damaged',
                              returnedSellableQuantity: 'Returned in Good Condition',
                              returnedDamagedQuantity: 'Returned Damaged',
                              missingQuantity: 'Missing',
                            }[field],
                            align: 'right' as const,
                            cell: ({ row }: { row: WarehouseTransfer['items'][number] }) => (
                              <ProductTableQuantity value={row[field]} unit={products.find((product) => product.id === row.inventoryItemId)?.unit} />
                            ),
                          }))
                        : []),
                    ]}
                    pagination={false}
                    appearance="subtle"
                    tableClassName="min-w-[400px] w-full"
                  />
                </section>
                {record.status === 'COMPLETED' && record.items.some((item) => item.discrepancyReason) && (
                  <section aria-labelledby="transfer-discrepancies-heading" className="border-t border-border pt-4">
                    <h2 id="transfer-discrepancies-heading" className="mb-2 text-base font-semibold">
                      Discrepancy reasons
                    </h2>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {record.items
                        .filter((item) => item.discrepancyReason)
                        .map((item) => (
                          <li key={item.id} className="[overflow-wrap:anywhere]">
                            {products.find((product) => product.id === item.inventoryItemId)?.name ?? `Item #${item.inventoryItemId}`}: {item.discrepancyReason}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
                {record.notes && (
                  <section aria-labelledby="transfer-notes-heading" className="border-t border-border pt-4">
                    <h2 id="transfer-notes-heading" className="mb-1 text-base font-semibold text-muted-foreground">
                      Additional details
                    </h2>
                    <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{record.notes}</p>
                  </section>
                )}
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-row justify-end border-t border-border px-5 py-3 sm:px-6">
              <Button
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                disabled={query.isFetching}
                onClick={() => void review()}
              >
                Reload transfer
              </Button>
              {record.status === 'DRAFT' && (
                <>
                  {canEdit && record.runId == null && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="pointer-coarse:min-h-11"
                        disabled={busy || query.isFetching}
                        onClick={() => start('draft')}
                      >
                        Edit Draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="pointer-coarse:min-h-11"
                        disabled={busy || query.isFetching}
                        onClick={() => start('cancel')}
                      >
                        Cancel Transfer
                      </Button>
                    </>
                  )}
                  {onOpenTrip && (record.runId != null || canEdit) && (
                    <Button
                      size="sm"
                      className="pointer-coarse:min-h-11"
                      disabled={busy || query.isFetching}
                      onClick={() => onOpenTrip(record)}
                    >
                      {record.runId != null ? 'View Trip' : 'Add to Trip'}
                    </Button>
                  )}
                </>
              )}
              {record.status === 'DISPATCHED' && canOperate && (
                <Button
                  size="sm"
                  className="pointer-coarse:min-h-11"
                  disabled={busy || query.isFetching}
                  onClick={() => start('reconcile')}
                >
                  Receive Goods
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {id === 'create' || session?.action === 'draft'
                  ? 'Drafts do not move or reserve stock.'
                  : session?.action === 'reconcile'
                      ? 'Record what arrived at the destination, including damaged, returned, or missing goods. Transfer results are final.'
                      : session?.action === 'cancel'
                        ? 'This cancels the draft transfer. No stock has moved.'
                        : record?.status === 'DRAFT'
                          ? 'Review the items and departure details before sending goods.'
                          : record?.status === 'DISPATCHED'
                            ? 'Review the transfer, then record what arrived at the destination.'
                            : record?.status === 'CANCELLED'
                              ? 'This transfer was cancelled.'
                              : 'Review the completed transfer results.'}
              </DialogDescription>
            </DialogHeader>
            {id === 'create' ? (
              canEdit && <TransferDraftForm {...formProps} />
            ) : session ? (
              session.action === 'draft' ? (
                <TransferDraftForm
                  key={`draft-${session.record.revision}`}
                  {...formProps}
                  record={session.record}
                />
              ) : (
                <TransferActionForm
                  key={`${session.action}-${session.record.revision}`}
                  {...formProps}
                  record={session.record}
                  action={session.action}
                />
              )
            ) : query.isPending || reviewing ? (
              <p role="status">Loading transfer…</p>
            ) : query.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {getErrorMessage(query.error)}
                  <Button variant="link" onClick={() => void review()}>
                    Reload transfer
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
        <ConfirmDeleteModal
          open={dismissal !== null}
          title="Discard Changes?"
          description="Your unsubmitted transfer entries will be lost. The saved transfer will stay unchanged."
          confirmText="Discard Changes"
          cancelText="Keep Editing"
          onClose={() => setDismissal(null)}
          onConfirm={() => {
            const target = dismissal
            setDismissal(null)
            setDirty(false)
            if (target === 'close') onClose()
            else void review()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
