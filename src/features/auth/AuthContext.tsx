/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/api-client'
import { getProfileApi, loginApi, registerApi, updateProfileApi } from './auth.api'
import type { LoginRequest, RegisterRequest, SafeUserResponse, UpdateUserProfilePayload } from './auth.types'

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

const INITIAL_DB_USERS: Array<{
  id: number
  email: string
  fullName: string | null
  phone: string | null
  jobTitle: string | null
  bio: string | null
  avatarUrl: string | null
  password?: string
  role: 'OWNER' | 'ADMIN' | 'STAFF'
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}> = []

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
      } catch {
        // Continue to check database fallback
      }

      // 2. Strict Database Verification (Check against erjv_db_users_v6 and erjv_registered_users)
      let databaseUsers: Array<{
        id: number
        email: string
        fullName?: string | null
        phone?: string | null
        avatarUrl?: string | null
        jobTitle?: string | null
        bio?: string | null
        password?: string
        role: 'OWNER' | 'ADMIN' | 'STAFF'
        isActive?: boolean
      }> = []

      try {
        const rawDb = localStorage.getItem('erjv_db_users_v6')
        if (rawDb) {
          databaseUsers = JSON.parse(rawDb)
        }
      } catch {
        // Ignore
      }

      if (databaseUsers.length === 0) {
        databaseUsers = INITIAL_DB_USERS
        localStorage.setItem('erjv_db_users_v6', JSON.stringify(INITIAL_DB_USERS))
      }

      let registeredAccounts: Array<{
        email: string
        fullName?: string
        phone?: string
        avatarUrl?: string
        jobTitle?: string
        bio?: string
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
        fullName: foundInRegistered.fullName || null,
        phone: foundInRegistered.phone || null,
        avatarUrl: foundInRegistered.avatarUrl || null,
        jobTitle: foundInRegistered.jobTitle || null,
        bio: foundInRegistered.bio || null,
        password: foundInRegistered.password,
        role: foundInRegistered.role,
        isActive: true,
      } : null)

      // STRICT CHECK: If account is not found in database, REJECT LOGIN!
      if (!foundUser) {
        throw new Error('Account not found.')
      }

      // Verify active status
      if (foundUser.isActive === false) {
        throw new Error('Account is deactivated.')
      }

      // Verify password if recorded
      if (foundUser.password && cleanPassword && foundUser.password !== 'plain-password') {
        if (foundUser.password !== cleanPassword) {
          throw new Error('Incorrect password.')
        }
      }

      // Format clean display name
      const displayName = foundUser.fullName || cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

      // Successfully authenticated against database
      const loggedInUser: SafeUserResponse = {
        id: foundUser.id,
        email: foundUser.email,
        fullName: displayName,
        phone: foundUser.phone || null,
        avatarUrl: foundUser.avatarUrl || null,
        jobTitle: foundUser.jobTitle || (foundUser.role === 'OWNER' ? 'Enterprise Owner' : foundUser.role === 'ADMIN' ? 'System Administrator' : 'Staff Member'),
        bio: foundUser.bio || null,
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
    const fullName = payload.fullName?.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

    // 0. Strict Primary-Key-Style Uniqueness Validation (Email & Full Name)
    const normalizedEmail = cleanEmail.toLowerCase()
    const normalizedName = fullName.toLowerCase().trim()

    const existingEmails = new Set<string>()
    const existingNames = new Set<string>()

    // Seed defaults
    INITIAL_DB_USERS.forEach((u) => {
      existingEmails.add(u.email.toLowerCase())
      if (u.fullName) existingNames.add(u.fullName.toLowerCase().trim())
    })

    // Local DB users
    try {
      const rawDb = localStorage.getItem('erjv_db_users_v6')
      if (rawDb) {
        const dbUsers = JSON.parse(rawDb)
        dbUsers.forEach((u: { email?: string; fullName?: string }) => {
          if (u.email) existingEmails.add(u.email.toLowerCase())
          if (u.fullName) existingNames.add(u.fullName.toLowerCase().trim())
        })
      }
    } catch {
      // Ignore
    }

    // Registered users
    try {
      const rawReg = localStorage.getItem('erjv_registered_users')
      if (rawReg) {
        const regUsers = JSON.parse(rawReg)
        regUsers.forEach((u: { email?: string; fullName?: string }) => {
          if (u.email) existingEmails.add(u.email.toLowerCase())
          if (u.fullName) existingNames.add(u.fullName.toLowerCase().trim())
        })
      }
    } catch {
      // Ignore
    }

    // Employees directory
    try {
      const rawEmps = localStorage.getItem('erjv_db_employees_v6')
      if (rawEmps) {
        const emps = JSON.parse(rawEmps)
        emps.forEach((e: { email?: string; firstName?: string; lastName?: string }) => {
          if (e.email) existingEmails.add(e.email.toLowerCase())
          if (e.firstName && e.lastName) {
            existingNames.add(`${e.firstName} ${e.lastName}`.toLowerCase().trim())
          }
        })
      }
    } catch {
      // Ignore
    }

    if (existingEmails.has(normalizedEmail)) {
      setIsLoading(false)
      throw new Error('Email is already registered.')
    }

    if (existingNames.has(normalizedName)) {
      setIsLoading(false)
      throw new Error('Name is already taken.')
    }

    try {
      let registeredUser: SafeUserResponse

      // 1. Attempt backend registration
      try {
        registeredUser = await registerApi({
          fullName,
          email: cleanEmail,
          password: payload.password,
          role,
        })
      } catch (err: unknown) {
        setIsLoading(false)
        const errMsg = getErrorMessage(err)
        if (
          errMsg &&
          (errMsg.toLowerCase().includes('already') ||
            errMsg.toLowerCase().includes('duplicate') ||
            errMsg.toLowerCase().includes('exist'))
        ) {
          throw new Error(errMsg.toLowerCase().includes('email') ? 'Email is already registered.' : errMsg, { cause: err })
        }
        throw new Error("Can't reach database. Please try again.", { cause: err })
      }

      // 2. Persist account into Database (erjv_db_users_v6)
      try {
        const rawDb = localStorage.getItem('erjv_db_users_v6')
        const currentDb = rawDb ? JSON.parse(rawDb) : INITIAL_DB_USERS
        const filteredDb = currentDb.filter((u: { email: string }) => u.email.toLowerCase() !== cleanEmail)
        const newDbUser = {
          id: registeredUser.id,
          email: cleanEmail,
          fullName,
          phone: payload.phone || null,
          avatarUrl: payload.avatarUrl || null,
          jobTitle: payload.jobTitle || 'Staff Member',
          bio: payload.bio || null,
          password: payload.password,
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        localStorage.setItem('erjv_db_users_v6', JSON.stringify([...filteredDb, newDbUser]))
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
              fullName,
              phone: payload.phone || null,
              avatarUrl: payload.avatarUrl || null,
              jobTitle: payload.jobTitle || 'Staff Member',
              bio: payload.bio || null,
              password: payload.password,
              role,
            },
          ])
        )
      } catch {
        // Ignore
      }

      // 4. Automatically add to Staff Directory (erjv_db_employees_v6)
      try {
        const rawEmps = localStorage.getItem('erjv_db_employees_v6')
        const currentEmps = rawEmps ? JSON.parse(rawEmps) : []
        const nameParts = fullName.trim().split(' ')
        const firstName = nameParts[0] || 'Staff'
        const lastName = nameParts.slice(1).join(' ') || 'Member'

        const existingIdx = currentEmps.findIndex(
          (e: { email?: string; userId?: number }) =>
            (e.email && e.email.toLowerCase() === cleanEmail) || e.userId === registeredUser.id
        )

        const newEmp = {
          id: registeredUser.id,
          firstName,
          lastName,
          email: cleanEmail,
          phone: payload.phone || null,
          address: null,
          hireDate: new Date().toISOString().split('T')[0],
          isActive: true,
          userId: registeredUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        if (existingIdx !== -1) {
          currentEmps[existingIdx] = { ...currentEmps[existingIdx], ...newEmp }
        } else {
          currentEmps.push(newEmp)
        }

        localStorage.setItem('erjv_db_employees_v6', JSON.stringify(currentEmps))
      } catch {
        // Ignore
      }

      return registeredUser
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (payload: UpdateUserProfilePayload): Promise<SafeUserResponse> => {
    if (!user) {
      throw new Error('No user is currently logged in.')
    }

    const isOwner = user.role === 'OWNER'
    const newFullName = (isOwner && payload.fullName !== undefined) ? payload.fullName.trim() : user.fullName

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

    // 1. Try updating via Backend API
    try {
      await updateProfileApi({
        fullName: updatedUser.fullName || undefined,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        jobTitle: updatedUser.jobTitle,
        bio: updatedUser.bio,
      })
    } catch {
      // Graceful fallback to local persistence
    }

    // 2. Update in erjv_db_users_v6
    try {
      const rawDb = localStorage.getItem('erjv_db_users_v6')
      if (rawDb) {
        const currentDb = JSON.parse(rawDb)
        const idx = currentDb.findIndex((u: { email: string }) => u.email.toLowerCase() === user.email.toLowerCase())
        if (idx !== -1) {
          currentDb[idx] = {
            ...currentDb[idx],
            fullName: updatedUser.fullName,
            phone: updatedUser.phone,
            avatarUrl: updatedUser.avatarUrl,
            jobTitle: updatedUser.jobTitle,
            bio: updatedUser.bio,
          }
          localStorage.setItem('erjv_db_users_v6', JSON.stringify(currentDb))
        }
      }
    } catch {
      // Ignore
    }

    // 3. Update in erjv_registered_users
    try {
      const rawReg = localStorage.getItem('erjv_registered_users')
      if (rawReg) {
        const currentReg = JSON.parse(rawReg)
        const idx = currentReg.findIndex((u: { email: string }) => u.email.toLowerCase() === user.email.toLowerCase())
        if (idx !== -1) {
          currentReg[idx] = {
            ...currentReg[idx],
            fullName: updatedUser.fullName,
            phone: updatedUser.phone,
            avatarUrl: updatedUser.avatarUrl,
            jobTitle: updatedUser.jobTitle,
            bio: updatedUser.bio,
          }
          localStorage.setItem('erjv_registered_users', JSON.stringify(currentReg))
        }
      }
    } catch {
      // Ignore
    }

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
      fullName: demoRole === 'OWNER' ? 'Marcus Villaruel' : demoRole === 'ADMIN' ? 'Sarah Chen-Santos' : 'Danilo Reyes',
      jobTitle: demoRole === 'OWNER' ? 'Enterprise Owner' : demoRole === 'ADMIN' ? 'System Administrator' : 'Staff Member',
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
