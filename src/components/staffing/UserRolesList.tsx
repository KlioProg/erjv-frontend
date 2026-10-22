import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import type { UserAccount } from '@/features/staffing/staffing.types'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
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
  ChevronDown,
  Check,
  UserPlus,
  AlertCircle,
} from 'lucide-react'
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
import { DataTableActions } from '@/components/ui/DataTableActions'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllUsers,
  useUpdateUserRole,
  useEmployees,
  useDeactivateUser,
  useReactivateUser,
} from '@/features/staffing/staffing.hooks'
import { useAuth, normalizeUserRole } from '@/features/auth/AuthContext'
import { USER_ROLES, ROLE_DETAILS, type UserRole } from '@/features/auth/roles'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { RegisterUserModal } from './RegisterUserModal'
import { getErrorMessage } from '@/lib/api-client'

// Role Badge with strict 4x spacing and native button semantics (prevents text selection carets)
interface RoleBadgeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  role: UserRole
  interactive?: boolean
  isUpdating?: boolean
}

const RoleBadgeDisplay = forwardRef<HTMLButtonElement, RoleBadgeProps>(
  ({ role, interactive = false, isUpdating = false, className, ...props }, ref) => {
    const config = ROLE_DETAILS[role] || ROLE_DETAILS[USER_ROLES.UNKNOWN]
    const Icon = config.icon

    if (!interactive) {
      return (
        <div
          className={`select-none inline-flex h-8 w-36 items-center gap-2 rounded-lg border px-2.5 text-ui font-medium cursor-default pointer-coarse:h-11 ${config.badgeClass}`}
        >
          {isUpdating ? (
            <Spinner className="size-3 text-current" />
          ) : (
            <Icon className="size-3 shrink-0 pointer-events-none" />
          )}
          <span className="select-none pointer-events-none min-w-0 flex-1 truncate text-center">
            {config.label}
          </span>
        </div>
      )
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={isUpdating}
        aria-label={`Change system role; current role ${config.label}`}
        className={`select-none inline-flex h-8 w-36 items-center justify-between gap-2 rounded-lg border px-2.5 text-ui font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer pointer-coarse:h-11 ${config.badgeClass} ${
          className || ''
        }`}
        {...props}
      >
        {isUpdating ? (
          <Spinner className="size-3 text-current" />
        ) : (
          <Icon className="size-3 shrink-0 pointer-events-none" />
        )}
        <span className="select-none pointer-events-none min-w-0 flex-1 truncate text-center">
          {config.label}
        </span>
        <ChevronDown className="size-3 opacity-60 ml-0.5 shrink-0 pointer-events-none" />
      </button>
    )
  },
)
RoleBadgeDisplay.displayName = 'RoleBadgeDisplay'

