import { useState } from 'react'
import {
  User,
  Search,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
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
import { useUsers, useUpdateUserRole, useEmployees } from '@/features/staffing/staffing.hooks'
import type { UserRole } from '@/features/auth/auth.types'

export function UserRolesList() {
  const { data: users = [], isLoading, error } = useUsers()
  const { data: employees = [] } = useEmployees()
  const updateRoleMutation = useUpdateUserRole()

  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setUpdatingId(userId)
    try {
      await updateRoleMutation.mutateAsync({ id: userId, role })
    } finally {
      setUpdatingId(null)
    }
  }

  // Find linked employee for a user
  const getLinkedEmployee = (userId: number) => {
    return employees.find((e) => e.userId === userId)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">User Accounts & System Roles</h3>
          <p className="text-xs text-muted-foreground">
            Manage authentication accounts and system permission levels (Owner, Admin, Staff).
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by user email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
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
                <TableHead>Linked Employee Profile</TableHead>
                <TableHead>Registered Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">System Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const linkedEmp = getLinkedEmployee(u.id)
                const isUpdating = updatingId === u.id

                return (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 ring-1 ring-border">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {u.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">{u.email}</span>
                          <span className="text-[10px] text-muted-foreground">User ID #{u.id}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {linkedEmp ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span className="font-medium">
                            {linkedEmp.firstName} {linkedEmp.lastName}
                          </span>
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
                      <Badge
                        variant={u.isActive ? 'default' : 'secondary'}
                        className="text-[10px] font-semibold"
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end w-36">
                        <Select
                          value={u.role}
                          onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold">
                            {isUpdating ? (
                              <Spinner className="size-3 mr-1" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectGroup>
                              <SelectItem value="OWNER">
                                <span className="font-bold text-primary">OWNER</span>
                              </SelectItem>
                              <SelectItem value="ADMIN">
                                <span className="font-semibold text-foreground">ADMIN</span>
                              </SelectItem>
                              <SelectItem value="STAFF">
                                <span className="text-muted-foreground">STAFF</span>
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
