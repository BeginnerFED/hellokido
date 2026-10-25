import { useEffect } from 'react'
import type { VisibleRange } from './Moves'

/**
 * The period the finance page shows right now, if it is open. An expense added from quick add
 * while the page is open can then say that its day is outside the list on screen.
 */
let shown: VisibleRange | null = null

export const visibleRange = () => shown

export function useShowRange(range: VisibleRange) {
  useEffect(() => {
    shown = range
    return () => {
      if (shown === range) shown = null
    }
  }, [range])
}