export function UserRolesList() {
  const { isAdmin, user: currentUser, syncUser } = useAuth()
  const { data: users = [], isLoading, isFetching, error, refetch } = useAllUsers()

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const deactivateUser = useDeactivateUser({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateUser = useReactivateUser()

  const { data: employees = [] } = useEmployees()
  const updateRoleMutation = useUpdateUserRole()

  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [userToDeactivate, setUserToDeactivate] = useState<(typeof users)[0] | null>(null)

  const activeUsers = users.filter((u) => u.isActive !== false)
  const archivedUsers = users.filter((u) => u.isActive === false)
  const lastAdminId =
    activeUsers.filter((u) => u.role === USER_ROLES.ADMIN).length === 1
      ? activeUsers.find((u) => u.role === USER_ROLES.ADMIN)?.id
      : undefined
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
    if (!isAdmin) {
      toast.error('Only enterprise administrators are authorized to change user roles.')
      return
    }
    setUpdatingId(userId)
    try {
      const updated = await updateRoleMutation.mutateAsync({ id: userId, role })
      syncUser(updated)
      toast.success(`Role updated to ${role} for ${targetName}!`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeactivate = (user: (typeof users)[0]) => {
    setUserToDeactivate(user)
  }

  const confirmDeactivate = async () => {
    if (userToDeactivate) {
      const user = userToDeactivate
      setUserToDeactivate(null)
      await deactivateUser.mutateAsync(user)
    }
  }

  const handleReactivate = (user: (typeof users)[0]) => {
    reactivateUser.mutate(user)
  }

  const renderUserCell = (
    u: UserAccount,
    column: 'account' | 'staff' | 'role' | 'status' | 'registered' | 'actions',
  ) => {
    const linkedEmp = getLinkedEmployee(u.id, u.email)
    const isUpdating = updatingId === u.id
    const displayName =
      u.fullName ||
      (linkedEmp ? linkedEmp.firstName + ' ' + linkedEmp.lastName : u.email.split('@')[0])
    const initial = displayName.charAt(0).toUpperCase()
    const isArchived = u.isActive === false
    const userRole = normalizeUserRole(u.role || (u as unknown as Record<string, unknown>).userRole)
    const isSelf = currentUser?.id === u.id
    const isSuperadmin = userRole === USER_ROLES.SUPERADMIN
    const isLastAdmin = u.id === lastAdminId
    switch (column) {
      case 'account':
        return (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="size-9 ring-1 ring-border shrink-0">
                <AvatarFallback className="bg-secondary text-foreground text-xs font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground leading-snug truncate">
                    {displayName}
                  </span>
                  {isSelf && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 font-medium">
                      You
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{u.email}</span>
              </div>
            </div>
          </>
        )
      case 'staff':
        return (
          <>
            {linkedEmp ? (
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <CheckCircle2 className="size-3.5 text-status-success-foreground shrink-0" />
                  <span>
                    {linkedEmp.firstName} {linkedEmp.lastName}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs py-0.5 px-2 text-muted-foreground font-normal bg-secondary border-border"
                >
                  Staff #{linkedEmp.id}
                </Badge>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unlinked account</span>
            )}
          </>
        )
      case 'role':
        return (
          <>
            {isAdmin && !isArchived && !isSuperadmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <RoleBadgeDisplay role={userRole} interactive={true} isUpdating={isUpdating} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 p-1">
                  <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground font-normal">
                    Change System Role
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(u.id, USER_ROLES.ADMIN, displayName)}
                      className="flex items-center justify-between gap-2 px-2 py-2 text-ui cursor-pointer rounded-md"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Sparkles className="size-3.5" />
                        ADMIN
                      </span>
                      {userRole === USER_ROLES.ADMIN && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isLastAdmin}
                      onClick={() => handleRoleChange(u.id, USER_ROLES.MANAGER, displayName)}
                      className="flex items-center justify-between gap-2 px-2 py-2 text-ui cursor-pointer rounded-md"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Shield className="size-3.5 text-muted-foreground" />
                        MANAGER (Operations)
                      </span>
                      {userRole === USER_ROLES.MANAGER && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isLastAdmin}
                      onClick={() => handleRoleChange(u.id, USER_ROLES.STAFF, displayName)}
                      className="flex items-center justify-between gap-2 px-2 py-2 text-ui cursor-pointer rounded-md"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <User className="size-3.5" />
                        STAFF (Restricted)
                      </span>
                      {userRole === USER_ROLES.STAFF && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <RoleBadgeDisplay role={userRole} interactive={false} isUpdating={isUpdating} />
            )}
          </>
        )
      case 'status':
        return (
          <>
            {isArchived ? (
              <Badge
                variant="outline"
                className="select-none bg-status-warning text-status-warning-foreground border-status-warning-foreground/20 text-xs font-medium gap-1 px-3 py-1 cursor-default"
              >
                <Archive className="size-3 pointer-events-none" />
                <span className="select-none pointer-events-none">Archived</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="select-none bg-status-success text-status-success-foreground border-status-success-foreground/20 text-xs font-medium gap-1 px-3 py-1 cursor-default"
              >
                <CheckCircle2 className="size-3 pointer-events-none" />
                <span className="select-none pointer-events-none">Active</span>
              </Badge>
            )}
          </>
        )
      case 'registered':
        return (
          <>
            <span className="inline-flex items-center gap-2 text-sm tabular-nums">
              <Calendar className="size-3.5 text-muted-foreground" />
              {new Date(u.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </>
        )
      case 'actions':
        if (!isAdmin || isSuperadmin) return null
        return (
          <>
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
                    className="gap-2"
                  >
                    {isReactivatingThis ? (
                      <Spinner className="size-3" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    <span>{isReactivatingThis ? 'Reactivating...' : 'Reactivate Account'}</span>
                  </Button>
                )
              })()
            ) : (
              <DataTableActions
                onArchive={() => handleDeactivate(u)}
                isPending={isSelf || isLastAdmin || deactivateUser.isPending}
              />
            )}
          </>
        )
      default:
        return null
    }
  }

  const userColumns: ColumnDef<UserAccount>[] = [
    {
      id: 'user-account',
      header: 'User Account',
      cell: ({ row }) => renderUserCell(row, 'account'),
    },
    {
      id: 'linked-staff-profile',
      header: 'Linked Staff Profile',
      cell: ({ row }) => renderUserCell(row, 'staff'),
    },
    { id: 'system-role', header: 'System Role', cell: ({ row }) => renderUserCell(row, 'role') },
    { id: 'status', header: 'Status', cell: ({ row }) => renderUserCell(row, 'status') },
    {
      id: 'registered-date',
      header: 'Registered Date',
      cell: ({ row }) => renderUserCell(row, 'registered'),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'w-px whitespace-nowrap',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row }) => renderUserCell(row, 'actions'),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Manage user accounts, staff links, and system access.">
        User Roles &amp; Access
      </PageHeader>
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
      <PageToolbar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search user accounts"
            placeholder="Search accounts by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2 self-end sm:self-center">
          <Badge
            variant="outline"
            className="whitespace-normal text-xs py-1 px-3 border-border/80 gap-2 text-muted-foreground font-medium"
          >
            <Shield className="size-3 text-primary" />
            {isAdmin
              ? 'Admin Mode • Role Management Active'
              : 'View Only • Managed by System Administrator'}
          </Badge>

          {isAdmin && (
            <Button size="sm" onClick={() => setIsRegisterModalOpen(true)} className="gap-2">
              <UserPlus className="size-3.5" />
              Register User
            </Button>
          )}
        </div>
      </PageToolbar>

      {/* Users Table */}
      <div className="min-w-0">
        {isLoading ? (
          <DataTable
            appearance="management"
            data={filteredUsers}
            columns={userColumns}
            getRowKey={(row) => row.id}
            isLoading
            loadingMessage="Loading user accounts..."
            pageSize={10}
            pageSizeOptions={[10, 25, 50, 100]}
            tableClassName="min-w-[980px]"
          />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <AlertCircle className="mb-3 size-6 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Unable to load user accounts</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              We encountered an issue connecting to the service. Please check your network
              connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 gap-2 text-ui font-medium border-border/80 hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              {isFetching ? 'Retrying...' : 'Try Again'}
            </Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
            <User className="size-8 stroke-[1.5] text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {activeTab === 'ACTIVE'
                  ? 'No active user accounts found'
                  : 'No archived user accounts'}
              </p>
              {searchQuery ? (
                <p className="text-xs text-muted-foreground mt-1">
                  No accounts match "{searchQuery}"
                </p>
              ) : activeTab === 'ACTIVE' ? (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Get started by registering user accounts for your team.
                  </p>
                  {isAdmin && (
                    <Button
                      size="sm"
                      onClick={() => setIsRegisterModalOpen(true)}
                      className="gap-2"
                    >
                      <UserPlus className="size-3.5" />
                      Register First User Account
                    </Button>
                  )}
                </div>
              ) : archivedUsers.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  You have {archivedUsers.length} archived account
                  {archivedUsers.length === 1 ? '' : 's'}.{' '}
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
          <DataTable
            appearance="management"
            data={filteredUsers}
            columns={userColumns}
            getRowKey={(row) => row.id}
            pageSize={10}
            pageSizeOptions={[10, 25, 50, 100]}
            tableClassName="min-w-[980px]"
            rowClassName={(row) => (row.isActive === false ? 'bg-muted/10 opacity-80' : '')}
          />
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
            ? `Email: ${userToDeactivate.email} • Role: ${userToDeactivate.role || USER_ROLES.UNKNOWN}`
            : undefined
        }
        confirmText="Archive Account"
        variant="destructive"
      />

      {/* Register User Modal (Admin Only) */}
      <RegisterUserModal open={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} />
    </div>
  )
}
