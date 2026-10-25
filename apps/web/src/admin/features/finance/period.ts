import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isLastDayOfMonth,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths
} from 'date-fns'
import type { I18n } from '../../providers/I18n'
import { dateRange } from '../calendar/labels'

/** Whole days: `start` and `end` are local midnights and both days count. */
export type Period = { start: Date; end: Date }
export type Preset = 'thisMonth' | 'lastMonth' | 'last14' | 'today'

export const PRESETS: Preset[] = ['thisMonth', 'lastMonth', 'last14', 'today']

export const monthOf = (day: Date): Period => ({ start: startOfMonth(day), end: startOfDay(endOfMonth(day)) })

export const isWholeMonth = ({ start, end }: Period) => start.getDate() === 1 && isSameMonth(start, end) && isLastDayOfMonth(end)

/** Presets are built from the start of today: a range starting "now" missed today's payments. */
export function presetPeriod(preset: Preset, today: Date): Period {
  switch (preset) {
    case 'thisMonth':
      return monthOf(today)
    case 'lastMonth':
      return monthOf(subMonths(today, 1))
    case 'last14':
      return { start: subDays(today, 13), end: today }
    case 'today':
      return { start: today, end: today }
  }
}

export const samePeriod = (a: Period, b: Period) => isSameDay(a.start, b.start) && isSameDay(a.end, b.end)

export const matchPreset = (period: Period, today: Date) => PRESETS.find((preset) => samePeriod(presetPeriod(preset, today), period)) ?? null

const KEY = 'yyyy-MM-dd'

const readDay = (value: string | null) => {
  if (!value) return null
  const day = parse(value, KEY, new Date())
  return isValid(day) ? startOfDay(day) : null
}

/** The period in the address (?from=&to=); the current month when it is missing or makes no sense. */
export function readPeriod(params: URLSearchParams, today: Date): Period {
  const start = readDay(params.get('from'))
  const end = readDay(params.get('to'))
  if (!start || !end || end < start || differenceInCalendarDays(end, start) > 3660) return monthOf(today)
  return { start, end }
}

export const periodParams = ({ start, end }: Period) => ({ from: format(start, KEY), to: format(end, KEY) })

/** The period before or after: a whole month steps by months, any other period by its own length. */
export function stepPeriod(period: Period, direction: 1 | -1): Period {
  if (isWholeMonth(period)) return monthOf(addMonths(period.start, direction))
  const days = (differenceInCalendarDays(period.end, period.start) + 1) * direction
  return { start: addDays(period.start, days), end: addDays(period.end, days) }
}

/** What the database is asked for: from the first day's start to the last day's end, both included. */
export const boundsOf = ({ start, end }: Period) => ({ from: startOfDay(start), to: endOfDay(end) })

export const inPeriod = (period: Period, when: Date) => when >= startOfDay(period.start) && when <= endOfDay(period.end)

export function periodLabel(i18n: Pick<I18n, 'date' | 'tag'>, period: Period) {
  if (isWholeMonth(period)) return i18n.date(period.start, { month: 'long', year: 'numeric' })
  if (isSameDay(period.start, period.end)) return i18n.date(period.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return dateRange(i18n, period.start, period.end, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The day a monthly expense falls on in a given month; the 31st becomes the last day of a short month. */
export function dueDayIn(month: Date, dayOfMonth: number) {
  const last = endOfMonth(month).getDate()
  return new Date(month.getFullYear(), month.getMonth(), Math.min(Math.max(dayOfMonth, 1), last))
}
