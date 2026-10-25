import { addDays, addMonths, differenceInCalendarDays, endOfDay, endOfMonth, isSameDay, max, startOfDay } from 'date-fns'

/** Whole days: `start` and `end` are local midnights and both days count. */
export type Period = { start: Date; end: Date }

/** The first day of a money period (Settings › Money period), 1 to 28; 1 gives calendar months. */
export const clampStartDay = (day: number) => (Number.isFinite(day) ? Math.min(Math.max(Math.round(day), 1), 28) : 1)

/**
 * How money periods are cut. The workshop closes a period by paying out salaries from what is left:
 * a pay-out day is the last day of one period and the next starts the day after ("16.08–10.09").
 * Before the first pay-out periods run back a month at a time from it; with no pay-out at all they
 * start on `startDay` of each month.
 */
export type PeriodRule = {
  /** Pay-out days, local midnights, oldest first. */
  paydays: Date[]
  startDay: number
  /** The last day of the open period after the last pay-out: a month on, or today while salaries are late. */
  openUntil: Date | null
}

export function periodRule(paydays: Date[], startDay: number, today: Date): PeriodRule {
  const last = paydays.at(-1)
  return { paydays, startDay: clampStartDay(startDay), openUntil: last ? max([addMonths(last, 1), startOfDay(today)]) : null }
}

/** A month from the start day of `day`'s month (of the month before when `day` comes earlier): 10 Oct – 9 Nov. */
function monthCycle(day: Date, startDay: number): Period {
  const first = clampStartDay(startDay)
  const start = new Date(day.getFullYear(), day.getMonth() - (day.getDate() < first ? 1 : 0), first)
  return { start, end: addDays(new Date(start.getFullYear(), start.getMonth() + 1, first), -1) }
}

/** The money period that holds `day`, by pay-outs (a rule) or by a start day of the month (a number). */
export function cycleOf(day: Date, rule: number | PeriodRule): Period {
  if (typeof rule === 'number') return monthCycle(day, rule)
  const { paydays } = rule
  if (!paydays.length) return monthCycle(day, rule.startDay)
  const at = startOfDay(day)
  const next = paydays.findIndex((payday) => payday >= at)
  if (next > 0) return { start: addDays(paydays[next - 1], 1), end: paydays[next] }
  if (next === 0) {
    let back = 0
    while (addMonths(paydays[0], -(back + 1)) >= at) back += 1
    return { start: addDays(addMonths(paydays[0], -(back + 1)), 1), end: addMonths(paydays[0], -back) }
  }
  const last = paydays[paydays.length - 1]
  const open = rule.openUntil ?? addMonths(last, 1)
  if (at <= open) return { start: addDays(last, 1), end: open }
  let ahead = 1
  while (addMonths(open, ahead) < at) ahead += 1
  return { start: addDays(addMonths(open, ahead - 1), 1), end: addMonths(open, ahead) }
}

/** The period after the last pay-out, whose money is still to be shared; null without pay-outs. */
export const openPeriod = (rule: PeriodRule): Period | null => {
  const last = rule.paydays.at(-1)
  return last ? cycleOf(addDays(last, 1), rule) : null
}

export const samePeriod = (a: Period, b: Period) => isSameDay(a.start, b.start) && isSameDay(a.end, b.end)

/** Whether a range is one whole money period of the rule. */
export const isCycle = (period: Period, rule: number | PeriodRule) => samePeriod(cycleOf(period.start, rule), period)

/** One month from a start day to the day before it comes again, whatever the setting says: 1–31 Oct, 10 Oct – 9 Nov. */
export const isMonthLong = (period: Period) => period.start.getDate() <= 28 && samePeriod(monthCycle(period.start, period.start.getDate()), period)

/**
 * The period before or after: a money period of the rule steps to its neighbour, a month-long range
 * by months, any other range by its own length.
 */
export function stepPeriod(period: Period, direction: 1 | -1, rule?: number | PeriodRule): Period {
  if (rule !== undefined && isCycle(period, rule)) return cycleOf(direction < 0 ? addDays(period.start, -1) : addDays(period.end, 1), rule)
  if (isMonthLong(period)) return monthCycle(addMonths(period.start, direction), period.start.getDate())
  const days = (differenceInCalendarDays(period.end, period.start) + 1) * direction
  return { start: addDays(period.start, days), end: addDays(period.end, days) }
}

/** The last `count` money periods, oldest first, up to the one that holds `today`. */
export function cyclesUpTo(today: Date, rule: number | PeriodRule, count: number): Period[] {
  const list = [cycleOf(today, rule)]
  while (list.length < count) list.unshift(cycleOf(addDays(list[0].start, -1), rule))
  return list
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
 * The day a monthly expense falls on inside a period: the 5th of 12 Oct – 11 Nov is 5 Nov, the 15th
 * is 15 Oct. A period of any other length uses its first month.
 */
export function dueDayInPeriod(period: Period, dayOfMonth: number) {
  const first = dueDayIn(period.start, dayOfMonth)
  return first < startOfDay(period.start) ? dueDayIn(addMonths(period.start, 1), dayOfMonth) : first
}
