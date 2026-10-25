import { differenceInCalendarDays } from 'date-fns'
import type { WaitlistEntry } from '@hellokido/core/api'
import { UNDECIDED } from '@hellokido/core/view'
import type { RegistrationPrefill } from '../children/RegistrationForm'

// The queue's rules are shared with the phone app
export { askedOn, byQueue, CONTACTED, matchesEntry, UNDECIDED, WAITING } from '@hellokido/core/view'
export type { WaitStatus } from '@hellokido/core/view'

/** "3 weeks ago", "yesterday", "today" in the screen's language. */
export function askedAgo(tag: string, day: Date, today = new Date()) {
  // A day typed in the future reads as today, never as "asked in 3 days"
  const days = Math.min(0, differenceInCalendarDays(day, today))
  const format = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' })
  const past = -days
  if (past < 7) return format.format(days, 'day')
  if (past < 30) return format.format(-Math.floor(past / 7), 'week')
  if (past < 365) return format.format(-Math.floor(past / 30), 'month')
  return format.format(-Math.floor(past / 365), 'year')
}

/** A registration that starts from what the family told us. */
export function prefillFrom(entry: WaitlistEntry): RegistrationPrefill {
  return {
    studentName: entry.student_name,
    age: entry.student_age,
    parentName: entry.parent_name,
    phone: entry.parent_phone,
    packageType: entry.package_type === UNDECIDED ? null : entry.package_type,
    note: entry.notes ?? ''
  }
}
