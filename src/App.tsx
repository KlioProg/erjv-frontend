import { useState } from 'react'
import { AuthCard } from './components/auth/AuthCard'
import { Toaster } from './components/ui/sonner'
import type { AuthMode } from './features/auth/auth.types'

function App() {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-8 antialiased selection:bg-primary/20">
      {/* Dynamic Background subtle ambient radial glow */}
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

      <Toaster position="top-right" richColors />
    </main>
  )
}

export default App
