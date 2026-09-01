import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthCard } from './components/auth/AuthCard'
import { MainDashboard } from './components/dashboard/MainDashboard'
import { Toaster } from './components/ui/sonner'
import { Spinner } from './components/ui/spinner'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import type { AuthMode } from './features/auth/auth.types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true, // Instantly sync when switching from Prisma Studio or another tab
      refetchOnMount: 'always', // Always check latest database state when a screen or modal opens
      refetchOnReconnect: true,
      staleTime: 0, // Zero stale time for instant real-time synchronization
    },
  },
})

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="animate-in fade-in-0 duration-300 min-h-svh">
        <MainDashboard />
      </div>
    )
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-8 antialiased selection:bg-primary/20 bg-background">
      {/* Subtle ambient radial glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[650px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 -z-10 size-[500px] rounded-full bg-accent/60 blur-3xl"
        aria-hidden="true"
      />

      <div className="w-full max-w-[440px] animate-in fade-in-50 zoom-in-95 duration-300">
        <AuthCard mode={mode} onModeChange={setMode} />
      </div>
    </main>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
