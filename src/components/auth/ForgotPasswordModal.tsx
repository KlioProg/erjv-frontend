import { useState, useRef, useEffect, type FormEvent } from 'react'
import {
  Mail,
  Send,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  onSuccessReset?: (email: string) => void
}

type ResetStep = 'ENTER_EMAIL' | 'ENTER_CODE' | 'SET_PASSWORD' | 'COMPLETED'

export default function ForgotPasswordModal({
  open,
  onClose,
  onSuccessReset,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ResetStep>('ENTER_EMAIL')
  const [email, setEmail] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [enteredOtp, setEnteredOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [copiedOtp, setCopiedOtp] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([])
  const emailInputRef = useRef<HTMLInputElement | null>(null)

  // Resend timer cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState()
      onClose()
    }
  }

  const resetState = () => {
    setStep('ENTER_EMAIL')
    setEmail('')
    setGeneratedOtp('')
    setEnteredOtp(['', '', '', '', '', ''])
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage('')
    setIsSubmitting(false)
    setCopiedOtp(false)
    setResendCooldown(0)
  }

  // Generate 6-digit random OTP
  const createNewOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(code)
    setResendCooldown(45)
    return code
  }

  // Step 1: Send Verification Code to Email
  async function handleSendEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage('')

    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage('Please enter a valid work email address.')
      emailInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    // Simulate network dispatch with guaranteed OTP generation
    setTimeout(() => {
      createNewOtp()
      setIsSubmitting(false)
      setStep('ENTER_CODE')
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100)
    }, 800)
  }

  // Step 2: Handle OTP input and verification
  const handleOtpChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...enteredOtp]
    newOtp[index] = val
    setEnteredOtp(newOtp)
    setErrorMessage('')

    if (val && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !enteredOtp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  const handlePasteOtp = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      const newOtp = [...enteredOtp]
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i]
      }
      setEnteredOtp(newOtp)
      const nextFocus = Math.min(pasted.length, 5)
      otpInputsRef.current[nextFocus]?.focus()
    }
  }

  const handleVerifyOtp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')

    const fullCode = enteredOtp.join('')
    if (fullCode.length < 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.')
      return
    }

    if (fullCode !== generatedOtp) {
      setErrorMessage('Invalid verification code. Please check your simulated email inbox.')
      return
    }

    setStep('SET_PASSWORD')
  }

  const handleResendOtp = () => {
    if (resendCooldown > 0) return
    createNewOtp()
    setEnteredOtp(['', '', '', '', '', ''])
    setErrorMessage('')
    setCopiedOtp(false)
    setTimeout(() => otpInputsRef.current[0]?.focus(), 50)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedOtp)
    setCopiedOtp(true)
    setTimeout(() => setCopiedOtp(false), 2000)
  }

  // Step 3: Save New Password
  const handleSavePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setStep('COMPLETED')
      if (onSuccessReset) {
        onSuccessReset(email)
      }
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 overflow-hidden">
        {/* Step Header */}
        <DialogHeader className="gap-2 text-left">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
            {step === 'COMPLETED' ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : step === 'SET_PASSWORD' ? (
              <Lock className="size-6 text-primary" />
            ) : step === 'ENTER_CODE' ? (
              <ShieldCheck className="size-6 text-primary" />
            ) : (
              <KeyRound className="size-6 text-primary" />
            )}
          </div>

          <div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              {step === 'ENTER_EMAIL' && 'Reset Your Password'}
              {step === 'ENTER_CODE' && 'Verify 6-Digit OTP Code'}
              {step === 'SET_PASSWORD' && 'Create New Password'}
              {step === 'COMPLETED' && 'Password Reset Complete!'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {step === 'ENTER_EMAIL' &&
                'Enter your registered email address and we will send you a 6-digit one-time verification code.'}
              {step === 'ENTER_CODE' &&
                `We've sent a 6-digit verification code to ${email}. Enter the code below to proceed.`}
              {step === 'SET_PASSWORD' &&
                'Verification successful! Choose a strong password for your account.'}
              {step === 'COMPLETED' &&
                'Your password has been successfully updated. You can now log in with your new credentials.'}
            </DialogDescription>
          </div>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2.5 text-xs">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* STEP 1: Enter Email */}
        {step === 'ENTER_EMAIL' && (
          <form className="mt-2 flex flex-col gap-4" onSubmit={handleSendEmail} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reset-email" className="text-xs font-semibold text-foreground">
                Account Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={emailInputRef}
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. staff@erjvpos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs font-bold gap-1.5 shadow-xs">
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit OTP */}
        {step === 'ENTER_CODE' && (
          <form className="mt-1 flex flex-col gap-4" onSubmit={handleVerifyOtp}>
            {/* Simulated Email Delivery Banner */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary flex items-center gap-1.5 text-[11px]">
                  <Mail className="size-3.5" /> Simulated Email Dispatched
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  {copiedOtp ? (
                    <>
                      <Check className="size-3 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">Verification Code:</span>
                <span className="font-mono text-base font-extrabold tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {generatedOtp}
                </span>
              </div>
            </div>

            {/* 6-box OTP Input */}
            <div className="flex flex-col items-center gap-2 py-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1">
                Enter the 6-digit code
              </Label>
              <div className="flex items-center gap-2 justify-center" onPaste={handlePasteOtp}>
                {enteredOtp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="size-11 text-center font-mono text-lg font-bold rounded-xl border border-border bg-card shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Resend Action */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep('ENTER_EMAIL')}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium cursor-pointer"
              >
                <ArrowLeft className="size-3" /> Change email
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-primary hover:underline font-semibold flex items-center gap-1 disabled:text-muted-foreground disabled:no-underline cursor-pointer"
              >
                <RefreshCw className="size-3" />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold gap-1.5 shadow-xs">
                <ShieldCheck className="size-3.5" />
                Verify & Continue
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Set New Password */}
        {step === 'SET_PASSWORD' && (
          <form className="mt-1 flex flex-col gap-3.5" onSubmit={handleSavePassword}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pass" className="text-xs font-semibold text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="new-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-9 text-xs"
                  disabled={isSubmitting}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-pass" className="text-xs font-semibold text-foreground">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirm-pass"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-9 text-xs"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs font-bold gap-1.5 shadow-xs">
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Save & Update Password
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: Success / Completed */}
        {step === 'COMPLETED' && (
          <div className="mt-2 flex flex-col items-center text-center gap-4 py-2">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm animate-in zoom-in-50 duration-200">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-bold text-foreground">Password Successfully Updated</h4>
              <p className="text-xs text-muted-foreground">
                Your account password for <span className="font-semibold text-foreground">{email}</span> has been securely updated.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full text-xs font-bold shadow-xs mt-2"
            >
              Sign In to Your Account
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}