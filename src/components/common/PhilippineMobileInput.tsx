import { forwardRef, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  mobileNationalNumber,
  normalizePhilippineMobile,
  validatePhilippinePhone,
  MOBILE_FORMAT_ERROR,
  MOBILE_LENGTH_ERROR,
} from '@/lib/phone-utils'

export type PhilippineMobileInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'pattern' | 'maxLength'
> & {
  id: string
  value: string
  onValueChange: (value: string) => void
}

/** Controlled mobile entry. The displayed prefix is never editable or saved by itself. */
export const PhilippineMobileInput = forwardRef<HTMLInputElement, PhilippineMobileInputProps>(
  function PhilippineMobileInput(
    {
      value,
      onValueChange,
      className,
      error: externalError,
      onBlur,
      onInvalid,
      onPaste,
      onKeyDown,
      onBeforeInput,
      ...props
    },
    ref,
  ) {
    const [touched, setTouched] = useState(false)
    const [attemptError, setAttemptError] = useState('')
    const national = mobileNationalNumber(value)
    const error =
      attemptError ||
      (props.required && !value.trim()
        ? 'Mobile number is required.'
        : validatePhilippinePhone(value))
    const visibleError = externalError || (touched ? error : '')
    const prefixId = `${props.id}-prefix`
    const errorId = `${props.id}-mobile-error`
    function reject(message: string) {
      setAttemptError(message)
      setTouched(true)
    }
    function change(next: string) {
      const digits = mobileNationalNumber(next)
      if (!/^\d*$/.test(digits)) return reject(MOBILE_FORMAT_ERROR)
      if (digits.length > 10) return reject(MOBILE_LENGTH_ERROR)
      setAttemptError('')
      onValueChange(digits ? `+63${digits}` : '')
    }
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <div
          data-invalid={!!visibleError || props['aria-invalid'] === true || undefined}
          className="flex min-w-0 items-stretch rounded-md border border-input bg-card focus-within:border-foreground/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[invalid=true]:border-destructive"
        >
          <span
            id={prefixId}
            className="flex shrink-0 items-center border-r border-input px-3 text-sm text-muted-foreground"
          >
            <span className="sr-only">Philippine country code </span>+63
          </span>
          <Input
            {...props}
            ref={(node) => {
              node?.setCustomValidity(error || externalError || '')
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={national}
            placeholder={props.placeholder ?? '9171234567'}
            className={cn('rounded-l-none border-0 focus-visible:border-transparent', className)}
            aria-invalid={visibleError ? true : props['aria-invalid']}
            aria-describedby={[props['aria-describedby'], prefixId, visibleError && errorId]
              .filter(Boolean)
              .join(' ')}
            onChange={(event) => change(event.target.value)}
            onBlur={(event) => {
              setTouched(true)
              onBlur?.(event)
            }}
            onInvalid={(event) => {
              onInvalid?.(event)
              if (event.defaultPrevented) return
              event.preventDefault()
              setTouched(true)
              if (
                !event.currentTarget.form ||
                event.currentTarget.form.querySelector('input:invalid') === event.currentTarget
              )
                event.currentTarget.focus()
            }}
            onPaste={(event) => {
              onPaste?.(event)
              if (event.defaultPrevented || props.disabled || props.readOnly) return
              event.preventDefault()
              const pasted = event.clipboardData.getData('text')
              const canonical = normalizePhilippineMobile(pasted)
              if (!canonical) return reject(validatePhilippinePhone(pasted) || MOBILE_FORMAT_ERROR)
              setAttemptError('')
              onValueChange(canonical)
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event)
              if (
                event.defaultPrevented ||
                props.disabled ||
                props.readOnly ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
              )
                return
              const input = event.currentTarget
              if (!input.value && (event.key === 'Backspace' || event.key === 'Delete'))
                setAttemptError('')
              if (
                /^\d$/.test(event.key) &&
                input.value.length - ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)) >= 10
              ) {
                event.preventDefault()
                reject(MOBILE_LENGTH_ERROR)
              }
            }}
            onBeforeInput={(event) => {
              onBeforeInput?.(event)
              if (event.defaultPrevented || props.disabled || props.readOnly) return
              const data = (event.nativeEvent as InputEvent).data
              const input = event.currentTarget
              if (
                data &&
                input.value.length -
                  ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)) +
                  data.length >
                  10
              ) {
                event.preventDefault()
                reject(MOBILE_LENGTH_ERROR)
              }
            }}
          />
        </div>
        {visibleError && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {visibleError}
          </p>
        )}
      </div>
    )
  },
)
