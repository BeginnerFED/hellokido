import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { readSetting, writeSetting } from '../lib/storage'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Scheme = 'light' | 'dark'

// Same key as the web panel, so the choice reads the same everywhere it is stored
const STORAGE_KEY = 'hk-theme'

function savedChoice(): ThemeChoice {
  const value = readSetting(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

const apply = (choice: ThemeChoice) => Appearance.setColorScheme(choice === 'system' ? 'auto' : choice)

/** Before the first screen draws, so a dark choice never flashes light. */
export const applySavedTheme = () => apply(savedChoice())

type ThemeValue = { choice: ThemeChoice; setChoice: (next: ThemeChoice) => void; scheme: Scheme }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(savedChoice)
  const device = useColorScheme()

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    writeSetting(STORAGE_KEY, next)
    apply(next)
  }, [])

  // Android does not tell the screens when the app sets its own scheme (only the one that asked
  // repaints), so the scheme travels with the choice and every screen follows at once
  const scheme: Scheme = choice === 'system' ? (device === 'dark' ? 'dark' : 'light') : choice
  const value = useMemo(() => ({ choice, setChoice, scheme }), [choice, setChoice, scheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

/** Light or dark as the person chose it; outside the provider, the phone's own. */
export function useScheme(): Scheme {
  const value = useContext(ThemeContext)
  const device = useColorScheme()
  return value?.scheme ?? (device === 'dark' ? 'dark' : 'light')
}
