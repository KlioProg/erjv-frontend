import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ErjvPosLogo } from '../ui/ErjvPosLogo'
import ForgotPasswordModal from './ForgotPasswordModal'
import LoginForm from './LoginForm'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/api-client'
import type { AuthMode } from '../../features/auth/auth.types'

type AuthCardProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email')).trim()
    const password = String(formData.get('password'))
    const rememberMe = formData.get('rememberMe') === 'on' || formData.get('rememberMe') === 'true'

    try {
      await login({ email, password }, rememberMe)
      setIsSuccess(true)
      setSuccessMessage('Welcome back! Redirecting...')
      await new Promise((resolve) => setTimeout(resolve, 400))
    } catch (err) {
      const message = getErrorMessage(err)
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <Card
        className={`w-full border-border/80 bg-card/95 backdrop-blur-sm shadow-xl ring-1 ring-black/5 sm:rounded-3xl transition-all duration-300 ${
          isSuccess ? 'scale-[0.98] opacity-90' : ''
        }`}
      >
        <CardHeader className="items-center pb-4 text-center">
          <ErjvPosLogo className="mt-5 mb-1" />
          <CardTitle className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sign in to access your register, analytics & inventory
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-10 px-10 pb-10">
          <Tabs
            value={mode}
            onValueChange={(val) => {
              setErrorMessage('')
              setSuccessMessage('')
              onModeChange(val as AuthMode)
            }}
            className="w-full"
          >

            <TabsContent
              value="login"
              className="mt-4 focus-visible:outline-none animate-auth-roll-down"
            >
              <LoginForm
                onSubmit={handleLoginSubmit}
                onForgotPasswordClick={() => setIsForgotPasswordOpen(true)}
                isSubmitting={isSubmitting}
                isSuccess={isSuccess}
                errorMessage={errorMessage}
                successMessage={successMessage}
              />
            </TabsContent>
          </Tabs>
        </CardContent>

        <Separator />

        <CardFooter className="flex items-center justify-center gap-1.5 py-4 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-muted-foreground/70" />
          <span>Encrypted 256-bit SSL connection</span>
        </CardFooter>
      </Card>

      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccessReset={(email) => {
          setSuccessMessage(`Password updated for ${email}. Please log in with your new password.`)
          onModeChange('login')
        }}
      />
    </div>
  )
}
