import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nProvider as AriaI18nProvider } from 'react-aria-components'
import type { Locale as DateLocale } from 'date-fns'
import {
  messages,
  LOCALE_TAGS,
  DATE_LOCALES,
  isLocale,
  fmt,
  plural as pluralize,
  type Locale,
  type Messages,
  type Plural
} from '@hellokido/core/i18n'
import { formatMoney } from '@hellokido/core/rules/money.js'

const STORAGE_KEY = 'language'

/** The saved interface language (also read outside the provider, e.g. by the error screen). */
export function readSavedLocale(): Locale {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : 'tr'
  } catch {
    return 'tr'
  }
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
  const [locale, setLocaleState] = useState<Locale>(readSavedLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts for this visit
    }
  }, [])

  useEffect(() => {
    // Needed so CSS text-transform and screen readers treat i/İ correctly
    document.documentElement.lang = locale
  }, [locale])

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
        const d = input instanceof Date ? input : new Date(input)
        if (Number.isNaN(d.getTime())) return ''
        const key = tag + JSON.stringify(options)
        let formatter = formatters.get(key)
        if (!formatter) {
          formatter = new Intl.DateTimeFormat(tag, options)
          formatters.set(key, formatter)
        }
        return formatter.format(d)
      },
      money: (amount) => `${formatMoney(Number(amount) || 0)} ₺`
    }
  }, [locale, setLocale])

  return (
    <I18nContext.Provider value={value}>
      <AriaI18nProvider locale={value.tag}>{children}</AriaI18nProvider>
    </I18nContext.Provider>
  )
}

export function useI18n(): I18n {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
