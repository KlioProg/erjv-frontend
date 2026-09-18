/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/api-client'
import { getProfileApi, loginApi, registerApi } from './auth.api'
import type {
  LoginRequest,
  RegisterRequest,
  SafeUserResponse,
  UpdateUserProfilePayload,
} from './auth.types'
import { USER_ROLES, type UserRole } from './roles'

type AuthContextType = {
  user: SafeUserResponse | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  isManager: boolean
  isStaff: boolean
  canManageStaff: boolean
  canManageOperations: boolean
  login: (payload: LoginRequest, rememberMe?: boolean) => Promise<void>
  register: (payload: RegisterRequest) => Promise<SafeUserResponse>
  updateProfile: (payload: UpdateUserProfilePayload) => Promise<SafeUserResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function normalizeUserRole(rawRole: unknown): UserRole {
  if (!rawRole) return USER_ROLES.UNKNOWN
  const str = String(rawRole).trim().toUpperCase()

  // 1. Top Tier: ADMIN (also maps legacy OWNER so OWNER is never shown in frontend)
  if (str === USER_ROLES.ADMIN || str === 'OWNER' || str === 'SUPER_ADMIN' || str === 'SUPERADMIN') {
    return USER_ROLES.ADMIN
  }

  // 2. Operations Tier: MANAGER
  if (str === USER_ROLES.MANAGER || str === 'OPERATIONS') {
    return USER_ROLES.MANAGER
  }

  // 3. Base Tier: STAFF
  if (str === USER_ROLES.STAFF) {
    return USER_ROLES.STAFF
  }

  // 4. Default: UNKNOWN ("who are you tier")
  return USER_ROLES.UNKNOWN
}

export function normalizeUser(
  rawUser: (Partial<SafeUserResponse> & Record<string, unknown>) | null | undefined,
): SafeUserResponse {
  if (!rawUser) {
    return {
      id: 0,
      email: '',
      fullName: null,
      phone: null,
      avatarUrl: null,
      jobTitle: 'Unverified Account',
      bio: null,
      role: USER_ROLES.UNKNOWN,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  // Handle nested envelopes like { user: { ... } } or { data: { ... } }
  const userObj = (
    rawUser.user && typeof rawUser.user === 'object'
      ? rawUser.user
      : rawUser.data && typeof rawUser.data === 'object'
        ? rawUser.data
        : rawUser
  ) as Record<string, unknown>

  const rawRole =
    userObj.role ?? userObj.userRole ?? userObj.roleName ?? rawUser.role ?? rawUser.userRole
  const resolvedRole = normalizeUserRole(rawRole)

  return {
    id: Number(userObj.id ?? rawUser.id) || 1,
    email: String(userObj.email ?? rawUser.email ?? ''),
    fullName:
      (userObj.fullName as string) ||
      (rawUser.fullName as string) ||
      (userObj.firstName
        ? `${String(userObj.firstName)} ${String(userObj.lastName || '')}`.trim()
        : null) ||
      (userObj.name ? String(userObj.name).trim() : null) ||
      null,
    phone: (userObj.phone as string) || (rawUser.phone as string) || null,
    avatarUrl: (userObj.avatarUrl as string) || (rawUser.avatarUrl as string) || null,
    jobTitle:
      (userObj.jobTitle as string) ||
      (rawUser.jobTitle as string) ||
      (resolvedRole === USER_ROLES.ADMIN
        ? 'Enterprise Administrator'
        : resolvedRole === USER_ROLES.MANAGER
          ? 'Operations Manager'
          : resolvedRole === USER_ROLES.STAFF
            ? 'Staff Member'
            : 'Unverified Account'),
    bio: (userObj.bio as string) || (rawUser.bio as string) || null,
    role: resolvedRole,
    isActive: userObj.isActive !== false && rawUser.isActive !== false,
    createdAt: String(userObj.createdAt ?? rawUser.createdAt ?? new Date().toISOString()),
    updatedAt: String(userObj.updatedAt ?? rawUser.updatedAt ?? new Date().toISOString()),
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erjv_access_token'))
  const [user, setUser] = useState<SafeUserResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      // Proactively purge any legacy mock/demo storage
      localStorage.removeItem('erjv_current_user')
      localStorage.removeItem('erjv_demo_user')

      const currentToken = localStorage.getItem('erjv_access_token')
      if (currentToken === 'demo-token') {
        localStorage.removeItem('erjv_access_token')
        if (isMounted) {
          setToken(null)
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      // Check session expiration
      const expiry = localStorage.getItem('erjv_session_expiry')
      if (expiry && Date.now() > Number(expiry)) {
        localStorage.removeItem('erjv_access_token')
        localStorage.removeItem('erjv_session_expiry')
        if (isMounted) {
          setToken(null)
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      if (token) {
        try {
          const profile = await getProfileApi()
          if (isMounted) {
            const normalized = normalizeUser(profile)
            setUser(normalized)
          }
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { status?: number } }).response?.status
              : undefined

          if (status === 401 || status === 403) {
            // Revoked, expired, or invalid token
            localStorage.removeItem('erjv_access_token')
            localStorage.removeItem('erjv_session_expiry')
            if (isMounted) {
              setToken(null)
              setUser(null)
            }
          } else {
            if (isMounted) {
              setUser(null)
            }
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      } else {
        if (isMounted) {
          setToken(null)
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    void initializeAuth()

    return () => {
      isMounted = false
    }
  }, [token])

  const login = async (payload: LoginRequest, rememberMe: boolean = false) => {
    const cleanEmail = payload.email.trim().toLowerCase()
    const cleanPassword = payload.password

    try {
      const loginRes = await loginApi({ email: cleanEmail, password: cleanPassword })
      const accessToken = loginRes.accessToken
      if (!accessToken) {
        throw new Error('No access token returned by server.')
      }

      localStorage.setItem('erjv_access_token', accessToken)
      setToken(accessToken)

      let profile: SafeUserResponse | null = null
      try {
        profile = await getProfileApi()
      } catch {
        try {
          const parts = accessToken.split('.')
          if (parts.length === 3) {
            profile = JSON.parse(atob(parts[1]))
          }
        } catch {
          // Ignore
        }
      }

      const normalized = normalizeUser(profile || { email: cleanEmail })
      setUser(normalized)

      const expiryTime = Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS)
      localStorage.setItem('erjv_session_expiry', String(expiryTime))
      if (rememberMe) {
        localStorage.setItem('erjv_remember_me', 'true')
        localStorage.setItem('erjv_remembered_email', cleanEmail)
      } else {
        localStorage.removeItem('erjv_remember_me')
        localStorage.removeItem('erjv_remembered_email')
      }
    } catch (err) {
      localStorage.removeItem('erjv_access_token')
      setToken(null)
      setUser(null)
      throw new Error(getErrorMessage(err), { cause: err })
    }
  }

  const register = async (payload: RegisterRequest) => {
    setIsLoading(true)
    const cleanEmail = payload.email.trim().toLowerCase()
    const role = payload.role || 'STAFF'

    try {
      const registeredUser = await registerApi({
        email: cleanEmail,
        password: payload.password,
        role,
      })
      return registeredUser
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err), { cause: err })
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (payload: UpdateUserProfilePayload): Promise<SafeUserResponse> => {
    if (!user) {
      throw new Error('No user is currently logged in.')
    }

    const isAdmin = user.role === 'ADMIN'
    const newFullName =
      isAdmin && payload.fullName !== undefined ? payload.fullName.trim() : user.fullName

    const updatedUser: SafeUserResponse = {
      ...user,
      fullName: newFullName,
      phone: payload.phone !== undefined ? payload.phone : user.phone,
      avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : user.avatarUrl,
      jobTitle: payload.jobTitle !== undefined ? payload.jobTitle : user.jobTitle,
      bio: payload.bio !== undefined ? payload.bio : user.bio,
      updatedAt: new Date().toISOString(),
    }

    setUser(updatedUser)
    return updatedUser
  }

  const logout = () => {
    localStorage.removeItem('erjv_access_token')
    localStorage.removeItem('erjv_current_user')
    localStorage.removeItem('erjv_demo_user')
    localStorage.removeItem('erjv_session_expiry')
    setToken(null)
    setUser(null)
  }

  const userRecord = user as unknown as Record<string, unknown> | null
  const userRole = normalizeUserRole(user?.role || userRecord?.userRole || userRecord?.roleName)
  const isAdmin = userRole === USER_ROLES.ADMIN
  const isManager = userRole === USER_ROLES.MANAGER
  const isStaff = userRole === USER_ROLES.STAFF
  const canManageStaff = isAdmin || isManager
  const canManageOperations = isAdmin || isManager

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        isManager,
        isStaff,
        canManageStaff,
        canManageOperations,
        login,
        register,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
