import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CoinsIcon, HandCoinsIcon, PlusIcon } from '@phosphor-icons/react'
import { expensesBetween, incomeBetween } from '@hellokido/core/api'
import { cycleOf, totalsOf } from '@hellokido/core/view'
import { keys, useCatalog } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Button } from '../../ui/Button'
import { Menu, MenuItem } from '../../ui/Menu'
import { Page } from '../../ui/Page'
import { useMediaQuery, useWideLayout } from '../../ui/useMediaQuery'
import { useClock } from '../today/clock'
import { CategoriesSection } from './Categories'
import { ExpectedSection } from './Expected'
import { MonthlySection } from './Monthly'
import { MonthsChart, useMoneySeries } from './MonthsChart'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { OnTheWaySection, useCardsOnTheWay } from './OnTheWay'
import { Overview } from './Overview'
import { PeriodNav } from './PeriodNav'
import { boundsOf, isMonthLong, periodParams, readPeriod, samePeriod, stepPeriod, type Period } from './period'
import { useShowRange } from './visible'

const MOVES_ID = 'finance-moves'
const ON_THE_WAY_ID = 'finance-on-the-way'

/**
 * Money in and out of a period (the money period that holds today unless another is chosen), the
 * list behind it, and what is still to come: expected payments, card money on its way to the bank
 * and the period's fixed expenses. The period lives in the address, so it can be bookmarked or sent.
 */
export default function FinancePage() {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { startTask } = useActions()
  const wide = useWideLayout()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const catalog = useCatalog()
  // Nothing is read until the start day is known, so the page never flashes the calendar month first
  const startDay = catalog.data?.settings.moneyPeriodStartDay ?? (catalog.isError ? 1 : undefined)
  const [params, setParams] = useSearchParams()
  const period = useMemo(() => readPeriod(params, today, startDay ?? 1), [params, today, startDay])
  const bounds = useMemo(() => boundsOf(period), [period])
  const visible = useMemo(() => ({ from: bounds.from.toISOString(), to: bounds.to.toISOString() }), [bounds])
  useShowRange(visible)
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)
  const ready = startDay !== undefined

  const income = useQuery({
    queryKey: keys.finance('income', visible.from, visible.to),
    queryFn: () => incomeBetween(bounds.from, bounds.to),
    enabled: ready,
    placeholderData: keepPreviousData
  })
  const expenses = useQuery({
    queryKey: keys.finance('expenses', visible.from, visible.to),
    queryFn: () => expensesBetween(bounds.from, bounds.to),
    enabled: ready,
    placeholderData: keepPreviousData
  })
  const series = useMoneySeries(today, startDay)
  const waiting = income.isPlaceholderData || expenses.isPlaceholderData
  const failed = income.isError || expenses.isError
  const retry = () => {
    void income.refetch()
    void expenses.refetch()
  }

  // The same card money as the "on the way" list below, so the figure and the list always agree
  const onTheWay = useCardsOnTheWay(today)
  const before = useMemo(() => totalsOf(series.data, series.first, stepPeriod(period, -1)), [series.data, series.first, period])

  // The current period keeps a clean address; any other period is written into it
  const go = useCallback(
    (next: Period) => setParams(samePeriod(next, cycleOf(today, startDay ?? 1)) ? {} : periodParams(next), { replace: true }),
    [setParams, today, startDay]
  )

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  const pickCategory = (code: string) => {
    setFilter({ ...NO_FILTER, kind: 'out', type: code })
    requestAnimationFrame(() => scrollTo(MOVES_ID))
  }
  const show = (what: 'in' | 'out' | 'bank') => {
    if (what !== 'bank') setFilter({ ...NO_FILTER, kind: what })
    requestAnimationFrame(() => scrollTo(what === 'bank' ? ON_THE_WAY_ID : MOVES_ID))
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

  const loaded = ready && !failed
  const overview = (
    <Overview
      income={loaded ? income.data : undefined}
      expenses={loaded ? expenses.data : undefined}
      isError={failed}
      waiting={waiting}
      onRetry={retry}
      onTheWay={onTheWay.groups ? { amount: onTheWay.total, count: onTheWay.count } : null}
      before={waiting ? null : before}
      onShow={show}
    />
  )
  const chart = startDay !== undefined && <MonthsChart today={today} startDay={startDay} period={period} series={series} onPick={go} />
  const moves = (
    <MovesSection
      key={`${visible.from}/${visible.to}`}
      id={MOVES_ID}
      income={loaded ? income.data : undefined}
      expenses={loaded ? expenses.data : undefined}
      isError={failed}
      waiting={waiting}
      onRetry={retry}
      filter={filter}
      onFilter={setFilter}
      visible={visible}
    />
  )
  const monthly = ready && isMonthLong(period) && (
    <MonthlySection period={period} expenses={waiting ? undefined : expenses.data} waiting={waiting} today={today} visible={visible} />
  )
  const expected = <ExpectedSection todayKey={dayKey} />
  const cards = <OnTheWaySection id={ON_THE_WAY_ID} today={today} />
  const categories = <CategoriesSection expenses={loaded ? expenses.data : undefined} waiting={waiting} onPick={pickCategory} />

  return (
    <Page
      title={t.shell.nav.finance}
      summary={startDay !== undefined && startDay !== 1 ? fmt(t.finance.period.startsOn, { day: startDay }) : undefined}
      toolbar={toolbar}
      action={{ label: t.finance.addExpense, onPress: addExpense }}
      width="wide"
    >
      <PeriodNav period={period} today={today} startDay={startDay ?? 1} onChange={go} />
      {wide ? (
        <>
          <div className="mt-5">{overview}</div>
          <div className="mt-6 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-6">
            <div className="flex min-w-0 flex-col gap-6">
              {chart}
              {moves}
            </div>
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
          {overview}
          {monthly}
          {moves}
          {expected}
          {cards}
          {categories}
          {chart}
        </div>
      )}
    </Page>
  )
}
