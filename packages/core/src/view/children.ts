import { differenceInCalendarDays } from 'date-fns'
import { remainingTone, type Registration, type Usage } from '../api'
import { getPeriodTypeHint, periodDays } from '../rules/packagePeriod.js'
import { phoneDigits } from '../rules/phone.js'
import { matchesSearch } from '../rules/text.js'

export const FREE = 'ucretsiz'

export const isFree = (row: Pick<Registration, 'package_type'>) => row.package_type === FREE

/** The current period has not been paid (free participation never waits for a payment). */
export const isPaymentDue = (row: Pick<Registration, 'is_active' | 'package_type' | 'payment_status'>) =>
  row.is_active === true && !isFree(row) && row.payment_status === 'beklemede'

/** Calendar days until the package's last day; negative once it has ended, null for free participation. */
export function daysLeft(row: Pick<Registration, 'package_type' | 'package_end_date'>, now = new Date()) {
  if (isFree(row) || !row.package_end_date) return null
  return differenceInCalendarDays(new Date(row.package_end_date), now)
}

/** Ended or ending within a week: the package needs renewing (end days are stored at the start of the day). */
export const ENDING_WINDOW_DAYS = 7
export function isEnding(row: Registration, now = new Date()) {
  const days = daysLeft(row, now)
  return row.is_active === true && days !== null && days <= ENDING_WINDOW_DAYS
}

/** Two lessons or fewer left, or none. */
export function isRunningLow(usage: Usage | undefined) {
  const tone = remainingTone(usage)
  return tone === 'low' || tone === 'out'
}

const PHONE_LIKE = /^[\d\s+()-]+$/

/**
 * Child or parent name in any spelling (İ/i, ş/s…); a term made only of digits and phone signs also
 * finds the number anywhere in the parent's phone ("0532 123").
 */
export function matchesChild(row: Pick<Registration, 'student_name' | 'parent_name' | 'parent_phone'>, term: string) {
  if (!term.trim()) return true
  if (matchesSearch(row.student_name, term) || matchesSearch(row.parent_name, term)) return true
  if (!PHONE_LIKE.test(term)) return false
  const digits = phoneDigits(term)
  return digits !== '' && phoneDigits(row.parent_phone).includes(digits)
}

export const byName = (a: Pick<Registration, 'student_name'>, b: Pick<Registration, 'student_name'>) =>
  a.student_name.localeCompare(b.student_name, 'tr')

export type DateRange = { start: Date; end: Date }

/**
 * A soft warning when the period does not fit the package (a 40-day "3 months", a 60-day "monthly").
 * The thresholds live in the period rules; this only picks the translated sentence.
 */
export function periodHint(type: string | null, range: DateRange | null) {
  if (!type || !range || !getPeriodTypeHint(type, range.start, range.end)) return null
  const days = periodDays(range.start, range.end)
  const key = type === 'tek-seferlik' ? 'hintSingle' : type.startsWith('hafta-') ? 'hintMonthly' : 'hintQuarter'
  return { key, days } as const
}

export const sameInstant = (a: Date | string | null | undefined, b: Date | string | null | undefined) => {
  if (!a || !b) return !a && !b
  return new Date(a).getTime() === new Date(b).getTime()
}

/** A day stored as 'yyyy-MM-dd', read back as local midnight. */
export const fromDateKey = (key: string | null | undefined) => {
  if (!key) return null
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
