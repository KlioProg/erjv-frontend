type SourceTime = { label: string; time?: number; status?: string }

/** Equal timestamps describe matching times, not an atomic snapshot across sources. */
export function DashboardDataTimes({ label, sources }: { label: string; sources: SourceTime[] }) {
  const groups = new Map<string, SourceTime & { labels: string[] }>()
  for (const source of sources) {
    const key = source.status ?? String(source.time)
    const group = groups.get(key)
    if (group) group.labels.push(source.label)
    else groups.set(key, { ...source, labels: [source.label] })
  }
  return (
    <details className="min-w-0 text-sm text-muted-foreground">
      <summary className="min-h-11 cursor-pointer content-center rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
      </summary>
      <p className="mb-2">Figures are reported separately. Times use the business timezone.</p>
      <dl className="space-y-2">
        {[...groups].map(([key, source]) => (
          <div key={key}>
            <dt className="font-medium text-foreground">{source.labels.join(', ')}</dt>
            <dd>
              {source.status ??
                (source.time ? (
                  <time dateTime={new Date(source.time).toISOString()}>
                    {new Intl.DateTimeFormat('en-PH', {
                      timeZone: 'Asia/Manila',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(source.time))}
                  </time>
                ) : (
                  'Unavailable'
                ))}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
