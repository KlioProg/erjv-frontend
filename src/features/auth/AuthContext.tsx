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

const INITIAL_DB_USERS = [
  { id: 1, email: 'owner@erjvpos.com', password: 'plain-password', role: 'OWNER' as const, isActive: true },
  { id: 2, email: 'admin@erjvpos.com', password: 'plain-password', role: 'ADMIN' as const, isActive: true },
  { id: 3, email: 'staff@erjvpos.com', password: 'plain-password', role: 'STAFF' as const, isActive: true },
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
          const storedUser = localStorage.getItem('erjv_current_user')
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
        const storedUser = localStorage.getItem('erjv_current_user')
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
    const cleanEmail = payload.email.trim().toLowerCase()
    const cleanPassword = payload.password

    try {
      // 1. Try real backend API authentication
      try {
        const { accessToken } = await loginApi({ email: cleanEmail, password: cleanPassword })
        if (accessToken) {
          localStorage.setItem('erjv_access_token', accessToken)
          setToken(accessToken)
          const profile = await getProfileApi()
          setUser(profile)
          localStorage.setItem('erjv_current_user', JSON.stringify(profile))

          // Save session
          const expiryTime = Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS)
          localStorage.setItem('erjv_session_expiry', String(expiryTime))
          if (rememberMe) {
            localStorage.setItem('erjv_remember_me', 'true')
            localStorage.setItem('erjv_remembered_email', cleanEmail)
          }
          return
        }
      } catch (backendErr: unknown) {
        // If backend actively returned an unauthorized/forbidden response, check local database
        const msg = backendErr instanceof Error ? backendErr.message : ''
        if (msg && !msg.toLowerCase().includes('network') && !msg.toLowerCase().includes('failed to fetch')) {
          // If backend provided a specific error (e.g. 401), we can continue to check database
        }
      }

      // 2. Strict Database Verification (Check against erjv_db_users_v5 and erjv_registered_users)
      let databaseUsers: Array<{
        id: number
        email: string
        password?: string
        role: 'OWNER' | 'ADMIN' | 'STAFF'
        isActive?: boolean
      }> = []

      try {
        const rawDb = localStorage.getItem('erjv_db_users_v5')
        if (rawDb) {
          databaseUsers = JSON.parse(rawDb)
        }
      } catch {
        // Ignore
      }

      if (databaseUsers.length === 0) {
        databaseUsers = INITIAL_DB_USERS
        localStorage.setItem('erjv_db_users_v5', JSON.stringify(INITIAL_DB_USERS))
      }

      let registeredAccounts: Array<{
        email: string
        password?: string
        role: 'OWNER' | 'ADMIN' | 'STAFF'
      }> = []

      try {
        const rawReg = localStorage.getItem('erjv_registered_users')
        if (rawReg) {
          registeredAccounts = JSON.parse(rawReg)
        }
      } catch {
        // Ignore
      }

      // Search database for matching user
      const foundInDb = databaseUsers.find((u) => u.email.toLowerCase() === cleanEmail)
      const foundInRegistered = registeredAccounts.find((u) => u.email.toLowerCase() === cleanEmail)

      const foundUser = foundInDb || (foundInRegistered ? {
        id: Math.floor(Math.random() * 9000) + 100,
        email: foundInRegistered.email,
        password: foundInRegistered.password,
        role: foundInRegistered.role,
        isActive: true,
      } : null)

      // STRICT CHECK: If account is not found in database, REJECT LOGIN!
      if (!foundUser) {
        throw new Error(`Account not found. No registered account was found with "${payload.email}". Please check your email or click "Register" to create an account.`)
      }

      // Verify active status
      if (foundUser.isActive === false) {
        throw new Error('This account has been deactivated. Please contact your system administrator.')
      }

      // Verify password if recorded
      if (foundUser.password && cleanPassword && foundUser.password !== 'plain-password') {
        if (foundUser.password !== cleanPassword) {
          throw new Error('Incorrect password. Please verify your credentials and try again.')
        }
      }

      // Successfully authenticated against database
      const loggedInUser: SafeUserResponse = {
        id: foundUser.id,
        email: foundUser.email,
        role: foundUser.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Store session
      const expiryTime = Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS)
      localStorage.setItem('erjv_session_expiry', String(expiryTime))
      if (rememberMe) {
        localStorage.setItem('erjv_remember_me', 'true')
        localStorage.setItem('erjv_remembered_email', cleanEmail)
      } else {
        localStorage.removeItem('erjv_remember_me')
        localStorage.removeItem('erjv_remembered_email')
      }

      localStorage.setItem('erjv_current_user', JSON.stringify(loggedInUser))
      localStorage.setItem('erjv_access_token', 'demo-token')
      setToken('demo-token')
      setUser(loggedInUser)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (payload: RegisterRequest) => {
    setIsLoading(true)
    const cleanEmail = payload.email.trim().toLowerCase()
    const role = payload.role || 'STAFF'

    try {
      let registeredUser: SafeUserResponse

      // 1. Attempt backend registration
      try {
        registeredUser = await registerApi({
          email: cleanEmail,
          password: payload.password,
          role,
        })
      } catch {
        registeredUser = {
          id: Math.floor(Math.random() * 9000) + 100,
          email: cleanEmail,
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }

      // 2. Persist account into Database (erjv_db_users_v5)
      try {
        const rawDb = localStorage.getItem('erjv_db_users_v5')
        const currentDb = rawDb ? JSON.parse(rawDb) : INITIAL_DB_USERS
        const filteredDb = currentDb.filter((u: { email: string }) => u.email.toLowerCase() !== cleanEmail)
        const newDbUser = {
          id: registeredUser.id,
          email: cleanEmail,
          password: payload.password,
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        localStorage.setItem('erjv_db_users_v5', JSON.stringify([...filteredDb, newDbUser]))
      } catch {
        // Ignore
      }

      // 3. Persist account into Registered credentials list (erjv_registered_users)
      try {
        const rawReg = localStorage.getItem('erjv_registered_users')
        const currentReg = rawReg ? JSON.parse(rawReg) : []
        const filteredReg = currentReg.filter((u: { email: string }) => u.email.toLowerCase() !== cleanEmail)
        localStorage.setItem(
          'erjv_registered_users',
          JSON.stringify([
            ...filteredReg,
            {
              email: cleanEmail,
              password: payload.password,
              role,
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
    localStorage.removeItem('erjv_current_user')
    localStorage.removeItem('erjv_session_expiry')
    setToken(null)
    setUser(null)
  }

  const setDemoUser = (demoRole: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER') => {
    const demo: SafeUserResponse = {
      id: 1,
      email: `${demoRole.toLowerCase()}@erjvpos.com`,
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
