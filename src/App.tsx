import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sparkles, ArrowRight } from 'lucide-react'
import { AuthCard } from './components/auth/AuthCard'
import { StaffingDashboard } from './components/staffing/StaffingDashboard'
import { Toaster } from './components/ui/sonner'
import { Button } from './components/ui/button'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import type { AuthMode } from './features/auth/auth.types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
})

function AppContent() {
  const { isAuthenticated, setDemoUser } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')

  if (isAuthenticated) {
    return <StaffingDashboard />
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

        {/* Demo Fast Track Banner */}
        <div className="mt-4 flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDemoUser('OWNER')}
            className="text-xs text-muted-foreground hover:text-foreground border-dashed bg-card/60 backdrop-blur-xs gap-1.5 shadow-xs"
          >
            <Sparkles className="size-3 text-primary" />
            Quick Demo: Enter Staffing & POS Dashboard
            <ArrowRight className="size-3" />
          </Button>
        </div>
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
