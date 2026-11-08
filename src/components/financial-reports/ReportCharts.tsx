import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { decimalString } from '@/lib/order-amounts'
import { formatReportMoney } from '@/features/financial-reports/financial-reports.filters'
import {
  itemContributions,
  metricAmount,
  moneyCents,
  reportDateLabel,
  reportMetrics,
  scaledRatio,
  trendPoints,
  type ReportPeriod,
} from '@/features/financial-reports/financial-report-visuals'
import type { ReportKind, ReportResult } from '@/features/financial-reports/financial-reports.types'

function compactPeso(cents: bigint) {
  const absolute = cents < 0n ? -cents : cents
  for (const [threshold, suffix] of [
    [100_000_000_000_000_000n, 'Q'],
    [100_000_000_000_000n, 'T'],
    [100_000_000_000n, 'B'],
    [100_000_000n, 'M'],
    [100_000n, 'K'],
  ] as const)
    if (absolute >= threshold)
      return `${cents < 0n ? '-' : ''}₱${decimalString((absolute * 100n) / threshold)}${suffix}`
  return formatReportMoney(decimalString(cents))
}
export function ReportLineChart({
  selected,
  reports,
  period,
  onToggle,
}: {
  selected: ReportKind[]
  reports: Partial<Record<ReportKind, ReportResult>>
  period: ReportPeriod
  onToggle?: (kind: ReportKind) => void
}) {
  const chartRef = useRef<HTMLElement>(null)
  const [plotWidth, setPlotWidth] = useState(880)
  useEffect(() => {
    const element = chartRef.current
    if (!element) return
    const resize = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) setPlotWidth(width)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const [active, setActive] = useState<{ point: number; series: number } | null>(null)
  const series = useMemo(
    () =>
      reportMetrics
        .filter((m) => selected.includes(m.kind) && reports[m.kind])
        .map((m) => ({
          ...m,
          points: trendPoints(reports[m.kind]!.rows, m.kind, period),
        })),
    [selected, reports, period],
  )
  const observedDates = [
    ...new Set(series.flatMap((item) => item.points.map((point) => point.key))),
  ].sort()
  const dates: string[] = []
  if (observedDates.length) {
    const monthly = ['annual', 'semiannual', 'quarterly'].includes(period)
    const date = new Date(observedDates[0] + 'T00:00:00Z')
    const last = observedDates[observedDates.length - 1]
    while (date.toISOString().slice(0, 10) <= last) {
      dates.push(date.toISOString().slice(0, 10))
      if (monthly) date.setUTCMonth(date.getUTCMonth() + 1)
      else date.setUTCDate(date.getUTCDate() + 1)
    }
  }
  const seriesWithValues = series.map((item) => ({
    ...item,
    values: new Map(item.points.map((point) => [point.key, point.value])),
  }))
  const amounts = seriesWithValues.flatMap((item) =>
    item.points.map((point) => moneyCents(point.value)),
  )
  const minimum = amounts.reduce((m, v) => (v < m ? v : m), 0n)
  const maximum = amounts.reduce((m, v) => (v > m ? v : m), 0n)
  const padding = (maximum - minimum) / 20n || 1n
  const low = minimum < 0n ? minimum - padding : 0n
  const high = maximum > 0n ? maximum + padding : minimum < 0n ? 0n : 100n
  const range = high - low
  const x = (i: number) => 90 + (i * Math.max(1, plotWidth - 120)) / Math.max(1, dates.length - 1)
  const y = (v: bigint) => 182 - scaledRatio(v - low, range) * 164
  const pointIndex = active ? Math.max(0, Math.min(active.point, dates.length - 1)) : 0
  const pointDate = dates[pointIndex]
  const pointLabel = (date: string) =>
    reportDateLabel(
      date,
      ['annual', 'semiannual', 'quarterly'].includes(period)
        ? { month: 'long', year: 'numeric' }
        : { month: 'long', day: 'numeric', year: 'numeric' },
    )
  const activeDate = active ? dates[pointIndex] : undefined
  const selectedActiveSeries = active ? seriesWithValues[active.series] : undefined
  const activeSeries =
    active && activeDate
      ? selectedActiveSeries?.values.has(activeDate)
        ? selectedActiveSeries
        : seriesWithValues.find((item) => item.values.has(activeDate))
      : undefined
  const activeValue = activeDate && activeSeries ? activeSeries.values.get(activeDate) : undefined
  const tooltipX = active ? (x(pointIndex) / plotWidth) * 100 : 0
  const tooltipY = activeValue === undefined ? 0 : (y(moneyCents(activeValue)) / 220) * 100
  const setChartPosition = (point: number, activeSeries: number) => {
    setActive({
      point: Math.max(0, Math.min(point, dates.length - 1)),
      series: Math.max(0, Math.min(activeSeries, seriesWithValues.length - 1)),
    })
  }
  const handleChartMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const scaleX = bounds.width / plotWidth
    const scaleY = bounds.height / 220
    let nearest: { point: number; series: number; distance: number } | undefined
    seriesWithValues.forEach((item, seriesPosition) => {
      dates.forEach((date, point) => {
        const value = item.values.get(date)
        if (value === undefined) return
        const dx = event.clientX - (bounds.left + x(point) * scaleX)
        const dy = event.clientY - (bounds.top + y(moneyCents(value)) * scaleY)
        const distance = dx * dx + dy * dy
        if (!nearest || distance < nearest.distance)
          nearest = { point, series: seriesPosition, distance }
      })
    })
    if (nearest) setChartPosition(nearest.point, nearest.series)
  }
  return (
    <section ref={chartRef} className="min-w-0" aria-labelledby="trend-chart-heading">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="trend-chart-heading" className="font-semibold">
            Financial trends
          </h2>
          <p className="text-sm text-muted-foreground">
            {['annual', 'semiannual', 'quarterly'].includes(period)
              ? 'Monthly totals'
              : 'Daily amounts'}{' '}
            · Philippine pesos
          </p>
        </div>
        {onToggle && (
          <div role="group" aria-label="Chart metrics" className="flex flex-wrap gap-2">
            {reportMetrics.map((metric) => (
              <Button
                key={metric.kind}
                type="button"
                size="sm"
                variant={selected.includes(metric.kind) ? 'outline' : 'secondary'}
                aria-pressed={selected.includes(metric.kind)}
                onClick={() => onToggle(metric.kind)}
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {selected.length === 0 ? (
        <p>Select a metric to view financial trends.</p>
      ) : series.length === 0 ? (
        <p>No selected reports are available yet.</p>
      ) : dates.length === 0 ? (
        <p>No results for this period and filters.</p>
      ) : (
        <>
          <ul id="trend-chart-legend" aria-label="Chart series" className="mb-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {series.map((item) => (
              <li key={item.kind} className="flex min-w-0 items-center gap-2">
                <svg aria-hidden="true" width="28" height="8" className="shrink-0">
                  <line x1="0" x2="28" y1="4" y2="4" stroke={item.color} strokeWidth="2.5" />
                </svg>
                <span className="[overflow-wrap:anywhere]">{item.label}</span>
              </li>
            ))}
          </ul>
          <div className="relative">
            <svg
              role="img"
              aria-label="Financial trends in pesos"
              aria-describedby="trend-chart-legend trend-chart-help trend-chart-value"
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Escape"
              tabIndex={0}
              viewBox={`0 0 ${plotWidth} 220`}
              preserveAspectRatio="none"
              className="block h-[200px] w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onFocus={() => setActive((current) => current ?? { point: 0, series: 0 })}
              onMouseMove={handleChartMouseMove}
              onMouseLeave={(event) => {
                if (document.activeElement !== event.currentTarget) setActive(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setActive(null)
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  const currentPoint = active?.point ?? 0
                  setChartPosition(
                    currentPoint + (event.key === 'ArrowRight' ? 1 : -1),
                    active?.series ?? 0,
                  )
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  const currentSeries = active?.series ?? 0
                  setChartPosition(
                    active?.point ?? 0,
                    currentSeries + (event.key === 'ArrowDown' ? 1 : -1),
                  )
                }
              }}
            >
              <title>
                {['annual', 'semiannual', 'quarterly'].includes(period)
                  ? 'Monthly totals: '
                  : 'Daily amounts: '}
                {series.map((item) => item.label).join(', ')}
              </title>
              {[0, 1, 2, 3, 4].map((i) => {
                const value = low + (range * BigInt(i)) / 4n
                return (
                  <g key={i}>
                    <line
                      x1="80"
                      x2={plotWidth - 20}
                      y1={y(value)}
                      y2={y(value)}
                      stroke="currentColor"
                      className="text-border"
                    />
                    <text
                      x="70"
                      y={y(value) + 4}
                      textAnchor="end"
                      fontSize="12"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {compactPeso(value)}
                    </text>
                  </g>
                )
              })}
              <line
                data-zero-baseline="true"
                x1="80"
                x2={plotWidth - 20}
                y1={y(0n)}
                y2={y(0n)}
                stroke="currentColor"
                className="text-muted-foreground"
                strokeWidth="1.25"
              />
              {seriesWithValues.map((s, seriesPosition) => {
                let connected = false
                const path = dates
                  .map((d, i) => {
                    const value = s.values.get(d)
                    if (value === undefined) {
                      connected = false
                      return ''
                    }
                    const prefix = connected ? 'L' : 'M'
                    connected = true
                    return `${prefix}${x(i)},${y(moneyCents(value))}`
                  })
                  .join(' ')
                return (
                  <g key={s.kind}>
                    <path
                      d={path}
                      data-series={s.kind}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                    />
                    {dates.map((date, i) => {
                      const value = s.values.get(date)
                      return value === undefined ? null : (
                        <g key={date}>
                          <circle
                            data-series={s.kind}
                            data-point-key={date}
                            cx={x(i)}
                            cy={y(moneyCents(value))}
                            r={
                              active?.point === i && active?.series === seriesPosition
                                ? 4
                                : dates.length < 40
                                  ? 2.5
                                  : 1.5
                            }
                            fill={s.color}
                          >
                            <title>
                              {pointLabel(date)}: {s.label} {formatReportMoney(value)}
                            </title>
                          </circle>
                        </g>
                      )
                    })}
                  </g>
                )
              })}
              {[...new Set([0, Math.floor((dates.length - 1) / 2), dates.length - 1])].map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y="211"
                  textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
                  fill="currentColor"
                  className="text-muted-foreground"
                  fontSize="12"
                >
                  {reportDateLabel(
                    dates[i],
                    ['annual', 'semiannual', 'quarterly'].includes(period)
                      ? { month: 'short', year: '2-digit' }
                      : { month: 'short', day: 'numeric' },
                  )}
                </text>
              ))}
            </svg>
            {active && activeDate && (
              <div
                data-testid="trend-chart-tooltip"
                aria-hidden="true"
                className="pointer-events-none absolute z-10 w-56 max-w-[calc(100%-1rem)] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
                style={{
                  left: `clamp(0.5rem, calc(${tooltipX}% - 7rem), calc(100% - 14.5rem))`,
                  top: `clamp(0.5rem, calc(${tooltipY}% - 6rem), calc(100% - 6rem))`,
                }}
              >
                <p className="mb-2 text-xs font-semibold">{pointLabel(activeDate)}</p>
                <ul className="space-y-1 text-xs tabular-nums">
                  {seriesWithValues.map((item) => {
                    const value = item.values.get(activeDate)
                    return (
                      <li key={item.kind} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="shrink-0">
                          {value === undefined ? 'Not available' : formatReportMoney(value)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
          {amounts.length > 0 && amounts.every((amount) => amount === 0n) && (
            <p className="text-xs text-muted-foreground">All reported amounts are zero.</p>
          )}
          <p id="trend-chart-help" className="sr-only">
            Straight segments connect consecutive daily or monthly bucket totals, not observed
            values between buckets. Gaps are unavailable observations. Focus the chart, then use
            Left or Right to move across dates and Up or Down to change series. Press Escape to hide
            the value. Tab moves on from the chart.
          </p>
          <p
            id="trend-chart-value"
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {active
              ? `${pointLabel(pointDate)} · ${seriesWithValues
                  .map((item) => {
                    const value = item.values.get(pointDate)
                    return `${item.label} · ${value === undefined ? 'Not available' : formatReportMoney(value)}`
                  })
                  .join(' · ')}`
              : ''}
          </p>
        </>
      )}
    </section>
  )
}
const palette = ['#3f6212', '#1d4ed8', '#b45309', '#7e22ce', '#0e7490', '#64748b']
export function ReportItemCharts({ kind, report }: { kind: ReportKind; report: ReportResult }) {
  const [expanded, setExpanded] = useState(false)
  const label = reportMetrics.find((m) => m.kind === kind)!.label
  const total = metricAmount(report.totals, kind)
  const distribution = itemContributions(
    report.rows.map((r) => ({ key: r.key, name: r.name, value: metricAmount(r, kind) })),
    total,
  )
  const sorted = [...distribution.items].sort((a, b) =>
    a.cents > b.cents ? -1 : a.cents < b.cents ? 1 : a.key.localeCompare(b.key),
  )
  const maxAbs =
    sorted.reduce((m, r) => {
      const absolute = r.cents < 0n ? -r.cents : r.cents
      return absolute > m ? absolute : m
    }, 0n) || 1n
  const loss = sorted.some((r) => r.cents < 0n)
  return (
    <section className="min-w-0" aria-labelledby="item-charts-heading">
      <h2 id="item-charts-heading" className="font-semibold">
        {label} by stock item
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete filtered period · {report.rows.length} items · {formatReportMoney(total)}
      </p>
      {sorted.length === 0 ? (
        <p className="mt-6 text-sm">No item results for this period and filters.</p>
      ) : (
        <div className="mt-4">
          <div className="min-w-0 space-y-4" aria-label="Stock item contributions">
            <p className="text-xs text-muted-foreground">
              {loss
                ? 'Signed bars preserve gains and losses. Percentage shares are unavailable for signed totals.'
                : distribution.canDonut
                  ? 'Each bar shows the item’s percentage of the full total'
                  : 'Percentage shares are unavailable; bars show relative amounts.'}
            </p>
            {(expanded ? sorted : sorted.slice(0, 8)).map((r, i) => (
              <div key={r.key} className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    {r.name ?? `Item #${r.key}`}
                  </span>
                  <span className="tabular-nums">
                    {formatReportMoney(r.value)} ·{' '}
                    {!distribution.canDonut || r.percent === null
                      ? 'Share unavailable'
                      : `${r.percent}%`}
                  </span>
                </div>
                {loss ? (
                  <div className="relative flex h-3 rounded bg-muted" aria-hidden="true">
                    <div className="absolute inset-y-0 left-1/2 border-l border-foreground/40" />
                    <div
                      className="absolute inset-y-0 rounded-sm"
                      style={{
                        width: `${Math.abs(scaledRatio(r.cents, maxAbs)) * 50}%`,
                        ...(r.cents < 0n
                          ? { right: '50%', backgroundColor: '#b91c1c' }
                          : { left: '50%', backgroundColor: palette[Math.min(i, 5)] }),
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-3 overflow-hidden rounded bg-muted" aria-hidden="true">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.max(0, Math.min(100, (distribution.canDonut ? r.ratio : scaledRatio(r.cents, maxAbs)) * 100))}%`,
                        backgroundColor: palette[Math.min(i, 5)],
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {sorted.length > 8 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Show top 8 items' : `Show all ${sorted.length} items`}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
