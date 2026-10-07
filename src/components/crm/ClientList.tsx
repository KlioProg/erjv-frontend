import { useState } from 'react'
import { Archive, Plus, Search, Users } from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DirectoryStatusBadge } from '@/components/ui/DirectoryRowControls'
import { DataTableActions } from '@/components/ui/DataTableActions'
import {
  useAllClients,
  useDeactivateClient,
  useReactivateClient,
} from '@/features/crm/clients.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { Client } from '@/features/crm/clients.types'
import { ClientModal } from './ClientModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function ClientList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: allClients = [], isLoading } = useAllClients()
  const deactivateMutation = useDeactivateClient({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateMutation = useReactivateClient()
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToDeactivate, setClientToDeactivate] = useState<Client | null>(null)

  const activeClients = allClients.filter((client) => client.isActive !== false)
  const archivedClients = allClients.filter((client) => client.isActive === false)
  const currentClientList = activeTab === 'ACTIVE' ? activeClients : archivedClients
  const query = searchTerm.trim().toLowerCase()
  const filteredClients = currentClientList.filter(
    (client) =>
      client.name.toLowerCase().includes(query) ||
      client.address.toLowerCase().includes(query) ||
      client.contactPerson?.toLowerCase().includes(query) ||
      client.phone?.includes(searchTerm.trim()) ||
      client.email?.toLowerCase().includes(query),
  )

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
      setClientToDeactivate(null)
      await deactivateMutation.mutateAsync(client)
    }
  }

  const customerColumns: ColumnDef<Client>[] = [
    {
      id: 'customer-id',
      header: 'Customer ID',
      accessorKey: 'id',
      sortable: true,
      className: 'font-mono text-xs font-bold text-foreground',
      cell: ({ row }) => `#${String(row.id).padStart(4, '0')}`,
    },
    {
      id: 'customer-name',
      header: 'Customer Name',
      accessorKey: 'name',
      sortable: true,
      className: 'text-xs font-semibold text-foreground',
    },
    {
      id: 'customer-contact',
      header: 'Contact Person',
      accessorKey: 'contactPerson',
      className: 'text-xs text-foreground/90',
      cell: ({ row }) => row.contactPerson || '—',
    },
    {
      id: 'customer-channels',
      header: 'Phone & Email',
      className: 'text-xs text-muted-foreground',
      cell: ({ row }) => (
        <>
          <div>{row.phone || '—'}</div>
          {row.email && <div className="text-[10px] text-primary">{row.email}</div>}
        </>
      ),
    },
    {
      id: 'customer-address',
      header: 'Address',
      accessorKey: 'address',
      className: 'max-w-[200px] truncate text-xs text-muted-foreground',
      cell: ({ row }) => <span title={row.address}>{row.address || '—'}</span>,
    },
    {
      id: 'customer-status',
      header: 'Status',
      align: 'center',
      cell: ({ row }) => (
        <DirectoryStatusBadge isActive={row.isActive !== false} inactiveLabel="Archived" />
      ),
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
    <div className="flex flex-col gap-5">
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Customers"
        activeCount={activeClients.length}
        archivedLabel="Archived Customers"
        archivedCount={archivedClients.length}
        activeIcon={<Users className="size-3.5" />}
        bannerDescription="Showing deactivated commercial customers. Past orders, invoices, and contact data remain safely preserved and can be reactivated anytime."
      />

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search customers"
            placeholder="Search customers by name, contact, city..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        {canManage && activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} size="sm">
            <Plus data-icon="inline-start" />
            Register New Customer
          </Button>
        )}
      </div>

      <DataTable
        data={filteredClients}
        columns={customerColumns}
        getRowKey={(client) => client.id}
        isLoading={isLoading}
        loadingMessage="Loading customers..."
        tableClassName="min-w-[850px]"
        emptyContent={
          <Card className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 size-10 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground">
                {activeTab === 'ACTIVE'
                  ? 'No active customers found'
                  : 'No archived customers found'}
              </h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {searchTerm
                  ? 'No customer accounts match your search filter.'
                  : activeTab === 'ACTIVE'
                    ? archivedClients.length > 0
                      ? `All customer profiles are currently archived (${archivedClients.length} total).`
                      : 'Register commercial buyers and supermarket customers to manage wholesale accounts.'
                    : 'Archived customer profiles will appear here and can be reactivated at any time.'}
              </p>
              {!searchTerm && activeTab === 'ACTIVE' && archivedClients.length > 0 && (
                <Button
                  onClick={() => setActiveTab('ARCHIVED')}
                  size="sm"
                  variant="outline"
                  className="mt-3"
                >
                  <Archive data-icon="inline-start" />
                  View Archived Customers ({archivedClients.length})
                </Button>
              )}
              {!searchTerm &&
                activeTab === 'ACTIVE' &&
                archivedClients.length === 0 &&
                canManage && (
                  <Button onClick={handleCreate} size="sm" variant="outline" className="mt-4">
                    <Plus data-icon="inline-start" />
                    Register First Customer
                  </Button>
                )}
            </CardContent>
          </Card>
        }
      />

      <ClientModal
        client={selectedClient}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <ConfirmDeleteModal
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
