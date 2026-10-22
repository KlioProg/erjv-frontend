/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AUTH_SESSION_EXPIRED_EVENT, getErrorMessage } from '@/lib/api-client'
import { getProfileApi, loginApi, registerApi } from './auth.api'
import type { LoginRequest, RegisterRequest, SafeUserResponse } from './auth.types'
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
  logout: () => void
  syncUser: (updated: SafeUserResponse) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function normalizeUserRole(rawRole: unknown): UserRole {
  if (!rawRole) return USER_ROLES.UNKNOWN
  const str = String(rawRole).trim().toUpperCase()
  if (str === USER_ROLES.SUPERADMIN || str === 'SUPER_ADMIN') return USER_ROLES.SUPERADMIN

  // 1. Top Tier: ADMIN (also maps legacy OWNER so OWNER is never shown in frontend)
  if (str === USER_ROLES.ADMIN || str === 'OWNER') {
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
      (resolvedRole === USER_ROLES.SUPERADMIN
        ? 'Super Administrator'
        : resolvedRole === USER_ROLES.ADMIN
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

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erjv_access_token'))
  const [user, setUser] = useState<SafeUserResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const expireSession = () => {
      queryClient.clear()
      setToken(null)
      setUser(null)
    }
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expireSession)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expireSession)
  }, [queryClient])

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

      if (currentToken) {
        try {
          const profile = await getProfileApi()
          if (isMounted) {
            if (profile?.id && profile.isActive) {
              setUser(normalizeUser(profile))
            } else {
              localStorage.removeItem('erjv_access_token')
              localStorage.removeItem('erjv_session_expiry')
              setToken(null)
              setUser(null)
            }
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
  }, [])

  const login = async (payload: LoginRequest, rememberMe: boolean = false) => {
    const cleanEmail = payload.email.trim().toLowerCase()
    const cleanPassword = payload.password

    try {
      const loginRes = await loginApi({ email: cleanEmail, password: cleanPassword })
      const accessToken = loginRes.accessToken
      if (!accessToken) {
        throw new Error('No access token returned by server.')
      }

      queryClient.clear()
      localStorage.setItem('erjv_access_token', accessToken)
      const profile = await getProfileApi()
      if (!profile?.id || !profile.isActive)
        throw new Error('An active account could not be verified. Please sign in again.')
      setUser(normalizeUser(profile))
      setToken(accessToken)

      const expiryTime = Date.now() + ONE_DAY_MS
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

  const logout = () => {
    queryClient.clear()
    localStorage.removeItem('erjv_access_token')
    localStorage.removeItem('erjv_current_user')
    localStorage.removeItem('erjv_demo_user')
    localStorage.removeItem('erjv_session_expiry')
    setToken(null)
    setUser(null)
  }

  const userRecord = user as unknown as Record<string, unknown> | null
  const userRole = normalizeUserRole(user?.role || userRecord?.userRole || userRecord?.roleName)
  const isAdmin = userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.SUPERADMIN
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
        logout,
        syncUser: (updated) =>
          setUser((current) =>
            current?.id === updated.id ? normalizeUser({ ...current, ...updated }) : current,
          ),
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
