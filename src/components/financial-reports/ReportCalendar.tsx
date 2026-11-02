import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatReportMoney } from '@/features/financial-reports/financial-reports.filters'
import {
  metricAmount,
  moneyCents,
  reportDateLabel,
  reportMetrics,
} from '@/features/financial-reports/financial-report-visuals'
import {
  reportDraft,
  type ReportFilterState,
} from '@/features/financial-reports/financial-report-periods'
import type { ReportKind, ReportRow } from '@/features/financial-reports/financial-reports.types'

function dateSequence(from: string, through: string): string[] {
  const dates: string[] = []
  for (
    let time = Date.parse(`${from}T00:00:00.000Z`);
    time <= Date.parse(`${through}T00:00:00.000Z`);
    time += 86_400_000
  )
    dates.push(new Date(time).toISOString().slice(0, 10))
  return dates
}

function shiftMonth(month: string, amount: -1 | 1): string {
  const date = new Date(`${month}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 7)
}

export function ReportCalendar({
  kind,
  rows,
  filters,
}: {
  kind: ReportKind
  rows: ReportRow[]
  filters: ReportFilterState
}) {
  const range = reportDraft(filters)
  const [month, setMonth] = useState(filters.anchor.slice(0, 7))
  const label = reportMetrics.find((metric) => metric.kind === kind)!.label.toLowerCase()
  const values = new Map(rows.map((row) => [row.key, metricAmount(row, kind)]))
  const weekly = filters.period === 'weekly'

  if (weekly) {
    const weekDays = dateSequence(range.from, range.through)
    return (
      <section className="min-w-0" aria-labelledby="calendar-heading">
        <div className="mb-4">
          <h2 id="calendar-heading" className="font-semibold">
            Daily {label}
          </h2>
          <p className="text-sm text-muted-foreground">
            Daily observations · Asia/Manila
          </p>
        </div>
        <div className="pb-1">
          <div
            role="list"
            aria-label={`Weekly ${label}`}
            className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-7"
          >
            {weekDays.map((day) => {
              const value = values.get(day)
              const negative = value !== undefined && moneyCents(value) < 0n
              return (
                <div
                  key={day}
                  role="listitem"
                  aria-label={`${reportDateLabel(day)}: ${value === undefined ? 'Not available' : formatReportMoney(value)}`}
                  className={`min-w-0 rounded-md border bg-background p-2 ${negative ? 'text-destructive' : ''}`}
                >
                  <span className="block text-xs font-medium">
                    {reportDateLabel(day, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="mt-1 block break-words text-xs font-medium tabular-nums">
                    {value === undefined ? 'Not available' : formatReportMoney(value)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const firstMonth = range.from.slice(0, 7)
  const lastMonth = range.through.slice(0, 7)
  const showCalendarNavigation = filters.period !== 'monthly'
  const date = new Date(`${month}-01T00:00:00.000Z`)
  const offset = (date.getUTCDay() + 6) % 7
  const dayCount = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = month + '-' + String(index + 1).padStart(2, '0')
    return { day, value: values.get(day) }
  })
  const slots: ({ day: string; value?: string } | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...days,
  ]
  while (slots.length % 7) slots.push(null)
  const monthLabel = reportDateLabel(month + '-01', { month: 'long', year: 'numeric' })

  return (
    <section className="min-w-0" aria-labelledby="calendar-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="calendar-heading" className="font-semibold">
            Daily {label}
          </h2>
          <p className="text-sm text-muted-foreground">
            Daily observations · Asia/Manila
          </p>
        </div>
        {showCalendarNavigation ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Previous calendar month"
              disabled={month <= firstMonth}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium" aria-live="polite">
              {monthLabel}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Next calendar month"
              disabled={month >= lastMonth}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <span className="text-sm font-medium" aria-live="polite">
            {monthLabel}
          </span>
        )}
      </div>
      <div role="grid" aria-label={`${monthLabel} daily ${label}`} className="mt-3 space-y-1">
        <div role="row" className="hidden grid-cols-7 gap-1 sm:grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              role="columnheader"
              className="py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        {Array.from({ length: slots.length / 7 }, (_, rowIndex) => (
          <div key={rowIndex} role="row" className="grid grid-cols-1 gap-1 sm:grid-cols-7">
            {slots.slice(rowIndex * 7, rowIndex * 7 + 7).map((slot, columnIndex) =>
              slot ? (
                <div
                  key={slot.day}
                  role="gridcell"
                  aria-label={`${reportDateLabel(slot.day)}: ${slot.value === undefined ? 'Not available' : formatReportMoney(slot.value)}`}
                  className={`min-h-11 min-w-0 rounded-md border bg-background p-2 ${slot.value === undefined || moneyCents(slot.value) === 0n ? 'text-muted-foreground bg-muted/20' : moneyCents(slot.value) < 0n ? 'text-destructive' : ''}`}
                >
                  <span className="block text-xs font-medium">
                    <span className="sm:hidden">
                      {reportDateLabel(slot.day, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="hidden sm:inline">{Number(slot.day.slice(-2))}</span>
                  </span>
                  <span className="mt-1 block break-words text-xs tabular-nums">
                    {slot.value === undefined ? 'Not available' : formatReportMoney(slot.value)}
                  </span>
                </div>
              ) : (
                <div
                  key={`blank-${rowIndex}-${columnIndex}`}
                  role="gridcell"
                  aria-hidden="true"
                  className="hidden sm:block"
                />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
