import { differenceInCalendarDays, format, isSameDay, isValid, parse, startOfDay, subDays } from 'date-fns'
import { cycleOf, isMonthLong, samePeriod, type Period, type PeriodRule } from '@hellokido/core/view'
import type { I18n } from '../../providers/I18n'
import { dateRange } from '../calendar/labels'

export { boundsOf, dueDayInPeriod, inPeriod, isCycle, isMonthLong, samePeriod, stepPeriod, type Period, type PeriodRule } from '@hellokido/core/view'

export type Preset = 'thisPeriod' | 'lastPeriod' | 'last14' | 'today'

export const PRESETS: Preset[] = ['thisPeriod', 'lastPeriod', 'last14', 'today']

/** Periods are calendar months only when no salary pay-out cuts them and they start on the 1st. */
export const inMonths = (rule: PeriodRule) => rule.paydays.length === 0 && rule.startDay === 1

/**
 * Presets are built from the start of today: a range starting "now" missed today's payments. This
 * period runs from the day after the last salary pay-out (12 Oct when salaries were paid on 11 Oct).
 */
export function presetPeriod(preset: Preset, today: Date, rule: PeriodRule): Period {
  switch (preset) {
    case 'thisPeriod':
      return cycleOf(today, rule)
    case 'lastPeriod':
      return cycleOf(subDays(cycleOf(today, rule).start, 1), rule)
    case 'last14':
      return { start: subDays(today, 13), end: today }
    case 'today':
      return { start: today, end: today }
  }
}

export const matchPreset = (period: Period, today: Date, rule: PeriodRule) =>
  PRESETS.find((preset) => samePeriod(presetPeriod(preset, today, rule), period)) ?? null

const KEY = 'yyyy-MM-dd'

const readDay = (value: string | null) => {
  if (!value) return null
  const day = parse(value, KEY, new Date())
  return isValid(day) ? startOfDay(day) : null
}

/** The period in the address (?from=&to=); the current money period when it is missing or makes no sense. */
export function readPeriod(params: URLSearchParams, today: Date, rule: number | PeriodRule): Period {
  const start = readDay(params.get('from'))
  const end = readDay(params.get('to'))
  if (!start || !end || end < start || differenceInCalendarDays(end, start) > 3660) return cycleOf(today, rule)
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
export const presetName = (t: I18n['t'], preset: Preset, rule: PeriodRule) => {
  const months = inMonths(rule)
  if (preset === 'thisPeriod') return months ? t.finance.period.thisMonth : t.finance.period.thisPeriod
  if (preset === 'lastPeriod') return months ? t.finance.period.lastMonth : t.finance.period.lastPeriod
  return t.finance.period[preset]
}
