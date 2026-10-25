import { useEffect, useState } from 'react'
import { localDateKey } from '@hellokido/core/rules/dates.js'

/**
 * The time, checked every minute and whenever the screen comes back into view. A tab left open
 * overnight would otherwise keep showing yesterday's lessons as today's.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    const timer = window.setInterval(tick, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
      window.clearInterval(timer)
    }
  }, [])
  return { now, dayKey: localDateKey(now) as string }
}
