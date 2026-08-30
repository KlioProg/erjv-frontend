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
  Trash2,
  CheckCircle2,
  User,
} from 'lucide-react'
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
  useClients,
  useDeactivateClient,
} from '@/features/crm/clients.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { Client } from '@/features/crm/clients.types'
import { ClientModal } from './ClientModal'

import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function ClientList() {
  const { data: clients = [], isLoading } = useClients()
  const deactivateMutation = useDeactivateClient()
  const { isOwner, isAdmin } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToDeactivate, setClientToDeactivate] = useState<Client | null>(null)

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
      await deactivateMutation.mutateAsync(clientToDeactivate.id)
      setClientToDeactivate(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
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

        {(isOwner || isAdmin) && (
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
            <h3 className="text-sm font-semibold text-foreground">No clients found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm
                ? 'No client accounts match your search filter.'
                : 'Register commercial buyers and supermarket clients to manage wholesale accounts.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate} size="sm" variant="outline" className="mt-4 gap-1.5">
                <Plus className="size-3.5" />
                Register First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            return (
              <Card
                key={client.id}
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40 border-border/80"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">
                          {client.name}
                        </h4>
                        {client.contactPerson && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <User className="size-3 shrink-0" />
                            <span>{client.contactPerson}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(isOwner || isAdmin) && (
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
                          <DropdownMenuItem onClick={() => handleEdit(client)} className="gap-2 text-xs cursor-pointer">
                            <Edit2 className="size-3.5" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(client)}
                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            Deactivate Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                    <span className="text-[10px] text-muted-foreground">
                      ID: #{client.id.toString().padStart(4, '0')}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium gap-1">
                      <CheckCircle2 className="size-2.5" />
                      Active Client
                    </Badge>
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
        title="Deactivate Commercial Client"
        description="Are you sure you want to deactivate this client profile? Active orders, customer details, and invoices will be archived."
        itemName={clientToDeactivate?.name}
        itemDetails={clientToDeactivate ? `Contact: ${clientToDeactivate.contactPerson || 'N/A'} • ${clientToDeactivate.phone || 'No phone'}` : undefined}
        confirmText="Deactivate Client"
        variant="destructive"
      />
    </div>
  )
}
