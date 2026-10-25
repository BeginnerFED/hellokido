import { isValid, parseISO } from 'date-fns'
import type { WaitlistEntry } from '../api'
import { phoneDigits } from '../rules/phone.js'
import { matchesSearch } from '../rules/text.js'

export const WAITING = 'beklemede'
export const CONTACTED = 'iletisime-gecildi'
export type WaitStatus = typeof WAITING | typeof CONTACTED
/** "Not decided yet": a package the waitlist knows but a registration does not. */
export const UNDECIDED = 'belirsiz'

/** contact_date is a plain day; parseISO reads it as local midnight, new Date() would read UTC. */
export function askedOn(entry: Pick<WaitlistEntry, 'contact_date'>) {
  const day = parseISO(entry.contact_date)
  return isValid(day) ? day : null
}

/** Whoever asked first is first in the queue. */
export function byQueue(a: WaitlistEntry, b: WaitlistEntry) {
  return a.contact_date.localeCompare(b.contact_date) || (a.created_at ?? '').localeCompare(b.created_at ?? '')
}

/** Child or parent by name; a term made of phone characters also finds the number ("0532 123"). */
export function matchesEntry(entry: WaitlistEntry, query: string) {
  const term = query.trim()
  if (!term) return true
  const digits = /^[\d\s+()-]+$/.test(term) ? phoneDigits(term) : ''
  return matchesSearch(entry.student_name, term) || matchesSearch(entry.parent_name, term) || (digits !== '' && phoneDigits(entry.parent_phone).includes(digits))
}
