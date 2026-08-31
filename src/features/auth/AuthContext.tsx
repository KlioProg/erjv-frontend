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

type AuthContextType = {
  user: SafeUserResponse | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isOwner: boolean
  isAdmin: boolean
  isStaff: boolean
  canManageStaff: boolean
  canManageOperations: boolean
  login: (payload: LoginRequest, rememberMe?: boolean) => Promise<void>
  register: (payload: RegisterRequest) => Promise<SafeUserResponse>
  updateProfile: (payload: UpdateUserProfilePayload) => Promise<SafeUserResponse>
  logout: () => void
  setDemoUser: (role?: 'OWNER' | 'ADMIN' | 'STAFF') => void
  switchRole: (role: 'OWNER' | 'ADMIN' | 'STAFF') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function normalizeUserRole(rawRole: unknown): 'OWNER' | 'ADMIN' | 'STAFF' {
  if (!rawRole) return 'STAFF'
  const str = String(rawRole).trim().toUpperCase()
  if (str === 'OWNER' || str.includes('OWNER') || str === 'SUPER_ADMIN' || str === 'SUPERADMIN')
    return 'OWNER'
  if (str === 'ADMIN' || str.includes('ADMIN') || str === 'MANAGER' || str === 'OPERATIONS')
    return 'ADMIN'
  return 'STAFF'
}

export function normalizeUser(
  rawUser: (Partial<SafeUserResponse> & Record<string, unknown>) | null | undefined,
): SafeUserResponse {
  if (!rawUser) {
    return {
      id: 1,
      email: '',
      fullName: null,
      phone: null,
      avatarUrl: null,
      jobTitle: 'Staff Member',
      bio: null,
      role: 'STAFF',
      isActive: true,
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
      (resolvedRole === 'OWNER'
        ? 'Enterprise Owner'
        : resolvedRole === 'ADMIN'
          ? 'System Administrator'
          : 'Staff Member'),
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
      // Check 30-day session expiration
      const expiry = localStorage.getItem('erjv_session_expiry')
      if (expiry && Date.now() > Number(expiry)) {
        localStorage.removeItem('erjv_access_token')
        localStorage.removeItem('erjv_current_user')
        localStorage.removeItem('erjv_session_expiry')
        if (isMounted) {
          setToken(null)
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      if (token && token !== 'demo-token') {
        try {
          const profile = await getProfileApi()
          if (isMounted) {
            const normalized = normalizeUser(profile)
            setUser(normalized)
            localStorage.setItem('erjv_current_user', JSON.stringify(normalized))
          }
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { status?: number } }).response?.status
              : undefined

          if (status === 401 || status === 403) {
            // Revoked, expired, or invalid token
            localStorage.removeItem('erjv_access_token')
            localStorage.removeItem('erjv_current_user')
            localStorage.removeItem('erjv_session_expiry')
            if (isMounted) {
              setToken(null)
              setUser(null)
            }
          } else {
            // Network connection error: only restore cached user if valid session existed
            const storedUser = localStorage.getItem('erjv_current_user')
            if (storedUser && isMounted) {
              try {
                setUser(normalizeUser(JSON.parse(storedUser)))
              } catch {
                localStorage.removeItem('erjv_current_user')
                setToken(null)
                setUser(null)
              }
            } else if (isMounted) {
              localStorage.removeItem('erjv_access_token')
              setToken(null)
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
    setIsLoading(true)
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
      localStorage.setItem('erjv_current_user', JSON.stringify(normalized))
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
      localStorage.removeItem('erjv_current_user')
      setToken(null)
      setUser(null)
      throw new Error(getErrorMessage(err), { cause: err })
    } finally {
      setIsLoading(false)
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

    const isOwner = user.role === 'OWNER'
    const newFullName =
      isOwner && payload.fullName !== undefined ? payload.fullName.trim() : user.fullName

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
    localStorage.setItem('erjv_current_user', JSON.stringify(updatedUser))

    return updatedUser
  }

  const logout = () => {
    localStorage.removeItem('erjv_access_token')
    localStorage.removeItem('erjv_current_user')
    localStorage.removeItem('erjv_session_expiry')
    setToken(null)
    setUser(null)
  }

  const setDemoUser = (demoRole: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER') => {
    const demo: SafeUserResponse = {
      id: 1,
      email: `${demoRole.toLowerCase()}@erjvpos.com`,
      fullName:
        demoRole === 'OWNER'
          ? 'Marcus Villaruel'
          : demoRole === 'ADMIN'
            ? 'Sarah Chen-Santos'
            : 'Danilo Reyes',
      jobTitle:
        demoRole === 'OWNER'
          ? 'Enterprise Owner'
          : demoRole === 'ADMIN'
            ? 'System Administrator'
            : 'Staff Member',
      role: demoRole,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('erjv_current_user', JSON.stringify(demo))
    localStorage.setItem('erjv_access_token', 'demo-token')
    setToken('demo-token')
    setUser(demo)
  }

  const switchRole = (newRole: 'OWNER' | 'ADMIN' | 'STAFF') => {
    if (!user) {
      setDemoUser(newRole)
      return
    }
    const updatedUser: SafeUserResponse = {
      ...user,
      role: newRole,
    }
    setUser(updatedUser)
    localStorage.setItem('erjv_current_user', JSON.stringify(updatedUser))
  }

  const userRecord = user as unknown as Record<string, unknown> | null
  const userRole = normalizeUserRole(user?.role || userRecord?.userRole || userRecord?.roleName)
  const isOwner = userRole === 'OWNER'
  const isAdmin = userRole === 'ADMIN'
  const isStaff = userRole === 'STAFF'
  const canManageStaff = isOwner || isAdmin
  const canManageOperations = isOwner || isAdmin

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isOwner,
        isAdmin,
        isStaff,
        canManageStaff,
        canManageOperations,
        login,
        register,
        updateProfile,
        logout,
        setDemoUser,
        switchRole,
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
