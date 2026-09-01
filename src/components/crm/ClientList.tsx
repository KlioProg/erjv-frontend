import { useState } from 'react'
import {
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  CheckCircle2,
  User,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const { isOwner, isAdmin } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToDeactivate, setClientToDeactivate] = useState<Client | null>(null)

  const activeClients = allClients.filter((c) => c.isActive !== false)
  const archivedClients = allClients.filter((c) => c.isActive === false)
  const currentClientList = activeTab === 'ACTIVE' ? activeClients : archivedClients

  const filteredClients = currentClientList.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleCreate = () => {
    setSelectedClient(null)
    setIsModalOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const handleDeactivate = (client: Client) => {
    setClientToDeactivate(client)
  }

  const confirmDeactivate = async () => {
    if (clientToDeactivate) {
      await deactivateMutation.mutateAsync(clientToDeactivate)
      setClientToDeactivate(null)
    }
  }

  const handleReactivate = async (client: Client) => {
    await reactivateMutation.mutateAsync(client.id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Directory Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Clients"
        activeCount={activeClients.length}
        archivedLabel="Archived Clients"
        archivedCount={archivedClients.length}
        activeIcon={<Users className="size-3.5" />}
        bannerDescription="Showing deactivated commercial clients. Past orders, invoices, and contact data remain safely preserved and can be reactivated anytime."
      />

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search clients by name, contact, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {(isOwner || isAdmin) && activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} size="sm" className="gap-1.5 shadow-xs cursor-pointer">
            <Plus className="size-4" />
            Register New Client
          </Button>
        )}
      </div>

      {/* Clients Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading CRM client directory...
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {activeTab === 'ACTIVE' ? 'No active clients found' : 'No deactivated clients found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm
                ? 'No client accounts match your search filter.'
                : activeTab === 'ACTIVE'
                  ? archivedClients.length > 0
                    ? `All client profiles are currently archived (${archivedClients.length} total).`
                    : 'Register commercial buyers and supermarket clients to manage wholesale accounts.'
                  : 'Archived client profiles will appear here and can be reactivated at any time.'}
            </p>
            {!searchTerm && activeTab === 'ACTIVE' && archivedClients.length > 0 && (
              <Button
                onClick={() => setActiveTab('ARCHIVED')}
                size="sm"
                variant="outline"
                className="mt-3 gap-1.5 cursor-pointer text-xs"
              >
                <Archive className="size-3.5 text-amber-600" />
                View Archived Clients ({archivedClients.length})
              </Button>
            )}
            {!searchTerm && activeTab === 'ACTIVE' && archivedClients.length === 0 && (
              <Button
                onClick={handleCreate}
                size="sm"
                variant="outline"
                className="mt-4 gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" />
                Register First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const isArchived = client.isActive === false

            return (
              <Card
                key={client.id}
                className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40 border-border/80 rounded-2xl ${
                  isArchived ? 'opacity-75 bg-muted/20 border-dashed' : ''
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
                          isArchived
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Building2 className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground leading-tight truncate">
                            {client.name}
                          </h4>
                          {isArchived && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-[10px] font-bold"
                            >
                              Deactivated
                            </Badge>
                          )}
                        </div>
                        {client.contactPerson && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <User className="size-3 shrink-0" />
                            <span className="truncate">{client.contactPerson}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(isOwner || isAdmin) && (
                      <div>
                        {isArchived ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReactivate(client)}
                            disabled={reactivateMutation.isPending}
                            className="h-8.5 px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl gap-1.5 shadow-2xs cursor-pointer transition-all"
                          >
                            <RotateCcw className="size-3.5" />
                            Reactivate Client
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <MoreVertical className="size-4" />
                                <span className="sr-only">Client actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEdit(client)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Edit2 className="size-3.5" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeactivate(client)}
                                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Archive className="size-3.5" />
                                Archive Client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                    <MapPin className="size-3.5 shrink-0 mt-0.5 text-primary" />
                    <span className="line-clamp-2">{client.address}</span>
                  </div>

                  {/* Contact Channels */}
                  <div className="flex flex-col gap-1.5 pt-3 border-t border-border/60 text-xs">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                        <Phone className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ID: #{client.id.toString().padStart(4, '0')}
                    </span>
                    {!isArchived && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium gap-1"
                      >
                        <CheckCircle2 className="size-2.5" />
                        Active Client
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ClientModal
        client={selectedClient}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!clientToDeactivate}
        onClose={() => setClientToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Archive Commercial Client"
        description="Are you sure you want to archive this client profile? All contact details, invoices, and order histories are safely preserved and can be restored anytime from the Archived Clients tab."
        itemName={clientToDeactivate?.name}
        itemDetails={
          clientToDeactivate
            ? `Contact: ${clientToDeactivate.contactPerson || 'N/A'} • ${clientToDeactivate.phone || 'No phone'}`
            : undefined
        }
        confirmText="Archive Client"
        variant="destructive"
      />
    </div>
  )
}
