import type { I18n } from '../../providers/I18n'

const formatters = new Map<string, Intl.DateTimeFormat>()

/** "21–27 Eki 2026", "28 Eki – 3 Kas": the locale decides what the two dates share. */
export function dateRange(i18n: Pick<I18n, 'tag'>, start: Date, endInclusive: Date, options: Intl.DateTimeFormatOptions) {
  const key = i18n.tag + JSON.stringify(options)
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(i18n.tag, options)
    formatters.set(key, formatter)
  }
  return formatter.formatRange(start, endInclusive)
}
