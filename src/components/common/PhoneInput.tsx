import { useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { mobileNationalNumber, validateContactPhone } from '@/lib/phone-utils'

type Props = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'pattern' | 'ref'
> & {
  id: string
  value: string
  onValueChange: (value: string) => void
}

export function PhoneInput({ value, onValueChange, ...props }: Props) {
  const [other, setOther] = useState(
    () => !!value && !/^(?:0?9|\+?639)/.test(value.replace(/[\s().-]/g, '')),
  )
  const national = mobileNationalNumber(value)
  const error = props.required && !value.trim()
    ? 'Phone number is required.'
    : other
      ? validateContactPhone(value)
      : national && !/^9\d{9}$/.test(national)
        ? 'Enter 10 mobile digits starting with 9.'
        : null
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-start gap-2">
        {!other && (
          <span
            aria-hidden="true"
            className="flex h-10 shrink-0 items-center text-sm pointer-coarse:min-h-11"
          >
            +63
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Input
            {...props}
            type="tel"
            inputMode="tel"
            autoComplete={other ? 'tel' : 'tel-national'}
            value={other ? value : national}
            placeholder={other ? 'Area or country code and number' : '9171234567'}
            pattern={other ? undefined : '9[0-9]{9}'}
            title={
              other ? 'Enter a valid phone number.' : 'Enter 10 mobile digits starting with 9.'
            }
            aria-describedby={[props['aria-describedby'], `${props.id}-format`]
              .filter(Boolean)
              .join(' ')}
            ref={(node) => node?.setCustomValidity(error || '')}
            onChange={(event) => {
              const next = event.target.value
              const compact = next.replace(/[\s().-]/g, '')
              if (other || /^\+(?!639)|^0[1-8]/.test(compact)) {
                setOther(true)
                onValueChange(next)
              } else {
                const digits = mobileNationalNumber(next)
                onValueChange(digits ? `0${digits}` : '')
              }
            }}
          />
        </div>
      </div>
      <p id={`${props.id}-format`} className="text-xs text-muted-foreground">
        {!props.required && 'Optional. '}
        {other
          ? 'Include the area or country code.'
          : 'Philippine mobile: +63 followed by 10 digits starting with 9.'}
      </p>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto self-start p-0 text-xs"
        disabled={props.disabled || props.readOnly}
        onClick={() => setOther(!other)}
      >
        {other ? 'Use Philippine mobile' : 'Use landline / other number'}
      </Button>
    </div>
  )
}
