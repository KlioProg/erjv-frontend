import { useState } from 'react'
import { AuthCard } from './components/auth/AuthCard'
import type { AuthMode } from './features/auth/auth.types'

function App() {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f4f7fb] px-4 py-10 text-ink">
      <div className="w-full max-w-[390px]">
        <AuthCard mode={mode} onModeChange={setMode} />
      </div>
    </main>
  )
}

export default App
