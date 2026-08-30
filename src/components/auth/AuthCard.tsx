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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ErjvPosLogo } from '../ui/ErjvPosLogo'
import ForgotPasswordModal from './ForgotPasswordModal'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import { submitForgotPassword, submitLogin, submitSignup } from './authHandlers'
import type { AuthMode } from '../../features/auth/auth.types'

type AuthCardProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)

    try {
      const msg = await submitLogin(formData)
      setSuccessMessage(msg)
    } catch {
      setErrorMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)

    const password = String(formData.get('password'))
    const confirm = String(formData.get('confirmPassword'))
    if (password !== confirm) {
      setErrorMessage('Passwords do not match.')
      setIsSubmitting(false)
      return
    }

    try {
      const msg = await submitSignup(formData)
      setSuccessMessage(msg)
    } catch {
      setErrorMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPasswordSubmit(email: string) {
    return submitForgotPassword(email)
  }

  const isLogin = mode === 'login'

  return (
    <div className="w-full">
      <Card className="w-full border-border/80 bg-card/95 backdrop-blur-sm shadow-xl ring-1 ring-black/5 sm:rounded-3xl">
        <CardHeader className="items-center pb-3 text-center">
          <ErjvPosLogo className="mb-1" />
          <CardTitle className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {isLogin ? 'Welcome back' : 'Get started today'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {isLogin
              ? 'Sign in to access your register, analytics & inventory'
              : 'Create your enterprise store account in under a minute'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <Tabs
            value={mode}
            onValueChange={(val) => {
              setErrorMessage('')
              setSuccessMessage('')
              onModeChange(val as AuthMode)
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 p-1 bg-secondary/80">
              <TabsTrigger value="login">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 focus-visible:outline-none">
              <LoginForm
                onSubmit={handleLoginSubmit}
                onForgotPasswordClick={() => setIsForgotPasswordOpen(true)}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                successMessage={successMessage}
              />
            </TabsContent>

            <TabsContent value="signup" className="mt-4 focus-visible:outline-none">
              <SignupForm
                onSubmit={handleSignupSubmit}
                isSubmitting={isSubmitting}
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
        onSubmit={handleForgotPasswordSubmit}
      />
    </div>
  )
}
