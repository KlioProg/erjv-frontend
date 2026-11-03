import { useState } from 'react'
import type { ClipboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
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
  const [advanced, setAdvanced] = useState(Boolean(value.itemId || value.warehouseId))
  const activeFilters = Number(Boolean(value.itemId)) + Number(Boolean(value.warehouseId))
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
  const yearPrefix =
    value.period === 'semiannual'
      ? `H${selectors.half}`
      : value.period === 'quarterly'
        ? `Q${selectors.quarter}`
        : ''

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
    <section
      className="min-w-0 rounded-lg border bg-card p-3"
      aria-label="Financial report filters"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 max-w-full" role="group" aria-label="Time period">
          <StatusTabNav
            activeTab={value.period}
            tabs={reportPeriods}
            onTabChange={(period) =>
              apply({ type: 'period', value: period as ReportFilterState['period'] }, true)
            }
          />
        </div>

        <div className="w-full min-w-0 max-w-full sm:w-auto">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                type="button"
                aria-label="Previous period"
                className="shrink-0"
                disabled={previous}
                onClick={() => apply({ type: 'step', value: -1 }, true)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              {hasYearInput ? (
                <div className="relative w-full min-w-0 sm:w-70">
                  <Label htmlFor="visual-year" className="sr-only">
                    Year
                  </Label>
                  {yearPrefix && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    >
                      {yearPrefix}
                    </span>
                  )}
                  <Input
                    id="visual-year"
                    aria-invalid={yearIsInvalid}
                    aria-describedby={`visual-period-description${yearIsInvalid || yearMessage ? ` ${yearMessageId}` : ''}`}
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
                    className={`h-9 min-w-0 focus-visible:ring-2 focus-visible:ring-ring${yearPrefix ? ' pl-10' : ''}`}
                  />
                </div>
              ) : value.period === 'monthly' ? (
                <div className="w-full min-w-0 space-y-1 sm:w-70">
                  <Label htmlFor="visual-month" className="sr-only">
                    Month
                  </Label>
                  <Select
                    value={String(selectors.month)}
                    onValueChange={(selected) => apply({ type: 'month', value: Number(selected) })}
                  >
                    <SelectTrigger
                      id="visual-month"
                      aria-label="Month"
                      aria-describedby="visual-period-description"
                      className="h-9 min-w-0 gap-2 whitespace-nowrap [&>span]:min-w-0 [&>svg]:shrink-0"
                    >
                      <SelectValue>
                        {reportDateLabel(dateRange.from, { month: 'long', year: 'numeric' })}
                      </SelectValue>
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
                <div className="w-full min-w-0 space-y-1 sm:w-70">
                  <Label htmlFor="visual-week" className="sr-only">
                    Week
                  </Label>
                  <Select
                    value={String(selectors.week)}
                    onValueChange={(selected) => apply({ type: 'week', value: Number(selected) })}
                  >
                    <SelectTrigger
                      id="visual-week"
                      aria-label="Week"
                      aria-describedby="visual-period-description"
                      className="h-9 min-w-0 gap-2 whitespace-nowrap [&>span]:min-w-0 [&>svg]:shrink-0"
                    >
                      <SelectValue>
                        {reportDateLabel(dateRange.from, { month: 'short', day: 'numeric' })}
                        {' – '}
                        {reportDateLabel(dateRange.through, { month: 'short', day: 'numeric' })}
                      </SelectValue>
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
                className="shrink-0"
                disabled={next}
                onClick={() => apply({ type: 'step', value: 1 }, true)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
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
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-expanded={advanced}
          aria-controls="advanced-report-filters"
          onClick={() => setAdvanced((open) => !open)}
        >
          Filters{activeFilters > 0 ? ` (${activeFilters} active)` : ''}
        </Button>
      </div>
      <p id="visual-period-description" className="mt-2 text-xs text-muted-foreground">
        {reportDateLabel(dateRange.from)} – {reportDateLabel(dateRange.through)} · Asia/Manila
        {value.period === 'weekly' && ` · ISO year ${selectors.year}`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {activeFilters
          ? `${value.itemId ? 'Selected item' : 'All items'} · ${value.warehouseId ? 'Selected warehouse' : 'All warehouses'}`
          : 'All items · All warehouses'}
      </p>
      {advanced && (
        <div
          id="advanced-report-filters"
          className="mt-3 grid min-w-0 items-end gap-3 border-t pt-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]"
        >
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
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => apply({ type: 'reset', today }, true)}
          >
            Reset filters
          </Button>
        </div>
      )}
    </section>
  )
}
