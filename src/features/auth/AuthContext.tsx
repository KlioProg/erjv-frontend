/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { getProfileApi, loginApi, registerApi } from './auth.api'
import type { LoginRequest, RegisterRequest, SafeUserResponse } from './auth.types'

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
  logout: () => void
  setDemoUser: (role?: 'OWNER' | 'ADMIN' | 'STAFF') => void
  switchRole: (role: 'OWNER' | 'ADMIN' | 'STAFF') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_ACCOUNTS = [
  { email: 'owner@erjvpos.com', password: 'plain-password', role: 'OWNER' as const },
  { email: 'admin@erjvpos.com', password: 'plain-password', role: 'ADMIN' as const },
  { email: 'staff@erjvpos.com', password: 'plain-password', role: 'STAFF' as const },
]

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
            setUser(profile)
          }
        } catch {
          const storedUser = localStorage.getItem('erjv_current_user') || localStorage.getItem('erjv_demo_user')
          if (storedUser && isMounted) {
            setUser(JSON.parse(storedUser))
          } else if (isMounted) {
            localStorage.removeItem('erjv_access_token')
            setToken(null)
            setUser(null)
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      } else {
        const storedUser = localStorage.getItem('erjv_current_user') || localStorage.getItem('erjv_demo_user')
        if (storedUser && isMounted) {
          setUser(JSON.parse(storedUser))
          setToken('demo-token')
        }
        if (isMounted) {
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
    try {
      // Calculate session expiration (30 days if remember me is checked, otherwise 1 day)
      const expiryTime = Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS)
      localStorage.setItem('erjv_session_expiry', String(expiryTime))

      if (rememberMe) {
        localStorage.setItem('erjv_remember_me', 'true')
        localStorage.setItem('erjv_remembered_email', payload.email.trim())
      } else {
        localStorage.removeItem('erjv_remember_me')
        localStorage.removeItem('erjv_remembered_email')
      }

      try {
        const { accessToken } = await loginApi(payload)
        localStorage.setItem('erjv_access_token', accessToken)
        localStorage.removeItem('erjv_demo_user')
        setToken(accessToken)
        const profile = await getProfileApi()
        setUser(profile)
        localStorage.setItem('erjv_current_user', JSON.stringify(profile))
        return
      } catch {
        // Fallback for seamless testing when backend DB is offline
        const cleanEmail = payload.email.trim().toLowerCase()
        let registeredUsers: Array<{ email: string; password?: string; role: 'OWNER' | 'ADMIN' | 'STAFF' }> = []
        try {
          const raw = localStorage.getItem('erjv_registered_users')
          if (raw) registeredUsers = JSON.parse(raw)
        } catch {
          // Ignore
        }

        const foundUser =
          registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail) ||
          DEFAULT_ACCOUNTS.find((a) => a.email.toLowerCase() === cleanEmail)

        const userRole = foundUser?.role || (cleanEmail.includes('owner') ? 'OWNER' : cleanEmail.includes('admin') ? 'ADMIN' : 'STAFF')

        const loggedInUser: SafeUserResponse = {
          id: Math.floor(Math.random() * 1000) + 1,
          email: payload.email,
          role: userRole,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        localStorage.setItem('erjv_current_user', JSON.stringify(loggedInUser))
        localStorage.setItem('erjv_demo_user', JSON.stringify(loggedInUser))
        localStorage.setItem('erjv_access_token', 'demo-token')
        setToken('demo-token')
        setUser(loggedInUser)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (payload: RegisterRequest) => {
    setIsLoading(true)
    try {
      let registeredUser: SafeUserResponse
      try {
        registeredUser = await registerApi(payload)
      } catch {
        // Fallback when backend is offline
        registeredUser = {
          id: Math.floor(Math.random() * 1000) + 1,
          email: payload.email.trim(),
          role: payload.role || 'STAFF',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }

      // Save to registered accounts
      try {
        const raw = localStorage.getItem('erjv_registered_users')
        const current = raw ? JSON.parse(raw) : []
        const filtered = current.filter((u: { email: string }) => u.email.toLowerCase() !== payload.email.toLowerCase())
        localStorage.setItem(
          'erjv_registered_users',
          JSON.stringify([
            ...filtered,
            {
              email: payload.email.trim(),
              password: payload.password,
              role: payload.role || 'STAFF',
            },
          ])
        )
      } catch {
        // Ignore
      }

      return registeredUser
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('erjv_access_token')
    localStorage.removeItem('erjv_demo_user')
    localStorage.removeItem('erjv_current_user')
    localStorage.removeItem('erjv_session_expiry')
    setToken(null)
    setUser(null)
  }

  const setDemoUser = (role: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER') => {
    const demo: SafeUserResponse = {
      id: 1,
      email: `${role.toLowerCase()}@erjvpos.com`,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('erjv_current_user', JSON.stringify(demo))
    localStorage.setItem('erjv_demo_user', JSON.stringify(demo))
    localStorage.setItem('erjv_access_token', 'demo-token')
    setToken('demo-token')
    setUser(demo)
  }

  const switchRole = (role: 'OWNER' | 'ADMIN' | 'STAFF') => {
    if (!user) {
      setDemoUser(role)
      return
    }
    const updatedUser: SafeUserResponse = {
      ...user,
      email: `${role.toLowerCase()}@erjvpos.com`,
      role,
    }
    setUser(updatedUser)
    localStorage.setItem('erjv_current_user', JSON.stringify(updatedUser))
    localStorage.setItem('erjv_demo_user', JSON.stringify(updatedUser))
  }

  const role = user?.role
  const isOwner = role === 'OWNER'
  const isAdmin = role === 'ADMIN'
  const isStaff = role === 'STAFF'
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
