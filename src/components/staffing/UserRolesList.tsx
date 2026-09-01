import { useState, forwardRef } from 'react'
import {
  User,
  Search,
  CheckCircle2,
  Calendar,
  Shield,
  Sparkles,
  RotateCcw,
  Archive,
  MoreVertical,
  ChevronDown,
  Check,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllUsers,
  useUpdateUserRole,
  useEmployees,
  useDeactivateUser,
  useReactivateUser,
} from '@/features/staffing/staffing.hooks'
import { useAuth, normalizeUserRole } from '@/features/auth/AuthContext'
import type { UserRole } from '@/features/auth/auth.types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/button'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

// Role Badge with strict 4x spacing and native button semantics (prevents text selection carets)
interface RoleBadgeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  role: 'OWNER' | 'ADMIN' | 'STAFF'
  interactive?: boolean
  isUpdating?: boolean
}

const RoleBadgeDisplay = forwardRef<HTMLButtonElement, RoleBadgeProps>(
  ({ role, interactive = false, isUpdating = false, className, ...props }, ref) => {
    const configs = {
      OWNER: {
        label: 'OWNER',
        icon: Sparkles,
        color:
          'bg-primary/10 text-primary border-primary/25 hover:bg-primary/15 active:bg-primary/20',
      },
      ADMIN: {
        label: 'ADMIN',
        icon: Shield,
        color:
          'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/15 active:bg-blue-500/20',
      },
      STAFF: {
        label: 'STAFF',
        icon: User,
        color:
          'bg-muted/70 text-muted-foreground border-border/80 hover:bg-muted active:bg-muted/90',
      },
    }[role]

    const Icon = configs.icon

    if (!interactive) {
      return (
        <div
          className={`select-none inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border shadow-2xs cursor-default ${configs.color}`}
        >
          {isUpdating ? (
            <Spinner className="size-3 text-current" />
          ) : (
            <Icon className="size-3 shrink-0 pointer-events-none" />
          )}
          <span className="select-none pointer-events-none">{configs.label}</span>
        </div>
      )
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={isUpdating}
        className={`select-none inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-all shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none ${configs.color} ${
          className || ''
        }`}
        {...props}
      >
        {isUpdating ? (
          <Spinner className="size-3 text-current" />
        ) : (
          <Icon className="size-3 shrink-0 pointer-events-none" />
        )}
        <span className="select-none pointer-events-none">{configs.label}</span>
        <ChevronDown className="size-3 opacity-60 ml-0.5 shrink-0 pointer-events-none" />
      </button>
    )
  },
)
RoleBadgeDisplay.displayName = 'RoleBadgeDisplay'

