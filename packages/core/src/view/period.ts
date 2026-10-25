import { addDays, addMonths, differenceInCalendarDays, endOfDay, endOfMonth, isSameDay, startOfDay } from 'date-fns'

/** Whole days: `start` and `end` are local midnights and both days count. */
export type Period = { start: Date; end: Date }

/** The first day of a money period (Settings › Money period), 1 to 28; 1 gives calendar months. */
export const clampStartDay = (day: number) => (Number.isFinite(day) ? Math.min(Math.max(Math.round(day), 1), 28) : 1)

/**
 * The money period that holds `day`: from the start day of its month (of the month before when
 * `day` comes earlier) to the day before the next start. Start day 10 gives 10 Oct – 9 Nov.
 */
export function cycleOf(day: Date, startDay: number): Period {
  const first = clampStartDay(startDay)
  const start = new Date(day.getFullYear(), day.getMonth() - (day.getDate() < first ? 1 : 0), first)
  return { start, end: addDays(new Date(start.getFullYear(), start.getMonth() + 1, first), -1) }
}

export const samePeriod = (a: Period, b: Period) => isSameDay(a.start, b.start) && isSameDay(a.end, b.end)

/** One month from a start day to the day before it comes again, whatever the setting says: 1–31 Oct, 10 Oct – 9 Nov. */
export const isMonthLong = (period: Period) => period.start.getDate() <= 28 && samePeriod(cycleOf(period.start, period.start.getDate()), period)

/** The period before or after: a month-long one steps by months, any other period by its own length. */
export function stepPeriod(period: Period, direction: 1 | -1): Period {
  if (isMonthLong(period)) return cycleOf(addMonths(period.start, direction), period.start.getDate())
  const days = (differenceInCalendarDays(period.end, period.start) + 1) * direction
  return { start: addDays(period.start, days), end: addDays(period.end, days) }
}

/** The last `count` money periods, oldest first, up to the one that holds `today`. */
export function cyclesUpTo(today: Date, startDay: number, count: number): Period[] {
  const current = cycleOf(today, startDay)
  return Array.from({ length: count }, (_, index) => cycleOf(addMonths(current.start, index - count + 1), startDay))
}

/** What the database is asked for: from the first day's start to the last day's end, both included. */
export const boundsOf = ({ start, end }: Period) => ({ from: startOfDay(start), to: endOfDay(end) })

export const inPeriod = (period: Period, when: Date) => when >= startOfDay(period.start) && when <= endOfDay(period.end)

/** The day a monthly expense falls on in a given month; the 31st becomes the last day of a short month. */
export function dueDayIn(month: Date, dayOfMonth: number) {
  const last = endOfMonth(month).getDate()
  return new Date(month.getFullYear(), month.getMonth(), Math.min(Math.max(dayOfMonth, 1), last))
}

/**
 * The day a monthly expense falls on inside a month-long period: the 5th of 10 Oct – 9 Nov is
 * 5 Nov, the 15th is 15 Oct. A period of any other length uses its first month.
 */
export function dueDayInPeriod(period: Period, dayOfMonth: number) {
  const first = dueDayIn(period.start, dayOfMonth)
  return first < startOfDay(period.start) ? dueDayIn(addMonths(period.start, 1), dayOfMonth) : first
}
