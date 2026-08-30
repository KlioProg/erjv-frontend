/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { getProfileApi, loginApi, registerApi } from './auth.api'
import type { LoginRequest, RegisterRequest, SafeUserResponse } from './auth.types'

type AuthContextType = {
  user: SafeUserResponse | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<SafeUserResponse>
  logout: () => void
  setDemoUser: (role?: 'OWNER' | 'ADMIN' | 'STAFF') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erjv_access_token'))
  const [user, setUser] = useState<SafeUserResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (token && token !== 'demo-token') {
        try {
          const profile = await getProfileApi()
          if (isMounted) {
            setUser(profile)
          }
        } catch {
          const demoStored = localStorage.getItem('erjv_demo_user')
          if (demoStored && isMounted) {
            setUser(JSON.parse(demoStored))
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
        const demoStored = localStorage.getItem('erjv_demo_user')
        if (demoStored && isMounted) {
          setUser(JSON.parse(demoStored))
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

  const login = async (payload: LoginRequest) => {
    setIsLoading(true)
    try {
      const { accessToken } = await loginApi(payload)
      localStorage.setItem('erjv_access_token', accessToken)
      localStorage.removeItem('erjv_demo_user')
      setToken(accessToken)
      const profile = await getProfileApi()
      setUser(profile)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (payload: RegisterRequest) => {
    setIsLoading(true)
    try {
      const safeUser = await registerApi(payload)
      return safeUser
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('erjv_access_token')
    localStorage.removeItem('erjv_demo_user')
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
    localStorage.setItem('erjv_demo_user', JSON.stringify(demo))
    localStorage.setItem('erjv_access_token', 'demo-token')
    setToken('demo-token')
    setUser(demo)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setDemoUser,
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
