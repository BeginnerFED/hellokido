import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { cycleOf, cyclesUpTo, inPeriod, type Period, type PeriodRule } from './period'

type Dated = { date: string; amount: number; id?: string }
/** Daily amounts, as moneySince reads them: income by payment day, expenses by expense day. */
export type MoneySeries = { income: Dated[]; expenses: Dated[] }
/** Money in, money out, and the salaries paid out of what was left (not counted in `out`). */
export type Totals = { in: number; out: number; paid: number }

/** The founding partners, who share what is left of each period equally. */
export const PARTNERS = 2

/** The expense category of salaries. */
export const SALARY = 'maas'

export type SalaryRow = { id: string; date: string; amount: number }
export type Payouts = { paydays: Date[]; ids: Set<string> }

const shareEqually = (rows: SalaryRow[]) =>
  rows.some((a, index) => rows.some((b, other) => other > index && a.amount > 0 && Math.abs(a.amount - b.amount) <= 0.05 * Math.max(a.amount, b.amount)))

/**
 * Salary pay-outs, found in the salary expenses. The partners share what is left equally, so a
 * pay-out is salary rows within three days of each other holding two amounts within 5% of each
 * other (the bank part one day, the cash part the next); a lone salary, a part-time teacher or the
 * accountant, is an ordinary expense. A pay-out closes its period on its last day; one less than 20
 * days after the last is not a new period.
 */
export function payoutsOf(rows: SalaryRow[]): Payouts {
  const days = rows.map((row) => ({ row, day: startOfDay(new Date(row.date)) })).sort((a, b) => a.day.getTime() - b.day.getTime())
  const groups: (typeof days)[] = []
  for (const item of days) {
    const group = groups.at(-1)
    if (group && differenceInCalendarDays(item.day, group[group.length - 1].day) <= 3) group.push(item)
    else groups.push([item])
  }
  const paydays: Date[] = []
  const ids = new Set<string>()
  for (const group of groups) {
    if (!shareEqually(group.map((item) => item.row))) continue
    const day = group[group.length - 1].day
    const last = paydays.at(-1)
    if (last && differenceInCalendarDays(day, last) < 20) continue
    paydays.push(day)
    for (const item of group) ids.add(item.row.id)
  }
  return { paydays, ids }
}

/** Whether `period` is the one after the last pay-out, whose money is still to be shared. */
export const isOpen = (period: Period, rule: PeriodRule) => {
  const last = rule.paydays.at(-1)
  return !last || period.start > last
}

/** Money in and out of a period from a series that starts on `first`; null when it does not reach back that far. */
export function totalsOf(series: MoneySeries | undefined, first: Date | null, period: Period, payouts?: Set<string>): Totals | null {
  if (!series || !first || period.start < first) return null
  const totals = { in: 0, out: 0, paid: 0 }
  for (const row of series.income) if (inPeriod(period, new Date(row.date))) totals.in += row.amount
  for (const row of series.expenses) {
    if (!inPeriod(period, new Date(row.date))) continue
    if (row.id && payouts?.has(row.id)) totals.paid += row.amount
    else totals.out += row.amount
  }
  return totals
}

/**
 * Money in and out of each of the last `count` money periods, oldest first. Rows go to the period
 * that holds their day; salaries of a pay-out are kept apart from the other expenses.
 */
export function periodTotals(series: MoneySeries | undefined, today: Date, rule: number | PeriodRule, count: number, payouts?: Set<string>) {
  const list = cyclesUpTo(today, rule, count).map((period) => ({ period, key: format(period.start, 'yyyy-MM-dd'), in: 0, out: 0, paid: 0 }))
  const byKey = new Map(list.map((bucket) => [bucket.key, bucket]))
  const keyOf = (day: string) => format(cycleOf(new Date(day), rule).start, 'yyyy-MM-dd')
  for (const row of series?.income ?? []) {
    const bucket = byKey.get(keyOf(row.date))
    if (bucket) bucket.in += row.amount
  }
  for (const row of series?.expenses ?? []) {
    const bucket = byKey.get(keyOf(row.date))
    if (!bucket) continue
    if (row.id && payouts?.has(row.id)) bucket.paid += row.amount
    else bucket.out += row.amount
  }
  return list
}

/** Cash stays in the till; every other way of paying ends up in the bank account. */
export const placeOf = (method: string | null | undefined): 'cash' | 'bank' => (method === 'nakit' ? 'cash' : 'bank')

/** What is left of a period to share, by where the money is; salaries of a pay-out are left out. */
export function leftByPlace(income: { amount: number; method: string }[], expenses: { id: string; amount: number; payment_method: string | null }[], payouts?: Set<string>) {
  const left = { cash: 0, bank: 0 }
  for (const line of income) left[placeOf(line.method)] += line.amount
  for (const row of expenses) if (!payouts?.has(row.id)) left[placeOf(row.payment_method)] -= Number(row.amount) || 0
  return left
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
