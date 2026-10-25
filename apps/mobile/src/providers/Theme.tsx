import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'
import { readSetting, writeSetting } from '../lib/storage'

export type ThemeChoice = 'light' | 'dark' | 'system'

// Same key as the web panel, so the choice reads the same everywhere it is stored
const STORAGE_KEY = 'hk-theme'

function savedChoice(): ThemeChoice {
  const value = readSetting(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

const apply = (choice: ThemeChoice) => Appearance.setColorScheme(choice === 'system' ? 'auto' : choice)

/** Before the first screen draws, so a dark choice never flashes light. */
export const applySavedTheme = () => apply(savedChoice())

type ThemeValue = { choice: ThemeChoice; setChoice: (next: ThemeChoice) => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(savedChoice)

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    writeSetting(STORAGE_KEY, next)
    apply(next)
  }, [])

  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
