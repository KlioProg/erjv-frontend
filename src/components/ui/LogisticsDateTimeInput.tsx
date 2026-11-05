import { useState } from 'react'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { manilaScheduleToIso } from '@/lib/manila-schedule'

type ScheduleParts = { date: string; hour: string; minute: string; period: string }
function wallTime(draft: ScheduleParts): string | null {
  if (!Object.values(draft).some(Boolean)) return ''
  if (
    !draft.date ||
    !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(draft.hour) ||
    !/^\d{1,2}$/.test(draft.minute) ||
    Number(draft.minute) > 59 ||
    !['AM', 'PM'].includes(draft.period)
  )
    return null
  const value = `${draft.date}T${String((Number(draft.hour) % 12) + (draft.period === 'PM' ? 12 : 0)).padStart(2, '0')}:${draft.minute.padStart(2, '0')}`
  try {
    manilaScheduleToIso(value)
    return value
  } catch {
    return null
  }
}

function parts(value: string) {
  const [date = '', time = ''] = value.split('T')
  const [hour = '', minute = ''] = time.split(':')
  return {
    date,
    hour: hour ? String(Number(hour) % 12 || 12) : '',
    minute,
    period: hour ? (Number(hour) >= 12 ? 'PM' : 'AM') : '',
  }
}

/** Emits complete Manila wall times or an explicit clear; partial input blocks form submission. */
export function LogisticsDateTimeInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  describedBy?: string
}) {
  const [previous, setPrevious] = useState(value)
  const [draft, setDraft] = useState(() => parts(value))
  if (value !== previous) {
    setPrevious(value)
    if (value !== wallTime(draft)) setDraft(parts(value))
  }
  const any = Object.values(draft).some(Boolean)
  const complete = wallTime(draft)
  const message =
    complete === null
      ? 'Choose a date, hour (1-12), minute (00-59), and AM or PM, or clear the schedule.'
      : ''
  function change(next: typeof draft) {
    setDraft(next)
    const nextValue = wallTime(next)
    if (nextValue !== null) onChange(nextValue)
  }
  return (
    <fieldset
      disabled={disabled}
      aria-label={`${label} controls`}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <Label htmlFor={id}>Date</Label>
          <Input
            id={id}
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={draft.date}
            onChange={(event) => change({ ...draft, date: event.target.value })}
            aria-invalid={!!message}
            aria-describedby={
              [describedBy, message && `${id}-error`].filter(Boolean).join(' ') || undefined
            }
            ref={(node) => {
              node?.setCustomValidity(message)
            }}
          />
        </div>
        <div className="flex w-16 flex-col gap-1">
          <Label htmlFor={`${id}-hour`}>Hour</Label>
          <Input
            id={`${id}-hour`}
            aria-label={`${label} hour`}
            inputMode="numeric"
            placeholder="hh"
            value={draft.hour}
            aria-invalid={!!draft.hour && !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(draft.hour)}
            onChange={(event) => change({ ...draft, hour: event.target.value })}
          />
        </div>
        <span className="pb-2" aria-hidden="true">
          :
        </span>
        <div className="flex w-16 flex-col gap-1">
          <Label htmlFor={`${id}-minute`}>Minute</Label>
          <Input
            id={`${id}-minute`}
            aria-label={`${label} minute`}
            inputMode="numeric"
            placeholder="mm"
            value={draft.minute}
            aria-invalid={
              !!draft.minute && (!/^\d{1,2}$/.test(draft.minute) || Number(draft.minute) > 59)
            }
            onChange={(event) => change({ ...draft, minute: event.target.value })}
            onBlur={() => {
              if (/^\d{1,2}$/.test(draft.minute) && Number(draft.minute) < 60)
                change({ ...draft, minute: draft.minute.padStart(2, '0') })
            }}
          />
        </div>
        <div className="flex w-24 flex-col gap-1">
          <Label htmlFor={`${id}-period`}>AM / PM</Label>
          <Select
            value={draft.period}
            disabled={disabled}
            onValueChange={(period) => change({ ...draft, period })}
          >
            <SelectTrigger id={`${id}-period`} aria-label={`${label} AM or PM`}>
              <SelectValue placeholder="AM/PM" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {any && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => change(parts(''))}
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            Clear
          </Button>
        )}
      </div>
      {message ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {complete
            ? new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(manilaScheduleToIso(complete)!))
            : 'No schedule set'}{' '}
          | Manila time
        </p>
      )}
    </fieldset>
  )
}
