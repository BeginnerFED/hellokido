import type { Usage } from '../api'
import type { ViewI18n } from './types'

/** "3 lessons left", "No lessons left" or "Free". */
export function remainingText(i18n: Pick<ViewI18n, 't' | 'plural'>, usage: Usage | undefined) {
  if (!usage) return ''
  if (usage.isFree) return i18n.t.children.free
  return lessonsLeftText(i18n, usage.remaining ?? 0)
}

/** "2 lessons left" or "No lessons left": how near a package is to its end. */
export function lessonsLeftText(i18n: Pick<ViewI18n, 't' | 'plural'>, remaining: number) {
  return remaining <= 0 ? i18n.t.children.noneLeft : i18n.plural(i18n.t.children.remaining, remaining)
}

/** "1 Oct – 31 Oct": the year shows only for another year, once unless the period crosses a year. */
export function formatPeriod(i18n: Pick<ViewI18n, 'date'>, start: string | Date | null | undefined, end: string | Date | null | undefined) {
  if (!start || !end) return ''
  const from = new Date(start)
  const to = new Date(end)
  // A single session starts and ends on the same day
  if (from.toDateString() === to.toDateString()) return shortDate(i18n, from)
  const thisYear = new Date().getFullYear()
  const short = { day: 'numeric', month: 'short' } as const
  const long = { day: 'numeric', month: 'short', year: 'numeric' } as const
  if (from.getFullYear() === thisYear && to.getFullYear() === thisYear) return `${i18n.date(from, short)} – ${i18n.date(to, short)}`
  const sameYear = from.getFullYear() === to.getFullYear()
  return `${i18n.date(from, sameYear ? short : long)} – ${i18n.date(to, long)}`
}

/**
 * "Start: 21 Oct": a package has a first day only. Families finish later than planned, so the last
 * day the database keeps is never shown. A single session shows just its day.
 */
export function packageStartText(i18n: Pick<ViewI18n, 't' | 'fmt' | 'date'>, start: string | Date | null | undefined, packageType?: string | null) {
  if (!start) return ''
  const day = shortDate(i18n, start)
  return packageType === 'tek-seferlik' ? day : i18n.fmt(i18n.t.children.detail.startsOn, { date: day })
}

/** "24 Oct", with the year only when it is not this year. */
export function shortDate(i18n: Pick<ViewI18n, 'date'>, value: string | Date) {
  const day = new Date(value)
  const thisYear = day.getFullYear() === new Date().getFullYear()
  return i18n.date(day, thisYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

/** What a screen reader hears for the bead string. */
export function beadsLabel(i18n: Pick<ViewI18n, 't' | 'fmt'>, usage: Usage) {
  return i18n.fmt(i18n.t.children.beads, {
    total: usage.total ?? 0,
    attended: usage.attended,
    absent: usage.noShow,
    unmarked: usage.unmarkedPast,
    booked: Math.max(usage.scheduled - usage.unmarkedPast, 0),
    remaining: usage.remaining ?? 0
  })
}
