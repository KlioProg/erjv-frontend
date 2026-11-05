import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { manilaScheduleToIso } from '@/lib/manila-schedule'

/** Controlled minute-precision wall time (YYYY-MM-DDTHH:mm), including partial edits.
 * Consumers convert saved timestamps with toManilaSchedule and serialize with manilaScheduleToIso.
 */
export function DateTimeField({
  id,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  readOnly = false,
  min = '0001-01-01',
  max = '9999-12-31',
  error,
  helperText,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  min?: string
  max?: string
  error?: string
  helperText?: string
  describedBy?: string
}) {
  const [date = '', time = ''] = value.split('T')
  const started = !!(date || time)
  let dateError = ''
  if (!date && (required || started)) dateError = 'Choose a date.'
  if (date) {
    try {
      manilaScheduleToIso(`${date}T00:00`)
      if (date < min || date > max) dateError = `Choose a date from ${min} to ${max}.`
    } catch {
      dateError = 'Choose a valid date.'
    }
  }
  const timeError = !time
    ? required || started
      ? 'Enter a time in HH:mm.'
      : ''
    : !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
      ? 'Enter a valid time in 24-hour HH:mm format.'
      : ''
  const description = [describedBy, `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ')
  const change = (nextDate: string, nextTime: string) =>
    onChange(nextDate || nextTime ? `${nextDate}T${nextTime}` : '')

  return (
    <fieldset
      disabled={disabled}
      aria-labelledby={`${id}-label`}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <legend className="mb-1.5 flex min-h-5 w-full items-center justify-between gap-2 text-[13px] font-medium leading-5">
        <span id={`${id}-label`}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </span>
        {started && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[11px]"
            disabled={disabled}
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange('')}
          >
            Clear
          </Button>
        )}
      </legend>
      <div className="grid min-w-0 grid-cols-2 items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={id} className="sr-only">
            Date
          </Label>
          <Input
            id={id}
            type="date"
            min={min}
            max={max}
            value={date}
            aria-label={`${label} Date`}
            required={required || started}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(event) => change(event.target.value, time)}
            aria-invalid={!!dateError || !!error}
            aria-describedby={`${description}${dateError ? ` ${id}-date-error` : ''}`}
            ref={(node) => {
              node?.setCustomValidity(dateError || error || '')
            }}
            className="h-10 min-w-0 w-full"
          />
          {dateError && (
            <p id={`${id}-date-error`} className="text-xs text-destructive">
              {dateError}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-time`} className="sr-only">
            Time
          </Label>
          <Input
            id={`${id}-time`}
            type="text"
            inputMode="text"
            placeholder="HH:mm"
            value={time}
            aria-label={`${label} Time`}
            required={required || started}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(event) => change(date, event.target.value)}
            aria-invalid={!!timeError || !!error}
            aria-describedby={`${description}${timeError ? ` ${id}-time-error` : ''}`}
            ref={(node) => {
              node?.setCustomValidity(timeError || error || '')
            }}
            className="h-10 min-w-0 w-full tabular-nums"
          />
          {timeError && (
            <p id={`${id}-time-error`} className="text-xs text-destructive">
              {timeError}
            </p>
          )}
        </div>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {helperText || '24-hour time (HH:mm).'}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
