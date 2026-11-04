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

export function WarehouseTransfersPage() {
  const { isAdmin, isManager, isStaff } = useAuth()
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [from, setFrom] = useState('')
  const [before, setBefore] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [opened, setOpened] = useState<number | 'create' | null>(null)
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
      cell: ({ row }) => <span className="font-medium break-words">{row.transferNumber}</span>,
    },
    { header: 'Source Warehouse', cell: ({ row }) => name(row.sourceWarehouseId) },
    { header: 'Destination Warehouse', cell: ({ row }) => name(row.destinationWarehouseId) },
    {
      header: 'Departure',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>
            <span className="text-xs text-muted-foreground">Scheduled: </span>
            {transferTime(row.scheduledDepartureAt)}
          </span>
          {(row.dispatchedAt || row.status === 'DISPATCHED' || row.status === 'COMPLETED') && (
            <span>
              <span className="text-xs text-muted-foreground">Actual: </span>
              {row.dispatchedAt ? (
                <time dateTime={row.dispatchedAt}>{transferTime(row.dispatchedAt)}</time>
              ) : (
                'Not recorded'
              )}
            </span>
          )}
        </div>
      ),
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
          <Button variant="outline" size="sm" onClick={() => setOpened(row.id)}>
            {row.status === 'DRAFT' || row.status === 'DISPATCHED'
              ? 'Review Transfer'
              : 'View Details'}
          </Button>
        </DataTableActions>
      ),
    },
  ]
  const activeFilters = [source, destination, from, before].filter(Boolean).length
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="transfer-list-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            Filters{activeFilters ? ` (${activeFilters} active)` : ''}
          </Button>
          {(isAdmin || isManager) && (
            <Button onClick={() => setOpened('create')}>Create Transfer</Button>
          )}
        </div>
      </PageToolbar>
      {filtersOpen && (
        <div
          id="transfer-list-filters"
          className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {(
            [
              { label: 'Source Warehouse', value: source, set: setSource },
              { label: 'Destination Warehouse', value: destination, set: setDestination },
            ] as const
          ).map((field) => (
            <div className="min-w-0 space-y-1" key={field.label}>
              <Label>{field.label}</Label>
              <CursorLookup<Warehouse>
                id={`filter-${field.label.replaceAll(' ', '-')}`}
                path="/warehouses"
                label={`Filter ${field.label}`}
                value={field.value}
                getLabel={(item) => item.name}
                onChange={field.set}
                filter={{ includeInactive: 'true' }}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="transfer-from">Departure from (Manila)</Label>
            <Input
              id="transfer-from"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="transfer-before">Departure before (Manila)</Label>
            <Input
              id="transfer-before"
              type="datetime-local"
              value={before}
              onChange={(event) => setBefore(event.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            className="justify-self-start"
            onClick={() => {
              setSource('')
              setDestination('')
              setFrom('')
              setBefore('')
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
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
            tableClassName="min-w-[800px]"
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
          id={opened}
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
}: {
  id: number | 'create'
  onClose: () => void
  canEdit: boolean
  canOperate: boolean
}) {
  const query = useTransfer(typeof id === 'number' ? id : undefined)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<{ action: Action; record: WarehouseTransfer } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const record = query.data
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
    if (record && !query.isFetching && !query.isError) setSession({ action, record })
  }
  const review = async () => {
    setReviewing(true)
    setSession(null)
    await query.refetch()
    setReviewing(false)
  }
  const formProps = {
    onSaved: onClose,
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
          ? 'Send Goods'
          : session?.action === 'reconcile'
            ? 'Receive Goods'
            : session?.action === 'cancel'
              ? 'Cancel Transfer'
              : (record?.transferNumber ?? 'Warehouse Transfer')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-w-3xl" closeDisabled={busy}>
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
        ) : (
          record && (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Source Warehouse</dt>
                  <dd>{warehouseName(record.sourceWarehouseId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Destination Warehouse</dt>
                  <dd>{warehouseName(record.destinationWarehouseId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <TransferStatusBadge status={record.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Scheduled Departure</dt>
                  <dd>{transferTime(record.scheduledDepartureAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Actual Departure</dt>
                  <dd>
                    {record.dispatchedAt ? <time dateTime={record.dispatchedAt}>{transferTime(record.dispatchedAt)}</time> : 'Not recorded'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Completion Time</dt>
                  <dd>
                    {record.reconciledAt ? <time dateTime={record.reconciledAt}>{transferTime(record.reconciledAt)}</time> : 'Not recorded'}
                  </dd>
                </div>
              </dl>
              {record.notes && <p className="break-words text-sm">{record.notes}</p>}
              <DataTable
                data={record.items}
                columns={[
                  {
                    header: 'Item',
                    cell: ({ row }) =>
                      products.find((item) => item.id === row.inventoryItemId)?.name ??
                      `Item #${row.inventoryItemId}`,
                  },
                  {
                    header: 'Sent',
                    cell: ({ row }) =>
                      `${row.quantity} ${products.find((item) => item.id === row.inventoryItemId)?.unit ?? ''}`,
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
                        accessorKey: field,
                        align: 'right' as const,
                      }))
                    : []),
                ]}
                pagination={false}
                tableClassName="min-w-[400px]"
              />
              {record.status === 'COMPLETED' &&
                record.items
                  .filter((item) => item.discrepancyReason)
                  .map((item) => (
                    <p key={item.id} className="text-sm">
                      Item #{item.inventoryItemId}: {item.discrepancyReason}
                    </p>
                  ))}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={query.isFetching} onClick={() => void review()}>
                  Reload transfer
                </Button>
                {record.status === 'DRAFT' && (
                  <>
                    {canEdit && (
                      <>
                        <Button variant="outline" onClick={() => start('draft')}>
                          Edit Draft
                        </Button>
                        <Button variant="outline" onClick={() => start('cancel')}>
                          Cancel Transfer
                        </Button>
                      </>
                    )}
                    {canOperate && (
                      <Button onClick={() => start('dispatch')}>Send Goods</Button>
                    )}
                  </>
                )}
                {record.status === 'DISPATCHED' && canOperate && (
                  <Button onClick={() => start('reconcile')}>Receive Goods</Button>
                )}
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