export function UserRolesList() {
  const { isOwner, user: currentUser } = useAuth()
  const { data: users = [], isLoading, error } = useAllUsers()

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const deactivateUser = useDeactivateUser({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateUser = useReactivateUser()

  const { data: employees = [] } = useEmployees()
  const updateRoleMutation = useUpdateUserRole()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [userToDeactivate, setUserToDeactivate] = useState<typeof users[0] | null>(null)

  const activeUsers = users.filter((u) => u.isActive !== false)
  const archivedUsers = users.filter((u) => u.isActive === false)
  const currentUsers = activeTab === 'ACTIVE' ? activeUsers : archivedUsers

  const filteredUsers = currentUsers.filter(
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
    if (!isOwner) {
      toast.error('Only enterprise owners are authorized to change user roles.')
      return
    }
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

  const handleDeactivate = (user: typeof users[0]) => {
    setUserToDeactivate(user)
  }

  const confirmDeactivate = async () => {
    if (userToDeactivate) {
      const user = userToDeactivate
      setUserToDeactivate(null)
      await deactivateUser.mutateAsync(user)
    }
  }

  const handleReactivate = (user: typeof users[0]) => {
    reactivateUser.mutate(user)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Accounts"
        activeCount={activeUsers.length}
        archivedLabel="Archived Accounts"
        archivedCount={archivedUsers.length}
        activeIcon={<Shield className="size-3.5" />}
        bannerDescription="Showing deactivated user accounts. Archived accounts cannot access POS or operations until reactivated."
      />

      {/* Search and Authority Bar (4x spacing: gap-4, px-4, py-2) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search accounts by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card text-xs h-8 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Badge
            variant="outline"
            className="text-xs py-1 px-3 bg-muted/40 border-border/80 gap-2 text-muted-foreground font-medium shadow-2xs"
          >
            <Shield className="size-3 text-primary" />
            {isOwner ? 'Owner Mode • Role Management Active' : 'View Only • Managed by Enterprise Owner'}
          </Badge>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs">Loading user accounts...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive gap-2 text-xs">
            <p className="font-semibold">Unable to fetch users from backend server.</p>
            <p className="text-muted-foreground">Make sure the backend is running on port 3000.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
            <User className="size-8 stroke-[1.5] text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {activeTab === 'ACTIVE' ? 'No active user accounts found' : 'No archived user accounts'}
              </p>
              {searchQuery ? (
                <p className="text-xs text-muted-foreground mt-1">
                  No accounts match "{searchQuery}"
                </p>
              ) : activeTab === 'ACTIVE' && archivedUsers.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  You have {archivedUsers.length} archived account{archivedUsers.length === 1 ? '' : 's'}.{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('ARCHIVED')}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    View in Archive
                  </button>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground min-w-[240px]">
                    User Account
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground min-w-[190px]">
                    Linked Staff Profile
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground min-w-[170px]">
                    System Role
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground min-w-[110px]">
                    Status
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground min-w-[140px]">
                    Registered Date
                  </TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-foreground text-right w-[80px]">
                    Actions
                  </TableHead>
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
                  const isArchived = u.isActive === false
                  const userRole = normalizeUserRole(
                    u.role || (u as unknown as Record<string, unknown>).userRole,
                  )
                  const isSelf = currentUser?.id === u.id

                  return (
                    <TableRow
                      key={u.id}
                      className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${
                        isArchived ? 'opacity-80 bg-muted/10' : ''
                      }`}
                    >
                      {/* User Account Column (4x spacing: gap-3 between avatar and text) */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 ring-1 ring-border/80 shadow-2xs shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-xs leading-snug truncate">
                                {displayName}
                              </span>
                              {isSelf && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1.5 py-0 font-medium"
                                >
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono truncate">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Linked Staff Column */}
                      <TableCell className="py-3 px-4">
                        {linkedEmp ? (
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1 font-medium text-foreground">
                              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                              <span>
                                {linkedEmp.firstName} {linkedEmp.lastName}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0.5 px-2 text-muted-foreground font-normal bg-muted/40 border-border/60"
                            >
                              Staff #{linkedEmp.id}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">
                            Unlinked account
                          </span>
                        )}
                      </TableCell>

                      {/* System Role Column (Interactive Badge Menu for Owner, Static Badge for Non-Owner) */}
                      <TableCell className="py-3 px-4">
                        {isOwner && !isArchived ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <RoleBadgeDisplay
                                role={userRole}
                                interactive={true}
                                isUpdating={isUpdating}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52 p-1">
                              <DropdownMenuLabel className="px-2 py-1 text-[11px] text-muted-foreground font-normal">
                                Change System Role
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(u.id, 'OWNER', displayName)}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md"
                                >
                                  <span className="flex items-center gap-2 font-bold text-primary">
                                    <Sparkles className="size-3.5" />
                                    OWNER
                                  </span>
                                  {userRole === 'OWNER' && (
                                    <Check className="size-3.5 text-primary" />
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(u.id, 'ADMIN', displayName)}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md"
                                >
                                  <span className="flex items-center gap-2 font-semibold text-foreground">
                                    <Shield className="size-3.5 text-blue-500" />
                                    ADMIN (Operations)
                                  </span>
                                  {userRole === 'ADMIN' && (
                                    <Check className="size-3.5 text-primary" />
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(u.id, 'STAFF', displayName)}
                                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md"
                                >
                                  <span className="flex items-center gap-2 text-muted-foreground">
                                    <User className="size-3.5" />
                                    STAFF (Restricted)
                                  </span>
                                  {userRole === 'STAFF' && (
                                    <Check className="size-3.5 text-primary" />
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <RoleBadgeDisplay
                            role={userRole}
                            interactive={false}
                            isUpdating={isUpdating}
                          />
                        )}
                      </TableCell>

                      {/* Status Column (Strict 4x: px-3 py-1, gap-1) */}
                      <TableCell className="py-3 px-4">
                        {isArchived ? (
                          <Badge
                            variant="outline"
                            className="select-none bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[11px] font-semibold gap-1 px-3 py-1 shadow-2xs cursor-default"
                          >
                            <Archive className="size-3 pointer-events-none" />
                            <span className="select-none pointer-events-none">Archived</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="select-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 text-[11px] font-semibold gap-1 px-3 py-1 shadow-2xs cursor-default"
                          >
                            <CheckCircle2 className="size-3 pointer-events-none" />
                            <span className="select-none pointer-events-none">Active</span>
                          </Badge>
                        )}
                      </TableCell>

                      {/* Registered Date Column (4x spacing: gap-2) */}
                      <TableCell className="py-3 px-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Calendar className="size-3.5 text-muted-foreground/70" />
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </TableCell>

                      {/* Actions Column (4x spacing: size-8 rounded-lg) */}
                      <TableCell className="py-3 px-4 text-right">
                        {isArchived ? (
                          (() => {
                            const isReactivatingThis =
                              reactivateUser.isPending &&
                              (typeof reactivateUser.variables === 'number'
                                ? reactivateUser.variables === u.id
                                : reactivateUser.variables?.id === u.id)

                            return (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReactivate(u)}
                                disabled={isReactivatingThis}
                                className="h-8 px-3 gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 rounded-xl shadow-2xs cursor-pointer transition-all duration-150"
                              >
                                {isReactivatingThis ? (
                                  <Spinner className="size-3 text-emerald-600 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3 transition-transform duration-200 group-hover:-rotate-45" />
                                )}
                                <span>{isReactivatingThis ? 'Reactivating...' : 'Reactivate Account'}</span>
                              </Button>
                            )
                          })()
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 cursor-pointer rounded-lg hover:bg-muted active:scale-90 transition-all duration-150"
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? 'You cannot archive your own active account'
                                    : 'Account actions'
                                }
                              >
                                <MoreVertical className="size-4 text-muted-foreground" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1">
                              <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground font-normal">
                                Account Actions
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => handleDeactivate(u)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs gap-2 px-2 py-1.5 rounded-md active:scale-95 transition-transform"
                                >
                                  <Archive className="size-4" />
                                  Archive Account
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Archive Account Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!userToDeactivate}
        onClose={() => setUserToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Archive User Account"
        description="Are you sure you want to archive this user account? They will be removed from active accounts and will no longer be able to log in or access the system. You can restore this account anytime from the Archived Accounts tab."
        itemName={userToDeactivate?.fullName || userToDeactivate?.email}
        itemDetails={
          userToDeactivate
            ? `Email: ${userToDeactivate.email} • Role: ${userToDeactivate.role || 'STAFF'}`
            : undefined
        }
        confirmText="Archive Account"
        variant="destructive"
      />
    </div>
  )
}
