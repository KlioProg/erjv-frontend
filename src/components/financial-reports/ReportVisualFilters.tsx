import { useState } from 'react'
import type { ClipboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CursorLookup } from '@/components/ui/CursorLookup'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  changeReportFilters,
  monthOptions,
  periodSelectors,
  reportDraft,
  type PeriodAction,
  type ReportFilterState,
  weekOptions,
} from '@/features/financial-reports/financial-report-periods'
import {
  reportDateLabel,
  reportPeriods,
} from '@/features/financial-reports/financial-report-visuals'

const yearMessageId = 'visual-year-message'

export function ReportVisualFilters({
  value,
  today,
  onChange,
}: {
  value: ReportFilterState
  today: string
  onChange: (action: PeriodAction) => void
}) {
  const selectors = periodSelectors(value)
  const committedYear = String(selectors.year)
  const [yearDraft, setYearDraft] = useState({
    period: value.period,
    committedYear,
    raw: committedYear,
    message: '',
  })
  const yearDraftIsCurrent =
    yearDraft.period === value.period && yearDraft.committedYear === committedYear
  const rawYear = yearDraftIsCurrent ? yearDraft.raw : committedYear
  const yearMessage = yearDraftIsCurrent ? yearDraft.message : ''
  const hasYearInput = ['annual', 'semiannual', 'quarterly'].includes(value.period)
  const yearIsValid = /^\d{4}$/.test(rawYear) && Number(rawYear) >= 1900 && Number(rawYear) <= 2100
  const yearIsInvalid = hasYearInput && !yearIsValid
  const dateRange = reportDraft(value)

  const apply = (action: PeriodAction, discardYearText = false) => {
    if (discardYearText) {
      setYearDraft({ period: value.period, committedYear, raw: committedYear, message: '' })
    }
    onChange(action)
  }

  const changeYear = (next: string) => {
    if (!/^\d{0,4}$/.test(next)) return
    setYearDraft({ period: value.period, committedYear, raw: next, message: '' })
    if (next.length === 4 && Number(next) >= 1900 && Number(next) <= 2100) {
      const year = Number(next)
      if (year !== selectors.year) onChange({ type: 'year', value: year })
    }
  }

  const pasteYear = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    const target = event.currentTarget
    const start = target.selectionStart ?? rawYear.length
    const end = target.selectionEnd ?? start
    const next = rawYear.slice(0, start) + pasted + rawYear.slice(end)
    if (next.length > 4 || !/^\d*$/.test(next)) event.preventDefault()
  }

  const restoreYear = (message = '') => {
    setYearDraft({ period: value.period, committedYear, raw: committedYear, message })
  }

  const previous = changeReportFilters(value, { type: 'step', value: -1 }) === value
  const next = changeReportFilters(value, { type: 'step', value: 1 }) === value

  return (
    <section className="space-y-4" aria-label="Financial report filters">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time period">
        {reportPeriods.map((period) => (
          <Button
            key={period.value}
            type="button"
            variant={value.period === period.value ? 'default' : 'outline'}
            aria-pressed={value.period === period.value}
            onClick={() => apply({ type: 'period', value: period.value }, true)}
          >
            {period.label}
          </Button>
        ))}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Period containing</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label="Previous period"
              disabled={previous}
              onClick={() => apply({ type: 'step', value: -1 }, true)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            {hasYearInput ? (
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="visual-year" className="text-xs">
                  Year
                </Label>
                <Input
                  id="visual-year"
                  aria-invalid={yearIsInvalid}
                  aria-describedby={yearIsInvalid || yearMessage ? yearMessageId : undefined}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={rawYear}
                  onChange={(event) => changeYear(event.currentTarget.value)}
                  onPaste={pasteYear}
                  onBlur={() => {
                    if (yearIsInvalid)
                      restoreYear('No change applied. Enter a four-digit year from 1900 to 2100.')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && rawYear !== committedYear) {
                      event.preventDefault()
                      restoreYear()
                    } else if (event.key === 'Enter') event.preventDefault()
                  }}
                  className="min-w-0 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ) : value.period === 'monthly' ? (
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="visual-month" className="text-xs">
                  Month
                </Label>
                <Select
                  value={String(selectors.month)}
                  onValueChange={(selected) => apply({ type: 'month', value: Number(selected) })}
                >
                  <SelectTrigger id="visual-month" aria-label="Month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions().map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="visual-week" className="text-xs">
                  Week
                </Label>
                <Select
                  value={String(selectors.week)}
                  onValueChange={(selected) => apply({ type: 'week', value: Number(selected) })}
                >
                  <SelectTrigger id="visual-week" aria-label="Week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions(value.anchor).map((week) => (
                      <SelectItem key={week.value} value={String(week.value)}>
                        {week.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label="Next period"
              disabled={next}
              onClick={() => apply({ type: 'step', value: 1 }, true)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          {!hasYearInput && (
            <p className="text-xs text-muted-foreground" aria-label="Period year">
              Year · {selectors.year}
            </p>
          )}
          {hasYearInput && value.period === 'semiannual' && (
            <p className="text-xs text-muted-foreground">
              H{selectors.half} · {selectors.half === 1 ? 'January–June' : 'July–December'}
            </p>
          )}
          {hasYearInput && value.period === 'quarterly' && (
            <p className="text-xs text-muted-foreground">
              Q{selectors.quarter} ·{' '}
              {
                ['', 'January–March', 'April–June', 'July–September', 'October–December'][
                  selectors.quarter
                ]
              }
            </p>
          )}
          {yearIsInvalid && (
            <p id={yearMessageId} className="text-xs text-destructive">
              Enter a four-digit year from 1900 to 2100. The current report remains unchanged.
            </p>
          )}
          {yearMessage && !yearIsInvalid && (
            <p id={yearMessageId} className="text-xs text-muted-foreground">
              {yearMessage}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {reportDateLabel(dateRange.from)} – {reportDateLabel(dateRange.through)} · Asia/Manila
          </p>
        </div>

        {(
          [
            { field: 'itemId', label: 'Item', path: '/inventory-items' },
            { field: 'warehouseId', label: 'Warehouse', path: '/warehouses' },
          ] as const
        ).map(({ field, label, path }) => (
          <div className="space-y-1" key={field}>
            <Label htmlFor={'visual-' + field}>
              {label} {value[field] ? '' : '(All)'}
            </Label>
            <div className="flex min-w-0 gap-1">
              <CursorLookup<{ id: number; name: string; variety?: string; isActive?: boolean }>
                id={'visual-' + field}
                path={path}
                label={label}
                value={value[field]}
                filter={{ includeInactive: 'true' }}
                getLabel={(record) =>
                  [record.name, record.variety, record.isActive === false ? '(archived)' : '']
                    .filter(Boolean)
                    .join(' ')
                }
                onChange={(selected) => apply({ type: field, value: selected })}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={'Clear ' + label.toLowerCase()}
                disabled={!value[field]}
                onClick={() => apply({ type: field, value: '' })}
              >
                Clear
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={() => apply({ type: 'reset', today }, true)}>
        Reset filters
      </Button>
    </section>
  )
}
