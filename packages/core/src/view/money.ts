import { addDays, format, startOfDay } from 'date-fns'
import { cycleOf, cyclesUpTo, inPeriod, type Period } from './period'

type Dated = { date: string; amount: number }
/** Daily amounts, as moneySince reads them: income by payment day, expenses by expense day. */
export type MoneySeries = { income: Dated[]; expenses: Dated[] }
export type Totals = { in: number; out: number }

/** Money in and out of a period from a series that starts on `first`; null when it does not reach back that far. */
export function totalsOf(series: MoneySeries | undefined, first: Date | null, period: Period): Totals | null {
  if (!series || !first || period.start < first) return null
  const sum = (rows: Dated[]) => rows.reduce((total, row) => (inPeriod(period, new Date(row.date)) ? total + row.amount : total), 0)
  return { in: sum(series.income), out: sum(series.expenses) }
}

/**
 * Money in and out of each of the last `count` money periods, oldest first. Rows go to the period
 * that holds their day; counting back from today skipped months on the 29th–31st.
 */
export function periodTotals(series: MoneySeries | undefined, today: Date, startDay: number, count: number) {
  const list = cyclesUpTo(today, startDay, count).map((period) => ({ period, key: format(period.start, 'yyyy-MM-dd'), in: 0, out: 0 }))
  const byKey = new Map(list.map((bucket) => [bucket.key, bucket]))
  const keyOf = (day: string) => format(cycleOf(new Date(day), startDay).start, 'yyyy-MM-dd')
  for (const row of series?.income ?? []) {
    const bucket = byKey.get(keyOf(row.date))
    if (bucket) bucket.in += row.amount
  }
  for (const row of series?.expenses ?? []) {
    const bucket = byKey.get(keyOf(row.date))
    if (bucket) bucket.out += row.amount
  }
  return list
}

/** The day card money taken on `paymentDate` reaches the bank, `days` after (Settings › Card payments). */
export const arrivalOf = (paymentDate: string, days: number) => startOfDay(addDays(new Date(paymentDate), days))

/**
 * Grid lines for a money chart in round steps (1, 2, 2.5, 5 × 10ⁿ): three to five of them, the set
 * whose top line sits closest above the tallest bar, so the bars use the height they have.
 */
export function niceTicks(max: number) {
  if (max <= 0) return [0, 1000]
  const power = 10 ** Math.floor(Math.log10(max))
  let best = { step: power, top: Infinity }
  for (const step of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5].map((m) => m * power)) {
    const lines = Math.ceil(max / step - 1e-9)
    if (lines >= 3 && lines <= 5 && lines * step < best.top) best = { step, top: lines * step }
  }
  return Array.from({ length: Math.round(best.top / best.step) + 1 }, (_, index) => index * best.step)
}
