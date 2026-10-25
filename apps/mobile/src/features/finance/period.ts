import { useSyncExternalStore } from 'react'
import { isSameDay, subDays } from 'date-fns'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { cycleOf, formatPeriod, isMonthLong, samePeriod, type Period } from '@hellokido/core/view'
import type { I18n } from '../../providers/I18n'

export type Preset = 'thisPeriod' | 'lastPeriod' | 'last14' | 'today'

export const PRESETS: Preset[] = ['thisPeriod', 'lastPeriod', 'last14', 'today']

/** Presets start from today's midnight; the period is the money period of Settings. */
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

/** "this period" and "last period", or months when periods are calendar months. */
export function presetName(t: I18n['t'], preset: Preset, startDay: number) {
  if (preset === 'thisPeriod') return startDay === 1 ? t.finance.period.thisMonth : t.finance.period.thisPeriod
  if (preset === 'lastPeriod') return startDay === 1 ? t.finance.period.lastMonth : t.finance.period.lastPeriod
  return t.finance.period[preset]
}

/** "Ekim 2026" for a calendar month, "10 Eki – 9 Kas" for any other period, the weekday for one day. */
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
