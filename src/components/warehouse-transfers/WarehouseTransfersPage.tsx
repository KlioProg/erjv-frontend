import { DataTableFilters, DataTableFilterChips, type DataTableFilter } from '@/components/ui/data-table-filters'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useResourcePage } from '@/lib/use-cursor-page'
import { useRecordsById } from '@/lib/use-records-by-id'
import { getErrorMessage } from '@/lib/api-client'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTableFooter, DataTableFrame } from '@/components/ui/DataTableFooter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { MovementDetailFields, MovementDetailHeader } from '@/components/deliveries/shared/MovementDetailLayout'

type Warehouse = { id: number; name: string; isActive: boolean }
const statusLabel = (status: TransferStatus) =>
  transferStatuses.find((item) => item.value === status)?.label ?? status
function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return (
    <StatusBadge
      label={statusLabel(status)}
      appearance="emphasis"
      tone={status === 'COMPLETED' ? 'success' : status === 'DISPATCHED' ? 'warning' : status === 'CANCELLED' ? 'destructive' : 'neutral'}
    />
  )
}
const transferTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not scheduled'
const compactTransferTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : 'Not scheduled'

export function WarehouseTransfersPage() {
  const { isAdmin, isManager, isStaff } = useAuth()
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [from, setFrom] = useState('')
  const [before, setBefore] = useState('')
  const [opened, setOpened] = useState<number | 'create' | null>(null)
  const [entryAction, setEntryAction] = useState<'dispatch' | 'reconcile'>()
  const dateError = Boolean(from && before && from >= before)
  const query = useResourcePage<WarehouseTransfer>(
    '/warehouse-transfers',
    {
      ...(status !== 'ALL' ? { statuses: [status] } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(source ? { sourceWarehouseId: Number(source) } : {}),
      ...(destination ? { destinationWarehouseId: Number(destination) } : {}),
      ...(from ? { scheduledFrom: `${from}:00+08:00` } : {}),
      ...(before ? { scheduledBefore: `${before}:00+08:00` } : {}),
    },
    (isAdmin || isManager || isStaff) && !dateError,
  )
  const { data: warehouses } = useRecordsById<Warehouse>(
    '/warehouses',
    query.items.flatMap((item) => [item.sourceWarehouseId, item.destinationWarehouseId]),
  )
  const name = (id: number) => warehouses.find((item) => item.id === id)?.name ?? `Warehouse #${id}`
  const columns: ColumnDef<WarehouseTransfer>[] = [
    {
      header: 'Transfer Number',
      accessorKey: 'transferNumber',
      cell: ({ row }) => <Button variant="link" aria-label={`View transfer ${row.transferNumber}`} onClick={() => {
        setEntryAction(undefined)
        setOpened(row.id)
      }}>{row.transferNumber}</Button>,
    },
    { header: 'Source Warehouse', cell: ({ row }) => name(row.sourceWarehouseId) },
    { header: 'Destination Warehouse', cell: ({ row }) => name(row.destinationWarehouseId) },
    {
      header: 'Departure',
      width: 224,
      cell: ({ row }) => {
        const showActual = !!row.dispatchedAt || row.status === 'DISPATCHED' || row.status === 'COMPLETED'
        const departure = showActual ? row.dispatchedAt : row.scheduledDepartureAt
        const text = departure ? compactTransferTime(departure) : showActual ? 'Not recorded' : '—'
        return (
          <OverflowValue
            asChild
            value={text}
            fullValue={departure ? `${showActual ? 'Actual' : 'Planned'} departure: ${transferTime(departure)} (Manila time)` : text}
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
      cell: ({ row }) => <TransferStatusBadge status={row.status} />,
    },
    {
      header: 'Next Action',
      align: 'right',
      cell: ({ row }) => (
        <DataTableActions>
          <Button variant="outline" size="sm" onClick={() => {
            setEntryAction(isAdmin || isManager || isStaff ? row.status === 'DRAFT' ? 'dispatch' : row.status === 'DISPATCHED' ? 'reconcile' : undefined : undefined)
            setOpened(row.id)
          }}>
            {row.status === 'DRAFT' && (isAdmin || isManager || isStaff)
              ? 'Review & Send'
              : row.status === 'DISPATCHED' && (isAdmin || isManager || isStaff) ? 'Receive Goods' : 'View Details'}
          </Button>
        </DataTableActions>
      ),
    },
  ]
  const tableFilters: DataTableFilter[] = [
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
      { id: 'from', label: 'Departure from (Manila)', value: from, set: setFrom },
      { id: 'before', label: 'Departure before (Manila)', value: before, set: setBefore },
    ].map((field): DataTableFilter => ({
      kind: 'custom',
      id: field.id,
      label: field.label,
      active: !!field.value,
      valueLabel: field.value,
      onClear: () => field.set(''),
      content: (
        <>
          <Label htmlFor={`transfer-${field.id}`}>{field.label}</Label>
          <Input
            id={`transfer-${field.id}`}
            type="datetime-local"
            value={field.value}
            onChange={(event) => field.set(event.target.value)}
          />
        </>
      ),
    })),
  ]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Move goods between warehouses and record what arrives.">
        Warehouse Transfers
      </PageHeader>
      <StatusTabNav tabs={transferStatuses} activeTab={status} onTabChange={setStatus} />
      <PageToolbar>
        <div className="relative w-full sm:w-80">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search warehouse transfers"
            placeholder="Search transfer number..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <DataTableFilters filters={tableFilters} />
        <div className="flex flex-wrap gap-2">
          {(isAdmin || isManager) && (
            <Button onClick={() => { setEntryAction(undefined); setOpened('create') }}>Create Transfer</Button>
          )}
        </div>
      </PageToolbar>
      <DataTableFilterChips filters={tableFilters} />
      {dateError && (
        <p role="alert" className="text-sm text-destructive">
          Departure before must be later than departure from.
        </p>
      )}
      <DataTableFrame>
        {query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {getErrorMessage(query.error)}{' '}
              <Button variant="link" onClick={() => void query.reload()}>
                Reload transfers
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <DataTable
            appearance="management"
            retainHeaders
            data={dateError ? [] : query.items}
            columns={columns}
            getRowKey={(row) => row.id}
            pagination={false}
            manualSorting
            isLoading={query.isFetching}
            emptyContent="No warehouse transfers match these filters."
            tableClassName="min-w-[1000px]"
          />
        )}
        <DataTableFooter
          {...query}
          isError={query.isError || dateError}
          label="Warehouse transfer"
        />
      </DataTableFrame>
      {opened !== null && (
        <TransferDialog
          key={opened}
          id={opened}
          onOpen={setOpened}
          initialAction={entryAction}
          onClose={() => setOpened(null)}
          canEdit={isAdmin || isManager}
          canOperate={isAdmin || isManager || isStaff}
        />
      )}
    </div>
  )
}

