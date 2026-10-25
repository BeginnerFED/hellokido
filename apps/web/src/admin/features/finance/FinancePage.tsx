import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CoinsIcon, HandCoinsIcon, PlusIcon } from '@phosphor-icons/react'
import { expensesBetween, incomeBetween } from '@hellokido/core/api'
import { keys, useCatalog } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Button } from '../../ui/Button'
import { Menu, MenuItem } from '../../ui/Menu'
import { Page } from '../../ui/Page'
import { useMediaQuery, useWideLayout } from '../../ui/useMediaQuery'
import { useClock } from '../today/clock'
import { Balance } from './Balance'
import { CategoriesSection } from './Categories'
import { ExpectedSection } from './Expected'
import { MonthlySection } from './Monthly'
import { MonthsChart } from './MonthsChart'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { arrivalOf, OnTheWaySection } from './OnTheWay'
import { PeriodNav } from './PeriodNav'
import { boundsOf, isWholeMonth, monthOf, periodParams, readPeriod, samePeriod, type Period } from './period'
import { useShowRange } from './visible'

const MOVES_ID = 'finance-moves'
const ON_THE_WAY_ID = 'finance-on-the-way'

/**
 * Money in and out of a period (this month unless another is chosen), the list behind it, and what
 * is still to come: expected payments, card money on its way to the bank and the month's fixed
 * expenses. The period lives in the address, so a month can be bookmarked or sent.
 */
export default function FinancePage() {
  const i18n = useI18n()
  const { t } = i18n
  const { startTask } = useActions()
  const wide = useWideLayout()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const [params, setParams] = useSearchParams()
  const period = useMemo(() => readPeriod(params, today), [params, today])
  const bounds = useMemo(() => boundsOf(period), [period])
  const visible = useMemo(() => ({ from: bounds.from.toISOString(), to: bounds.to.toISOString() }), [bounds])
  useShowRange(visible)
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)

  const income = useQuery({
    queryKey: keys.finance('income', visible.from, visible.to),
    queryFn: () => incomeBetween(bounds.from, bounds.to),
    placeholderData: keepPreviousData
  })
  const expenses = useQuery({
    queryKey: keys.finance('expenses', visible.from, visible.to),
    queryFn: () => expensesBetween(bounds.from, bounds.to),
    placeholderData: keepPreviousData
  })
  const waiting = income.isPlaceholderData || expenses.isPlaceholderData
  const failed = income.isError || expenses.isError
  const retry = () => {
    void income.refetch()
    void expenses.refetch()
  }

  const days = useCatalog().data?.settings.cardSettlementDays ?? 30
  const onTheWay = useMemo(
    () =>
      (income.data ?? [])
        .filter((line) => line.method === 'kart' && line.paymentDate && arrivalOf(line.paymentDate, days) >= today)
        .reduce((sum, line) => sum + line.amount, 0),
    [income.data, days, today]
  )

  // The current month keeps a clean address; any other period is written into it
  const go = useCallback(
    (next: Period) => setParams(samePeriod(next, monthOf(today)) ? {} : periodParams(next), { replace: true }),
    [setParams, today]
  )

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  const pickCategory = (code: string) => {
    setFilter({ ...NO_FILTER, kind: 'out', type: code })
    requestAnimationFrame(() => scrollTo(MOVES_ID))
  }

  const addExpense = () => startTask('expense', { visible })
  const toolbar = (
    <>
      <Menu
        label={t.finance.addIncome}
        placement="bottom end"
        trigger={
          <Button variant="secondary" icon={<CoinsIcon aria-hidden className="size-[1.125rem]" />} className="max-lg:flex-1">
            {t.finance.addIncome}
          </Button>
        }
      >
        <MenuItem icon={<HandCoinsIcon aria-hidden className="size-[1.125rem]" />} onAction={() => startTask('payment')}>
          {t.finance.childPayment}
        </MenuItem>
        <MenuItem icon={<CoinsIcon aria-hidden className="size-[1.125rem]" />} onAction={() => startTask('income', { kind: 'other' })}>
          {t.finance.otherIncome}
        </MenuItem>
      </Menu>
      <Button variant="primary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={addExpense} className="flex-1 lg:hidden">
        {t.finance.addExpense}
      </Button>
    </>
  )

  const balance = (
    <Balance
      income={failed ? undefined : income.data}
      expenses={failed ? undefined : expenses.data}
      isError={failed}
      waiting={waiting}
      onRetry={retry}
      onTheWay={waiting ? 0 : onTheWay}
      onShowOnTheWay={() => scrollTo(ON_THE_WAY_ID)}
      className={wide ? undefined : 'rounded-panel border border-line bg-surface p-5'}
    />
  )
  const chart = <MonthsChart today={today} period={period} onPick={(month) => go(monthOf(month))} />
  const moves = (
    <MovesSection
      key={`${visible.from}/${visible.to}`}
      id={MOVES_ID}
      income={failed ? undefined : income.data}
      expenses={failed ? undefined : expenses.data}
      isError={failed}
      waiting={waiting}
      onRetry={retry}
      filter={filter}
      onFilter={setFilter}
      visible={visible}
    />
  )
  const monthly = isWholeMonth(period) && (
    <MonthlySection month={period.start} expenses={waiting ? undefined : expenses.data} waiting={waiting} today={today} visible={visible} />
  )
  const expected = <ExpectedSection todayKey={dayKey} />
  const cards = <OnTheWaySection id={ON_THE_WAY_ID} today={today} />
  const categories = <CategoriesSection expenses={failed ? undefined : expenses.data} waiting={waiting} onPick={pickCategory} />

  return (
    <Page title={t.shell.nav.finance} toolbar={toolbar} action={{ label: t.finance.addExpense, onPress: addExpense }} width="wide">
      <PeriodNav period={period} today={today} onChange={go} />
      {wide ? (
        <>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] overflow-hidden rounded-panel border border-line bg-surface">
            <div className="min-w-0 p-6">{balance}</div>
            <div className="min-w-0 border-l border-line p-6">{chart}</div>
          </div>
          <div className="mt-6 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-6">
            {moves}
            <div className="flex min-w-0 flex-col gap-6">
              {monthly}
              {expected}
              {cards}
              {categories}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {balance}
          {monthly}
          {moves}
          {expected}
          {cards}
          {categories}
          <div className="rounded-panel border border-line bg-surface p-5">{chart}</div>
        </div>
      )}
    </Page>
  )
}
