import { Sparkles, Shield, User, type LucideIcon } from 'lucide-react'

/**
 * Global User Roles
 * Single source of truth for system user roles in ERJV Frontend.
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',     // Top Tier (formerly OWNER)
  MANAGER: 'MANAGER', // Operations Tier (formerly ADMIN)
  STAFF: 'STAFF',     // Base Tier
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export type BackendUserRole = 'OWNER' | 'ADMIN' | 'STAFF'

/**
 * Bidirectional Backend Role Mapping
 * Backend database and DTOs currently validate against: 'OWNER' | 'ADMIN' | 'STAFF'
 * - Frontend ADMIN   <-> Backend OWNER (Enterprise Administrator / Owner)
 * - Frontend MANAGER <-> Backend ADMIN (Operations Manager)
 * - Frontend STAFF   <-> Backend STAFF (Standard Staff)
 */
export const BACKEND_ROLE_MAP = {
  toBackend: (role: UserRole): BackendUserRole => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return 'OWNER'
      case USER_ROLES.MANAGER:
        return 'ADMIN'
      case USER_ROLES.STAFF:
      default:
        return 'STAFF'
    }
  },
  fromBackend: (raw: unknown): UserRole => {
    if (!raw) return USER_ROLES.STAFF
    const str = String(raw).trim().toUpperCase()

    // Handle legacy backend OWNER and new frontend ADMIN
    if (str === 'OWNER' || str.includes('OWNER') || str === 'SUPER_ADMIN' || str === 'SUPERADMIN') {
      return USER_ROLES.ADMIN
    }

    // Handle legacy backend ADMIN and new frontend MANAGER (Operations)
    if (str === 'MANAGER' || str === 'ADMIN' || str.includes('ADMIN') || str === 'OPERATIONS') {
      return USER_ROLES.MANAGER
    }

    return USER_ROLES.STAFF
  },
}

export interface RoleConfig {
  role: UserRole
  label: string
  title: string
  description: string
  badgeClass: string
  icon: LucideIcon
}

/**
 * Centralized Role Metadata for UI (Badges, Labels, Icons, Descriptions)
 */
export const ROLE_DETAILS: Record<UserRole, RoleConfig> = {
  [USER_ROLES.ADMIN]: {
    role: USER_ROLES.ADMIN,
    label: 'ADMIN',
    title: 'Enterprise Administrator',
    description: 'Full system administration, user management, and global configuration.',
    badgeClass: 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/15 active:bg-primary/20',
    icon: Sparkles,
  },
  [USER_ROLES.MANAGER]: {
    role: USER_ROLES.MANAGER,
    label: 'MANAGER',
    title: 'Operations Manager',
    description: 'Can manage warehouses, inventory items, transport fleet, and clients.',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/15 active:bg-blue-500/20',
    icon: Shield,
  },
  [USER_ROLES.STAFF]: {
    role: USER_ROLES.STAFF,
    label: 'STAFF',
    title: 'Staff Member',
    description: 'Standard employee access for daily operational tasks and viewing records.',
    badgeClass: 'bg-muted/80 text-muted-foreground border-border hover:bg-muted active:bg-muted/90',
    icon: User,
  },
}