type Action = 'draft' | 'dispatch' | 'reconcile' | 'cancel'
function TransferDialog({
  id,
  onClose,
  canEdit,
  canOperate,
  onOpen,
  initialAction,
}: {
  id: number | 'create'
  onClose: () => void
  canEdit: boolean
  canOperate: boolean
  onOpen: (id: number) => void
  initialAction?: 'dispatch' | 'reconcile'
}) {
  const query = useTransfer(typeof id === 'number' ? id : undefined)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<{ action: Action; record: WarehouseTransfer } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const record = query.data
  const [entered, setEntered] = useState(false)
  if (!entered && initialAction && record && !query.isFetching && !query.isError) {
    setEntered(true)
    if (canOperate && record.status === (initialAction === 'dispatch' ? 'DRAFT' : 'DISPATCHED'))
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
    setReviewing(true)
    setSession(null)
    await query.refetch()
    setReviewing(false)
  }
  const formProps = {
    onSaved: (saved: WarehouseTransfer) => {
      if (session?.action === 'cancel') return onClose()
      setFeedback(`${saved.transferNumber}: ${saved.status === 'DRAFT' ? 'draft saved. Review before sending.' : saved.status === 'DISPATCHED' ? 'departure recorded. Goods are In Transit.' : 'receipt saved.'}`)
      setSession(null)
      if (id === 'create') onOpen(saved.id)
    },
    onCancel:
      id === 'create'
        ? onClose
        : () => {
            void review()
          },
    onBusy: setBusy,
  }
  const title =
    id === 'create'
      ? 'Create Transfer'
      : session?.action === 'draft'
        ? 'Edit Transfer Draft'
        : session?.action === 'dispatch'
          ? 'Send Goods?'
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
        if (!open && !busy) onClose()
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
                {feedback && <p role="status" className="text-sm">{feedback}</p>}
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
                    data={record.items}
                    columns={[
                      {
                        id: 'product',
                        header: 'Item',
                        cell: ({ row }) => {
                          const product = products.find((item) => item.id === row.inventoryItemId)
                          return (
                            <div className="flex min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]">
                              <p className="text-sm font-medium">{product?.name ?? `Item #${row.inventoryItemId}`}</p>
                              <p className="text-xs text-muted-foreground">{product?.unit || 'Unit unavailable'}</p>
                            </div>
                          )
                        },
                      },
                      {
                        header: 'Sent',
                        cell: ({ row }) => <span className="tabular-nums">{row.quantity}</span>,
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
                              <span className="tabular-nums">{row[field] ?? '—'}</span>
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
                  {canEdit && (
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
                  {canOperate && (
                    <Button
                      size="sm"
                      className="pointer-coarse:min-h-11"
                      disabled={busy || query.isFetching}
                      onClick={() => start('dispatch')}
                    >
                      Review &amp; Send
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
                  : session?.action === 'dispatch'
                    ? 'This records that the goods have left the source warehouse and moves source stock into transit.'
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
            {feedback && !session && <p role="status" className="text-sm">{feedback}</p>}
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
      </DialogContent>
    </Dialog>
  )
}
