import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PhilippineMobileInput } from './PhilippineMobileInput'
import { isMobileContact, normalizePhilippineMobile, validateContactPhone } from '@/lib/phone-utils'

type Props = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'pattern' | 'ref'
> & {
  id: string
  value: string
  onValueChange: (value: string) => void
}

/** General telephone contact: mobile entry is owned by PhilippineMobileInput. */
export function PhoneInput({ value, onValueChange, ...props }: Props) {
  const [mode, setMode] = useState<{ value: string; other: boolean } | null>(null)
  const [touched, setTouched] = useState(false)
  const [initialValue] = useState(value)
  const other = mode?.value === value ? mode.other : !!value && !isMobileContact(value)
  const error =
    props.required && !value.trim() ? 'Phone number is required.' : validateContactPhone(value)
  const description = [props['aria-describedby'], `${props.id}-format`].filter(Boolean).join(' ')
  function change(next: string, asOther: boolean) {
    setMode({ value: next, other: asOther })
    onValueChange(next)
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {other ? (
        <Input
          {...props}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          placeholder="Area or country code and number"
          aria-describedby={description}
          error={props.error || (touched ? error || undefined : undefined)}
          ref={(node) => node?.setCustomValidity(error || props.error || '')}
          onBlur={(event) => {
            setTouched(true)
            props.onBlur?.(event)
          }}
          onChange={(event) => change(event.target.value, true)}
          onPaste={(event) => {
            props.onPaste?.(event)
            if (event.defaultPrevented || props.disabled || props.readOnly) return
            const mobile = normalizePhilippineMobile(event.clipboardData.getData('text'))
            if (mobile) {
              event.preventDefault()
              change(mobile, false)
            }
          }}
        />
      ) : (
        <PhilippineMobileInput
          {...props}
          value={value}
          aria-describedby={description}
          onValueChange={(next) => change(next, false)}
          onPaste={(event) => {
            props.onPaste?.(event)
            if (event.defaultPrevented || props.disabled || props.readOnly) return
            const pasted = event.clipboardData.getData('text').trim()
            if (pasted && !isMobileContact(pasted) && !validateContactPhone(pasted)) {
              event.preventDefault()
              change(pasted, true)
            }
          }}
        />
      )}
      <p id={`${props.id}-format`} className="text-xs text-muted-foreground">
        {!!value && value === initialValue && error
          ? 'This saved contact could not be verified. Review it before saving.'
          : `${!props.required ? 'Optional. ' : ''}${other ? 'Include the area or country code.' : '10 mobile digits after +63.'}`}
      </p>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto self-start p-0 text-xs"
        disabled={props.disabled || props.readOnly}
        onClick={() => {
          setMode({ value, other: !other })
          setTouched(false)
        }}
      >
        {other ? 'Use Philippine mobile' : 'Use landline / other number'}
      </Button>
    </div>
  )
}
