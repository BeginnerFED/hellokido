import { useLayoutEffect } from 'react'
import PublicCalendar from './PublicCalendar'
import './public-calendar.css'

const PUBLIC_FONT_ID = 'hk-public-font'
const PUBLIC_FONT_URL = 'https://fonts.cdnfonts.com/css/euclid-circular-a'

// The public calendar keeps its pre-redesign look: always light, Euclid Circular A and the
// Tailwind 3 colours pinned in public-calendar.css. index.html prepares this before the first
// paint; this covers arriving here from the admin panel in the same tab.
export default function PublicPage() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    const previousLang = root.lang
    root.classList.add('hk-public-root')
    root.classList.remove('dark')
    root.lang = 'tr'
    if (!document.getElementById(PUBLIC_FONT_ID)) {
      const link = document.createElement('link')
      link.id = PUBLIC_FONT_ID
      link.rel = 'stylesheet'
      link.href = PUBLIC_FONT_URL
      document.head.appendChild(link)
    }
    return () => {
      root.classList.remove('hk-public-root')
      if (wasDark) root.classList.add('dark')
      root.lang = previousLang
    }
  }, [])

  return <PublicCalendar />
}
