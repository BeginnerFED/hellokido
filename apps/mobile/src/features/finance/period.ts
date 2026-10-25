import { useSyncExternalStore } from 'react'
import { isSameDay, subDays } from 'date-fns'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { cycleOf, formatPeriod, isMonthLong, samePeriod, type Period, type PeriodRule } from '@hellokido/core/view'
import type { I18n } from '../../providers/I18n'

export type Preset = 'thisPeriod' | 'lastPeriod' | 'last14' | 'today'

export const PRESETS: Preset[] = ['thisPeriod', 'lastPeriod', 'last14', 'today']

/** Periods are calendar months only when no salary pay-out cuts them and they start on the 1st. */
export const inMonths = (rule: PeriodRule) => rule.paydays.length === 0 && rule.startDay === 1

/** Presets start from today's midnight; this period runs from the day after the last salaries. */
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

/** "this period" and "last period", or months when periods are calendar months. */
export function presetName(t: I18n['t'], preset: Preset, rule: PeriodRule) {
  const months = inMonths(rule)
  if (preset === 'thisPeriod') return months ? t.finance.period.thisMonth : t.finance.period.thisPeriod
  if (preset === 'lastPeriod') return months ? t.finance.period.lastMonth : t.finance.period.lastPeriod
  return t.finance.period[preset]
}

/** "Ekim 2026" for a calendar month, "12 Eki – 11 Kas" for a money period, the weekday for one day. */
export function periodName(i18n: Pick<I18n, 'date'>, period: Period) {
  if (isMonthLong(period) && period.start.getDate() === 1) return upperFirst(i18n.date(period.start, { month: 'long', year: 'numeric' }))
  if (isSameDay(period.start, period.end)) return upperFirst(i18n.date(period.start, { weekday: 'long', day: 'numeric', month: 'long' }))
  return formatPeriod(i18n, period.start, period.end)
}

// The period picked on the Finance tab, shared with the sheet that picks dates. null follows the
// period that holds today, so a phone left open into the next period moves along with it.
let chosen: Period | null = null
const listeners = new Set<() => void>()

export function choosePeriod(next: Period | null) {
  chosen = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useChosenPeriod = () => useSyncExternalStore(subscribe, () => chosen)
