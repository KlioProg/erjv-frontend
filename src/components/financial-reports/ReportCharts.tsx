import { useState } from 'react'
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
}: {
  selected: ReportKind[]
  reports: Partial<Record<ReportKind, ReportResult>>
  period: ReportPeriod
}) {
  const [active, setActive] = useState<{ point: number; series: number } | null>(null)
  const series = reportMetrics
    .filter((m) => selected.includes(m.kind))
    .map((m) => ({
      ...m,
      points: trendPoints(reports[m.kind]!.rows, m.kind, period),
    }))
  const dates = series[0]?.points.map((point) => point.key) ?? []
  const seriesWithValues = series.map((item) => ({
    ...item,
    values: new Map(item.points.map((point) => [point.key, point.value])),
  }))
  const amounts = seriesWithValues.flatMap((item) =>
    item.points.map((point) => moneyCents(point.value)),
  )
  const low = amounts.reduce((m, v) => (v < m ? v : m), 0n)
  const high = amounts.reduce((m, v) => (v > m ? v : m), 0n)
  const range = high - low || 100n
  const x = (i: number) => 100 + (i * 750) / Math.max(1, dates.length - 1)
  const y = (v: bigint) => 260 - scaledRatio(v - low, range) * 230
  const pointIndex = active ? Math.max(0, Math.min(active.point, dates.length - 1)) : 0
  const seriesIndex = active ? Math.max(0, Math.min(active.series, seriesWithValues.length - 1)) : 0
  const pointDate = dates[pointIndex]
  const activeSeries = seriesWithValues[seriesIndex]
  const activeValue = pointDate && activeSeries?.values.get(pointDate)
  const pointLabel = (date: string) =>
    reportDateLabel(
      date,
      ['annual', 'semiannual', 'quarterly'].includes(period)
        ? { month: 'long', year: 'numeric' }
        : { month: 'long', day: 'numeric', year: 'numeric' },
    )
  const setChartPosition = (point: number, activeSeries: number) => {
    setActive({
      point: Math.max(0, Math.min(point, dates.length - 1)),
      series: Math.max(0, Math.min(activeSeries, seriesWithValues.length - 1)),
    })
  }
  return (
    <section
      className="min-w-0 rounded-lg border bg-card p-4 sm:p-5"
      aria-labelledby="trend-chart-heading"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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
        <div className="flex flex-wrap gap-3 text-xs">
          {seriesWithValues.map((s) => (
            <span key={s.kind} className="inline-flex items-center gap-1.5">
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  x2="24"
                  y1="4"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="3"
                  strokeDasharray={s.dash}
                />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      {dates.length === 0 ? (
        <p>No results for this period and filters.</p>
      ) : (
        <>
          <svg
            role="img"
            aria-label="Financial trends in pesos"
            aria-describedby="trend-chart-help trend-chart-value"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Escape"
            tabIndex={0}
            viewBox="0 0 880 300"
            className="block w-full"
            style={{ minHeight: 200 }}
            onFocus={() => setActive((current) => current ?? { point: 0, series: 0 })}
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
                ? 'Monthly sales, purchases and estimated gross profit'
                : 'Daily sales, purchases and estimated gross profit'}
            </title>
            {[0, 1, 2, 3, 4].map((i) => {
              const value = low + (range * BigInt(i)) / 4n
              return (
                <g key={i}>
                  <line
                    x1="100"
                    x2="850"
                    y1={y(value)}
                    y2={y(value)}
                    stroke="currentColor"
                    className="text-border"
                  />
                  <text
                    x="90"
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
                    strokeDasharray={s.dash}
                    vectorEffect="non-scaling-stroke"
                  />
                  {dates.map((date, i) => {
                    const value = s.values.get(date)
                    return value === undefined ? null : (
                      <circle
                        key={date}
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
                        onMouseEnter={() => setChartPosition(i, seriesPosition)}
                      >
                        <title>
                          {pointLabel(date)}: {s.label} {formatReportMoney(value)}
                        </title>
                      </circle>
                    )
                  })}
                </g>
              )
            })}
            {[...new Set([0, Math.floor((dates.length - 1) / 2), dates.length - 1])].map((i) => (
              <text
                key={i}
                x={x(i)}
                y="288"
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
          <p id="trend-chart-help" className="text-xs text-muted-foreground">
            Focus the chart, then use Left or Right to move across dates and Up or Down to change
            series. Press Escape to hide the value. Tab moves on from the chart.
          </p>
          <p
            id="trend-chart-value"
            role="status"
            aria-live="polite"
            className="mt-3 min-h-6 text-sm font-medium tabular-nums"
          >
            {active && activeValue !== undefined
              ? `${pointLabel(pointDate)} · ${activeSeries.label} · ${formatReportMoney(activeValue)}`
              : active
                ? `${pointLabel(pointDate)} · ${activeSeries.label} · Not available`
                : ''}
          </p>
        </>
      )}
    </section>
  )
}
const palette = ['#3f6212', '#1d4ed8', '#b45309', '#7e22ce', '#0e7490', '#64748b']
export function ReportItemCharts({ kind, report }: { kind: ReportKind; report: ReportResult }) {
  const label = reportMetrics.find((m) => m.kind === kind)!.label
  const total = metricAmount(report.totals, kind)
  const distribution = itemContributions(
    report.rows.map((r) => ({ key: r.key, name: r.name, value: metricAmount(r, kind) })),
    total,
  )
  const sorted = [...distribution.items].sort((a, b) =>
    a.cents > b.cents ? -1 : a.cents < b.cents ? 1 : a.key.localeCompare(b.key),
  )
  const slices =
    sorted.length <= 6
      ? sorted
      : [
          ...sorted.slice(0, 5),
          ...itemContributions(
            [
              {
                key: 'other',
                name: `Other ${sorted.length - 5} items`,
                value: decimalString(sorted.slice(5).reduce((s, r) => s + r.cents, 0n)),
              },
            ],
            total,
          ).items,
        ]
  const maxAbs =
    sorted.reduce((m, r) => {
      const absolute = r.cents < 0n ? -r.cents : r.cents
      return absolute > m ? absolute : m
    }, 0n) || 1n
  const loss = sorted.some((r) => r.cents < 0n)
  return (
    <section
      className="min-w-0 rounded-lg border bg-card p-4 sm:p-5"
      aria-labelledby="item-charts-heading"
    >
      <h2 id="item-charts-heading" className="font-semibold">
        {label} by stock item
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete filtered period · {report.rows.length} items · {formatReportMoney(total)}
      </p>
      {sorted.length === 0 ? (
        <p className="mt-6 text-sm">No item results for this period and filters.</p>
      ) : (
        <div className="mt-5 grid min-w-0 gap-8 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
          <div>
            {distribution.canDonut ? (
              <>
                <svg
                  viewBox="0 0 240 240"
                  className="mx-auto w-full max-w-72"
                  role="img"
                  aria-label={'Item share of ' + label.toLowerCase()}
                >
                  <title>{label}: each item's share of the full total</title>
                  <circle
                    cx="120"
                    cy="120"
                    r="82"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted"
                    strokeWidth="35"
                  />
                  {slices.map((r, i) => {
                    const start = slices
                      .slice(0, i)
                      .reduce((sum, item) => sum + item.ratio * 100, 0)
                    return (
                      <circle
                        key={r.key}
                        cx="120"
                        cy="120"
                        r="82"
                        fill="none"
                        stroke={palette[i]}
                        strokeWidth="35"
                        pathLength="100"
                        strokeDasharray={`${r.ratio * 100} 100`}
                        strokeDashoffset={-start}
                        transform="rotate(-90 120 120)"
                      >
                        <title>
                          {r.name ?? `Item #${r.key}`}: {r.percent}% · {formatReportMoney(r.value)}
                        </title>
                      </circle>
                    )
                  })}
                  <text x="120" y="116" textAnchor="middle" fill="currentColor" fontSize="13">
                    Share of total
                  </text>
                  <text
                    x="120"
                    y="140"
                    textAnchor="middle"
                    fill="currentColor"
                    fontWeight="600"
                    fontSize="24"
                  >
                    100%
                  </text>
                </svg>
                <ul className="mt-3 space-y-2 text-sm">
                  {slices.map((r, i) => (
                    <li key={r.key} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: palette[i] }}
                          aria-hidden="true"
                        />
                        <span className="break-words">{r.name ?? `Item #${r.key}`}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{r.percent}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex min-h-48 items-center rounded-lg bg-muted/40 p-5 text-sm text-muted-foreground">
                {loss
                  ? 'A donut cannot represent negative amounts faithfully. Signed bars preserve the gains and losses.'
                  : moneyCents(total) === 0n
                    ? 'No percentage distribution is available because the net total is zero.'
                    : 'The item amounts do not form a complete part-to-whole distribution. Exact values are shown alongside.'}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4" aria-label="Stock item contributions">
            <p className="text-xs text-muted-foreground">
              {loss
                ? 'Signed amount bars · percentages are shares of the net total'
                : 'Each bar shows the item’s percentage of the full total'}
            </p>
            {sorted.map((r, i) => (
              <div key={r.key} className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    {r.name ?? `Item #${r.key}`}
                  </span>
                  <span className="tabular-nums">
                    {formatReportMoney(r.value)} ·{' '}
                    {r.percent === null ? 'Share unavailable' : `${r.percent}%`}
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
                        width: `${Math.max(0, Math.min(100, r.ratio * 100))}%`,
                        backgroundColor: palette[Math.min(i, 5)],
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
