import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { getLocales } from 'expo-localization'
import type { Locale as DateLocale } from 'date-fns'
import {
  DATE_LOCALES,
  fmt,
  isLocale,
  LOCALE_TAGS,
  messages,
  plural as pluralize,
  type Locale,
  type Messages,
  type Plural
} from '@hellokido/core/i18n'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { readSetting, writeSetting } from '../lib/storage'

const STORAGE_KEY = 'language'

// First start follows the phone's language when the panel speaks it; Turkish otherwise
function startLocale(): Locale {
  const saved = readSetting(STORAGE_KEY)
  if (isLocale(saved)) return saved
  const device = getLocales()[0]?.languageCode
  return isLocale(device) ? device : 'tr'
}

type DateInput = Date | string | number

export type I18n = {
  locale: Locale
  /** BCP 47 tag of the locale: tr-TR, en-GB, uk-UA */
  tag: string
  t: Messages
  dateLocale: DateLocale
  setLocale: (next: Locale) => void
  fmt: typeof fmt
  plural: (forms: Plural, count: number, vars?: Record<string, string | number>) => string
  /** Localized date and time; dates follow the language, amounts never do. */
  date: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string
  /** Amounts are always written the Turkish way (13.850 ₺) so nobody reads them 1000x off. */
  money: (value: number | string | null | undefined) => string
}

const I18nContext = createContext<I18n | null>(null)

const formatters = new Map<string, Intl.DateTimeFormat>()

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(startLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeSetting(STORAGE_KEY, next)
  }, [])

  const value = useMemo<I18n>(() => {
    const tag = LOCALE_TAGS[locale]
    return {
      locale,
      tag,
      t: messages[locale],
      dateLocale: DATE_LOCALES[locale],
      setLocale,
      fmt,
      plural: (forms, count, vars) => pluralize(locale, forms, count, vars),
      date: (input, options = { day: 'numeric', month: 'long', year: 'numeric' }) => {
        const day = input instanceof Date ? input : new Date(input)
        if (Number.isNaN(day.getTime())) return ''
        const key = tag + JSON.stringify(options)
        let formatter = formatters.get(key)
        if (!formatter) {
          formatter = new Intl.DateTimeFormat(tag, options)
          formatters.set(key, formatter)
        }
        return formatter.format(day)
      },
      // A no-break space: "₺" never wraps away from its number in a sentence
      money: (amount) => `${formatMoney(Number(amount) || 0)} ₺`
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
