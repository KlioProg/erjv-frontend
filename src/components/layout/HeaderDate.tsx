import { useEffect, useState } from 'react'
import { toManilaSchedule } from '@/lib/manila-schedule'

const currentDay = () => toManilaSchedule(new Date().toISOString()).slice(0, 10)
const dateFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'full',
})

export function HeaderDate() {
  const [today, setToday] = useState(currentDay)

  useEffect(() => {
    let timer: number
    function schedule(day: string) {
      timer = window.setTimeout(
        refresh,
        Date.parse(`${day}T00:00:00+08:00`) + 86_400_000 - Date.now(),
      )
    }
    function refresh() {
      window.clearTimeout(timer)
      const day = currentDay()
      setToday(day)
      schedule(day)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    schedule(today)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [today])

  const text = dateFormat.format(new Date(`${today}T00:00:00+08:00`))
  return (
    <time
      dateTime={today}
      aria-label={`Today's date in the Philippines: ${text}`}
      className="hidden whitespace-nowrap text-sm text-muted-foreground lg:block"
    >
      {text}
    </time>
  )
}
