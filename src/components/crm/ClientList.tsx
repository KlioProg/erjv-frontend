import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import {
  useClientsPage,
  useDeactivateClient,
  useReactivateClient,
} from '@/features/crm/clients.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { Client } from '@/features/crm/clients.types'
import { ClientModal } from './ClientModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getErrorMessage } from '@/lib/api-client'
import './customers-pilot.css'

export function ClientList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const deactivateMutation = useDeactivateClient({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateMutation = useReactivateClient()
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToDeactivate, setClientToDeactivate] = useState<Client | null>(null)

  const query = searchTerm.trim()
  const clientsQuery = useClientsPage({
    q: query || undefined,
    includeInactive: activeTab === 'ACTIVE' ? 'false' : 'only',
  })
  const { isError, error } = clientsQuery

  const handleCreate = () => {
    setSelectedClient(null)
    setIsModalOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const confirmDeactivate = async () => {
    if (clientToDeactivate) {
      const client = clientToDeactivate
      await deactivateMutation.mutateAsync(client)
    }
  }

  const customerColumns: ColumnDef<Client>[] = [
    {
      id: 'customer-id',
      header: 'Customer ID',
      accessorKey: 'id',
      width: 112,
      className: 'min-w-28 tabular-nums text-muted-foreground customer-secondary',
      headerClassName: 'whitespace-nowrap',
      cell: ({ row }) => `#${String(row.id).padStart(4, '0')}`,
    },
    {
      id: 'customer-name',
      header: 'Customer Name',
      accessorKey: 'name',
      className: 'min-w-[220px] max-w-[280px] font-medium text-foreground',
      cell: ({ row }) => <OverflowValue value={row.name} />,
    },
    {
      id: 'customer-contact',
      header: 'Contact Person',
      accessorKey: 'contactPerson',
      className: 'min-w-[140px] max-w-[180px] whitespace-nowrap text-foreground',
      cell: ({ row }) => row.contactPerson || '—',
    },
    {
      id: 'customer-channels',
      header: 'Phone & Email',
      className: 'max-w-[220px] text-foreground',
      cell: ({ row }) => (
        <>
          <OverflowValue value={row.phone} />
          {row.email && (
            <OverflowValue value={row.email} className="customer-secondary text-muted-foreground" />
          )}
        </>
      ),
    },
    {
      id: 'customer-address',
      header: 'Address',
      accessorKey: 'address',
      className: 'max-w-[240px] text-muted-foreground',
      cell: ({ row }) => <OverflowValue value={row.address} />,
    },
    {
      id: 'customer-actions',
      header: 'Actions',
      align: 'right',
      className: 'w-px whitespace-nowrap',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row }) =>
        canManage ? (
          <DataTableActions
            onEdit={row.isActive !== false ? () => handleEdit(row) : undefined}
            onArchive={row.isActive !== false ? () => setClientToDeactivate(row) : undefined}
            onRestore={row.isActive === false ? () => reactivateMutation.mutate(row) : undefined}
            restoreLabel="Reactivate"
            isPending={deactivateMutation.isPending || reactivateMutation.isPending}
          />
        ) : null,
    },
  ]

  return (
    <div className="customer-pilot flex min-w-0 flex-col gap-4">
      <PageHeader description="Manage customer accounts, contacts, and delivery addresses.">
        Customers
      </PageHeader>
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Customers"
        archivedLabel="Archived Customers"
        activeIcon={<Users className="size-3.5" />}
        showBanner={false}
        className="customer-filters"
      />
      <PageToolbar>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search customers"
            placeholder="Search customer name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 pl-9"
          />
        </div>
        {canManage && activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} variant="primary-contrast" className="shrink-0">
            <Plus data-icon="inline-start" />
            Register New Customer
          </Button>
        )}
      </PageToolbar>
      {activeTab === 'ARCHIVED' && (
        <p className="rounded-md bg-secondary px-4 py-3 text-xs leading-5 text-muted-foreground">
          Archived customers keep their contact details and order history. Reactivate an account to
          use it again.
        </p>
      )}
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load customers</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void clientsQuery.reload()}
          >
            Try again
          </Button>
        </Alert>
      ) : (
        <DataTable
          appearance="management"
          className="customer-table"
          data={clientsQuery.items}
          pagination={false}
          columns={customerColumns}
          getRowKey={(client) => client.id}
          isLoading={clientsQuery.isFetching}
          loadingMessage="Loading customers..."
          tableClassName="min-w-[960px]"
          emptyContent={
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <Users aria-hidden="true" className="mb-3 size-8 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                {query
                  ? 'No matching customers'
                  : activeTab === 'ACTIVE'
                    ? 'No active customers found'
                    : 'No archived customers found'}
              </h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {query
                  ? 'No customer accounts match your search filter.'
                  : activeTab === 'ACTIVE'
                    ? 'Register commercial buyers and supermarket customers to manage wholesale accounts.'
                    : 'Archived customer profiles will appear here and can be reactivated at any time.'}
              </p>
              {query && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearchTerm('')}
                >
                  Clear search
                </Button>
              )}
              {!query && activeTab === 'ACTIVE' && canManage && (
                <Button onClick={handleCreate} size="sm" variant="outline" className="mt-4">
                  <Plus data-icon="inline-start" />
                  Register New Customer
                </Button>
              )}
            </div>
          }
        />
      )}

      <CursorPageControls {...clientsQuery} label="Customer" />

      <ClientModal
        client={selectedClient}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <ConfirmDeleteModal
        className="customer-dialog"
        open={!!clientToDeactivate}
        onClose={() => setClientToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Archive Commercial Customer"
        description="Are you sure you want to archive this customer profile? All contact details, invoices, and order histories are safely preserved and can be restored anytime from the Archived Customers tab."
        itemName={clientToDeactivate?.name}
        itemDetails={
          clientToDeactivate
            ? `Contact: ${clientToDeactivate.contactPerson || 'N/A'} • ${clientToDeactivate.phone || 'No phone'}`
            : undefined
        }
        confirmText="Archive Customer"
        variant="destructive"
      />
    </div>
  )
}
