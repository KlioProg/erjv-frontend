import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { error?: string }
>(({ className, type, error: fieldError, ...props }, ref) => {
  const errorId = React.useId()
  const constraints = JSON.stringify([
    type,
    props.required,
    props.pattern,
    props.min,
    props.max,
    props.step,
    props.minLength,
    props.maxLength,
    props.readOnly,
    props.disabled,
  ])
  const [validation, setValidation] = React.useState({
    message: '',
    value: props.value,
    constraints,
  })
  const error =
    fieldError ||
    (validation.value === props.value && validation.constraints === constraints
      ? validation.message
      : '')
  return (
    <>
      <input
        type={type}
        className={cn(
          'ui-text flex h-10 pointer-coarse:min-h-11 min-w-0 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          className,
        )}
        ref={ref}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={
          [props['aria-describedby'], error && errorId].filter(Boolean).join(' ') || undefined
        }
        onInvalid={(event) => {
          props.onInvalid?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          const input = event.currentTarget
          const label = (
            input.labels?.[0]?.textContent ||
            input.getAttribute('aria-label') ||
            'This field'
          )
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim()
          if (!props['aria-invalid']) {
            const message = input.validity.customError
              ? input.validationMessage
              : input.validity.valueMissing
                ? `${label} is required.`
                : input.type === 'email'
                  ? 'Enter a valid email address.'
                  : input.title ||
                    (input.validity.patternMismatch
                      ? `Enter a valid ${label.toLowerCase()}.`
                      : input.validationMessage)
            setValidation({ message, value: props.value, constraints })
          }
          if (
            !input.form ||
            input.form.querySelector('input:invalid, select:invalid, textarea:invalid') === input
          )
            input.focus()
        }}
        onChange={(event) => {
          if (validation.message) setValidation({ message: '', value: props.value, constraints })
          props.onChange?.(event)
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  )
})
Input.displayName = 'Input'

export { Input }
