import { useSyncExternalStore } from 'react'

/** True while the media query matches; follows window resizes and rotation. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** The rail layout: the sidebar shows and lists sit next to their detail. */
export const useWideLayout = () => useMediaQuery('(min-width: 1024px)')
