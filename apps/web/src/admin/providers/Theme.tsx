import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'hk-theme'
// The old panel stored 'true' / 'false' under "theme"; it is read once so nobody loses their choice
const LEGACY_KEY = 'theme'
// The browser bar takes the page's ground colour (--ground in app.css)
const GROUND = { light: '#ffffff', dark: '#0a0a0a' }

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === 'true') return 'dark'
    if (legacy === 'false') return 'light'
  } catch {
    // Storage unavailable
  }
  return 'system'
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

type ThemeValue = { choice: ThemeChoice; isDark: boolean; setChoice: (next: ThemeChoice) => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches)

  useEffect(() => {
    const query = darkQuery()
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const isDark = choice === 'dark' || (choice === 'system' && systemDark)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', isDark ? GROUND.dark : GROUND.light)
    })
  }, [isDark])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts for this visit
    }
  }, [])

  const value = useMemo(() => ({ choice, isDark, setChoice }), [choice, isDark, setChoice])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
