import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CaretDownIcon, CoinsIcon, HandCoinsIcon, PlusIcon } from '@phosphor-icons/react'
import { expensesBetween, incomeBetween } from '@hellokido/core/api'
import { cycleOf, isOpen, totalsOf } from '@hellokido/core/view'
import { keys, useCatalog } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Button } from '../../ui/Button'
import { Menu, MenuItem } from '../../ui/Menu'
import { Page } from '../../ui/Page'
import { useMediaQuery, useWideLayout } from '../../ui/useMediaQuery'
import { useClock } from '../today/clock'
import { CategoriesSection } from './Categories'
import { ExpectedSection, useExpected } from './Expected'
import { MonthlySection } from './Monthly'
import { MonthsChart, useMoneySeries } from './MonthsChart'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { OnTheWaySection, useCardsOnTheWay } from './OnTheWay'
import { Overview, type ShowWhat } from './Overview'
import { PeriodNav } from './PeriodNav'
import { boundsOf, isCycle, periodParams, readPeriod, samePeriod, stepPeriod, type Period } from './period'
import { usePeriodRule } from './rule'
import { useShowRange } from './visible'

const MOVES_ID = 'finance-moves'
const ON_THE_WAY_ID = 'finance-on-the-way'
const EXPECTED_ID = 'finance-expected'

/**
 * Money in and out of a period (the one since the last salaries unless another is chosen), what is
 * left to share, the list behind it, and what is still to come: expected payments, card money on
 * its way to the bank and the period's fixed expenses. The period lives in the address, so it can
 * be bookmarked or sent.
 */
export default function FinancePage() {
  const i18n = useI18n()
  const { t, fmt, date } = i18n
  const { startTask } = useActions()
  const wide = useWideLayout()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  // Nothing is read until the periods are known, so the page never flashes a wrong period first
  const { rule, payouts } = usePeriodRule(today)
  const [params, setParams] = useSearchParams()
  const period = useMemo(() => readPeriod(params, today, rule ?? 1), [params, today, rule])
  const bounds = useMemo(() => boundsOf(period), [period])
  const visible = useMemo(() => ({ from: bounds.from.toISOString(), to: bounds.to.toISOString() }), [bounds])
  useShowRange(visible)
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)
  const ready = rule !== undefined
  const cycle = rule !== undefined && isCycle(period, rule)

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
  const series = useMoneySeries(today, rule)
  const waiting = income.isPlaceholderData || expenses.isPlaceholderData
  const failed = income.isError || expenses.isError
  const retry = () => {
    void income.refetch()
    void expenses.refetch()
  }

  // The same card money as the "on the way" list below, so the figure and the list always agree
  const onTheWay = useCardsOnTheWay(today)
  const catalog = useCatalog()
  const settle = catalog.data ? (catalog.data.settings.cardSettlementDays ?? 30) : catalog.isError ? 30 : null
  // The same rows as the "expected" list below
  const expected = useExpected(dayKey)
  const before = useMemo(
    () => totalsOf(series.data, series.first, stepPeriod(period, -1, rule), cycle ? payouts : undefined),
    [series.data, series.first, period, rule, cycle, payouts]
  )

  // The current period keeps a clean address; any other period is written into it
  const go = useCallback(
    (next: Period) => setParams(samePeriod(next, cycleOf(today, rule ?? 1)) ? {} : periodParams(next), { replace: true }),
    [setParams, today, rule]
  )

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  const pickCategory = (code: string) => {
    setFilter({ ...NO_FILTER, kind: 'out', type: code })
    requestAnimationFrame(() => scrollTo(MOVES_ID))
  }
  const show = (what: ShowWhat) => {
    if (what === 'in' || what === 'out') setFilter({ ...NO_FILTER, kind: what })
    requestAnimationFrame(() => scrollTo(what === 'bank' ? ON_THE_WAY_ID : what === 'expected' ? EXPECTED_ID : MOVES_ID))
  }

  const addExpense = () => startTask('expense', { visible })
  const toolbar = (
    <>
      <Menu
        label={t.finance.addIncome}
        placement="bottom end"
        trigger={
          <Button variant="quiet" className="max-lg:flex-1">
            {t.finance.addIncome}
            <CaretDownIcon aria-hidden weight="bold" className="size-3.5 opacity-70" />
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
      today={today}
      onTheWay={onTheWay.groups ? { amount: onTheWay.total, count: onTheWay.count } : null}
      settle={settle}
      expected={
        expected.lines ? { total: expected.total, count: expected.lines.length, overdue: expected.overdue, next: expected.next, unpriced: expected.unpriced } : null
      }
      before={waiting ? null : before}
      share={rule && cycle ? { open: isOpen(period, rule), payouts } : null}
      onShow={show}
    />
  )
  const chart = rule && <MonthsChart today={today} rule={rule} payouts={payouts} period={period} series={series} onPick={go} />
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
  const monthly = cycle && (
    <MonthlySection period={period} expenses={waiting ? undefined : expenses.data} waiting={waiting} today={today} visible={visible} />
  )
  const waitingMoney = <ExpectedSection id={EXPECTED_ID} todayKey={dayKey} />
  const cards = <OnTheWaySection id={ON_THE_WAY_ID} today={today} />
  const categories = <CategoriesSection expenses={loaded ? expenses.data : undefined} waiting={waiting} onPick={pickCategory} />

  const lastPayday = rule?.paydays.at(-1)
  const summary = lastPayday
    ? fmt(t.finance.period.paidOn, { date: date(lastPayday, { day: 'numeric', month: 'long' }) })
    : rule && rule.startDay !== 1
      ? fmt(t.finance.period.startsOn, { day: rule.startDay })
      : undefined

  return (
    <Page title={t.shell.nav.finance} summary={summary} toolbar={toolbar} action={{ label: t.finance.addExpense, onPress: addExpense }} width="wide">
      {/* Holds the row's height while the periods load, so nothing below jumps */}
      <div className="min-h-11">{rule && <PeriodNav period={period} today={today} rule={rule} onChange={go} />}</div>
      {wide ? (
        <>
          <div className="mt-[1.125rem]">{overview}</div>
          <div className="mt-5 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-5">
            <div className="flex min-w-0 flex-col gap-5">
              {chart}
              {moves}
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              {monthly}
              {waitingMoney}
              {cards}
              {categories}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {overview}
          {monthly}
          {moves}
          {waitingMoney}
          {cards}
          {categories}
          {chart}
        </div>
      )}
    </Page>
  )
}
