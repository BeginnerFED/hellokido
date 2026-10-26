import { remainingTone, type Registration, type Usage } from '../api'
import { phoneDigits } from '../rules/phone.js'
import { matchesSearch } from '../rules/text.js'

export const FREE = 'ucretsiz'

export const isFree = (row: Pick<Registration, 'package_type'>) => row.package_type === FREE

/** The current period has not been paid (free participation never waits for a payment). */
export const isPaymentDue = (row: Pick<Registration, 'is_active' | 'package_type' | 'payment_status'>) =>
  row.is_active === true && !isFree(row) && row.payment_status === 'beklemede'

/** Two lessons or fewer left, or none. */
export function isRunningLow(usage: Usage | undefined) {
  const tone = remainingTone(usage)
  return tone === 'low' || tone === 'out'
}

/**
 * The package needs renewing: its lessons are running out or gone. The period's end day does not
 * decide it; families often come later than planned, so the lessons left are what the workshop
 * goes by. A package not yet touched is not running out however small it is (a single session
 * waits for its day), and free participation never ends.
 */
export function needsRenewal(row: Pick<Registration, 'is_active' | 'package_type'>, usage: Usage | undefined) {
  if (row.is_active !== true || isFree(row) || !usage || usage.isFree) return false
  const remaining = usage.remaining ?? 0
  return remaining <= 0 || (isRunningLow(usage) && remaining < (usage.total ?? 0))
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
