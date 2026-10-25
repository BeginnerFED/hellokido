import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salaryRows } from '@hellokido/core/api'
import { payoutsOf, periodRule, type Payouts } from '@hellokido/core/view'
import { keys, useCatalog } from '../../data/queries'

const NONE: Payouts = { paydays: [], ids: new Set() }

/**
 * How money periods are cut: by the salary pay-outs found in the expenses, by the start day of
 * Settings only while there are none. Undefined until both are known, so a page never shows a
 * wrong period first; `payouts` are the salary rows that shared out a period.
 */
export function usePeriodRule(today: Date) {
  const catalog = useCatalog()
  const salaries = useQuery({ queryKey: keys.finance('salaries'), queryFn: salaryRows })
  const startDay = catalog.data?.settings.moneyPeriodStartDay ?? (catalog.isError ? 1 : undefined)
  const found = useMemo(() => (salaries.data ? payoutsOf(salaries.data) : salaries.isError ? NONE : undefined), [salaries.data, salaries.isError])
  const rule = useMemo(() => (found && startDay !== undefined ? periodRule(found.paydays, startDay, today) : undefined), [found, startDay, today])
  return { rule, payouts: found?.ids }
}
