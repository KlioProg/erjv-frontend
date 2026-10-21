import { Sparkles, Shield, User, HelpCircle, type LucideIcon } from 'lucide-react'

/**
 * Global User Roles
 * Single source of truth for system user roles in ERJV Frontend.
 */
export const USER_ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN', // Top Tier (formerly OWNER)
  MANAGER: 'MANAGER', // Operations Tier (formerly ADMIN)
  STAFF: 'STAFF', // Base Tier
  UNKNOWN: 'UNKNOWN', // who are you tier (defensive fallback / unverified)
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

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
  [USER_ROLES.SUPERADMIN]: {
    role: USER_ROLES.SUPERADMIN,
    label: 'SUPERADMIN',
    title: 'Super Administrator',
    description: 'Protected system administrator with account administration and audit access.',
    badgeClass: 'bg-primary-subtle text-primary-text border-border',
    icon: Sparkles,
  },
  [USER_ROLES.ADMIN]: {
    role: USER_ROLES.ADMIN,
    label: 'ADMIN',
    title: 'Enterprise Administrator',
    description: 'Full system administration, user management, and global configuration.',
    badgeClass:
      'bg-primary-subtle text-primary-text border-border hover:bg-secondary active:bg-muted',
    icon: Sparkles,
  },
  [USER_ROLES.MANAGER]: {
    role: USER_ROLES.MANAGER,
    label: 'MANAGER',
    title: 'Operations Manager',
    description: 'Can manage warehouses, inventory items, transport fleet, and clients.',
    badgeClass: 'bg-secondary text-foreground border-border hover:bg-muted active:bg-muted',
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
  [USER_ROLES.UNKNOWN]: {
    role: USER_ROLES.UNKNOWN,
    label: 'UNKNOWN',
    title: 'Unverified Access',
    description: 'Zero system privileges (defensive lockdown tier).',
    badgeClass:
      'bg-status-warning text-status-warning-foreground border-status-warning-foreground/30 hover:bg-status-warning active:bg-status-warning',
    icon: HelpCircle,
  },
}
