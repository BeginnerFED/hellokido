import { differenceInCalendarDays, format, isSameDay, isValid, parse, startOfDay, subDays } from 'date-fns'
import { cycleOf, isMonthLong, samePeriod, type Period } from '@hellokido/core/view'
import type { I18n } from '../../providers/I18n'
import { dateRange } from '../calendar/labels'

export { boundsOf, dueDayInPeriod, inPeriod, isMonthLong, samePeriod, stepPeriod, type Period } from '@hellokido/core/view'

export type Preset = 'thisPeriod' | 'lastPeriod' | 'last14' | 'today'

export const PRESETS: Preset[] = ['thisPeriod', 'lastPeriod', 'last14', 'today']

/**
 * Presets are built from the start of today: a range starting "now" missed today's payments. The
 * period is the money period of Settings (10 Oct – 9 Nov when it starts on the 10th), a calendar
 * month when it starts on the 1st.
 */
export function presetPeriod(preset: Preset, today: Date, startDay: number): Period {
  switch (preset) {
    case 'thisPeriod':
      return cycleOf(today, startDay)
    case 'lastPeriod':
      return cycleOf(subDays(cycleOf(today, startDay).start, 1), startDay)
    case 'last14':
      return { start: subDays(today, 13), end: today }
    case 'today':
      return { start: today, end: today }
  }
}

export const matchPreset = (period: Period, today: Date, startDay: number) =>
  PRESETS.find((preset) => samePeriod(presetPeriod(preset, today, startDay), period)) ?? null

const KEY = 'yyyy-MM-dd'

const readDay = (value: string | null) => {
  if (!value) return null
  const day = parse(value, KEY, new Date())
  return isValid(day) ? startOfDay(day) : null
}

/** The period in the address (?from=&to=); the current money period when it is missing or makes no sense. */
export function readPeriod(params: URLSearchParams, today: Date, startDay: number): Period {
  const start = readDay(params.get('from'))
  const end = readDay(params.get('to'))
  if (!start || !end || end < start || differenceInCalendarDays(end, start) > 3660) return cycleOf(today, startDay)
  return { start, end }
}

export const periodParams = ({ start, end }: Period) => ({ from: format(start, KEY), to: format(end, KEY) })

/** A calendar month by its name ("Ekim 2026"); any other period by its first and last day. */
export function periodLabel(i18n: Pick<I18n, 'date' | 'tag'>, period: Period) {
  if (isMonthLong(period) && period.start.getDate() === 1) return i18n.date(period.start, { month: 'long', year: 'numeric' })
  if (isSameDay(period.start, period.end)) return i18n.date(period.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return dateRange(i18n, period.start, period.end, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The words for "this period" and "last period": months when periods are calendar months. */
export const presetName = (t: I18n['t'], preset: Preset, startDay: number) => {
  if (preset === 'thisPeriod') return startDay === 1 ? t.finance.period.thisMonth : t.finance.period.thisPeriod
  if (preset === 'lastPeriod') return startDay === 1 ? t.finance.period.lastMonth : t.finance.period.lastPeriod
  return t.finance.period[preset]
}
