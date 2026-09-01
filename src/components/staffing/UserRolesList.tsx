import { useState } from 'react'
import { User, Search, CheckCircle2, Calendar, Shield, Sparkles } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useAllUsers, useUpdateUserRole, useEmployees, useDeactivateUser, useReactivateUser } from '@/features/staffing/staffing.hooks'
import { normalizeUserRole } from '@/features/auth/AuthContext'
import type { UserRole } from '@/features/auth/auth.types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/button'

export function UserRolesList() {
  const { data: users = [], isLoading, error } = useAllUsers()

  const deactivateUser = useDeactivateUser()
  const reactivateUser = useReactivateUser()

  const { data: employees = [] } = useEmployees()
  const updateRoleMutation = useUpdateUserRole()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const getLinkedEmployee = (userId: number, email?: string) => {
    return employees.find(
      (e) => e.userId === userId || (email && e.email?.toLowerCase() === email.toLowerCase()),
    )
  }

  const handleRoleChange = async (userId: number, role: UserRole, targetName: string) => {
    setUpdatingId(userId)
    try {
      await updateRoleMutation.mutateAsync({ id: userId, role })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(`Role updated to ${role} for ${targetName}!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user role.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            User Accounts & System Roles
          </h3>
          <p className="text-xs text-muted-foreground">
            Assign system permission tiers (
            <strong className="text-primary font-bold">OWNER</strong>,{' '}
            <strong className="text-foreground font-semibold">ADMIN</strong>, or{' '}
            <strong className="text-muted-foreground">STAFF</strong>) to any registered user from
            the database.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card text-xs h-9"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading user accounts...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive gap-1 text-xs">
            <p className="font-semibold">Unable to fetch users from backend server.</p>
            <p className="text-muted-foreground">Make sure the backend is running on port 3000.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <User className="size-8 stroke-[1.5] text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No user accounts found</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>User Account</TableHead>
                <TableHead>Linked Staff Profile</TableHead>
                <TableHead>Registered Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">System Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const linkedEmp = getLinkedEmployee(u.id, u.email)
                const isUpdating = updatingId === u.id
                const displayName =
                  u.fullName ||
                  (linkedEmp
                    ? `${linkedEmp.firstName} ${linkedEmp.lastName}`
                    : u.email.split('@')[0])
                const initial = displayName.charAt(0).toUpperCase()

                return (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8.5 ring-1 ring-border shadow-2xs">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground text-xs leading-snug truncate">
                            {displayName}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono truncate">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {linkedEmp ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {linkedEmp.firstName} {linkedEmp.lastName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1 text-muted-foreground font-normal"
                          >
                            Staff #{linkedEmp.id}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Not linked</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {new Date(u.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          u.isActive
                            ? deactivateUser.mutate(u)
                            : reactivateUser.mutate(u)
                        }
                        disabled={
                          (deactivateUser.isPending &&
                            typeof deactivateUser.variables !== 'number' &&
                            deactivateUser.variables?.id === u.id) ||
                          (reactivateUser.isPending &&
                            typeof reactivateUser.variables !== 'number' &&
                            reactivateUser.variables?.id === u.id)
                        }
                        className="h-auto p-0 hover:bg-transparent"
                      >
                        <Badge
                          variant={u.isActive ? 'default' : 'secondary'}
                          className="cursor-pointer text-[10px] font-semibold"
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end w-36">
                        <Select
                          value={normalizeUserRole(
                            u.role || (u as unknown as Record<string, unknown>).userRole,
                          )}
                          onValueChange={(val) =>
                            handleRoleChange(u.id, val as UserRole, displayName)
                          }
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold cursor-pointer">
                            {isUpdating ? <Spinner className="size-3 mr-1" /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectGroup>
                              <SelectItem value="OWNER">
                                <span className="font-bold text-primary flex items-center gap-1.5">
                                  <Sparkles className="size-3" /> OWNER
                                </span>
                              </SelectItem>
                              <SelectItem value="ADMIN">
                                <span className="font-semibold text-foreground">
                                  ADMIN (Operations)
                                </span>
                              </SelectItem>
                              <SelectItem value="STAFF">
                                <span className="text-muted-foreground">STAFF (Restricted)</span>
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
