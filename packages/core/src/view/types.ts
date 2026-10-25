import type { fmt, Messages, Plural } from '../i18n'

/** What the shared screen helpers need from an app's language provider (web panel and phone app). */
export type ViewI18n = {
  t: Messages
  fmt: typeof fmt
  plural: (forms: Plural, count: number, vars?: Record<string, string | number>) => string
  /** Localized date and time in the interface language. */
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
}
