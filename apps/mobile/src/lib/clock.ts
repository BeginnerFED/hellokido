import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { localDateKey } from '@hellokido/core/rules/dates.js'

/**
 * The time, checked every minute and whenever the app comes back to the front. An app left open
 * overnight would otherwise keep showing yesterday's lessons as today's.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && tick())
    const timer = setInterval(() => AppState.currentState === 'active' && tick(), 60_000)
    return () => {
      subscription.remove()
      clearInterval(timer)
    }
  }, [])
  return { now, dayKey: localDateKey(now) as string }
}
