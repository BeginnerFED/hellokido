import { useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native'
import { Stack } from 'expo-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, endOfMonth, startOfMonth } from 'date-fns'
import { expensesBetween, incomeBetween, type Expense, type IncomeLine } from '@hellokido/core/api'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { arrivalOf } from '@hellokido/core/view'
import { keys, useCatalog, useLabels } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenu, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Screen } from '../../ui/Screen'
import { Text } from '../../ui/Text'
import { METHODS } from '../payment/fields'
import { methodName, sumOf, together } from './bits'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { CategoriesSection, ExpectedSection, MonthlySection, OnTheWaySection } from './sections'

/**
 * A month of money: what came in and went out, the month's fixed expenses, the list behind the
 * figures, and what is still to come (expected payments, card money on its way to the bank).
 */
export function FinanceScreen() {
  const c = useColors()
  const { t, date } = useI18n()
  const client = useQueryClient()
  const menu = useActionMenu()
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  // Months counted from the current one: a phone left open into a new month moves along with it
  const [offset, setOffset] = useState(0)
  const month = useMemo(() => addMonths(startOfMonth(today), offset), [today, offset])
  const end = useMemo(() => endOfMonth(month), [month])
  const from = month.toISOString()
  const to = end.toISOString()
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)
  const scroll = useRef<ScrollViewInstance>(null)
  const offsets = useRef<Record<string, number>>({})

  const income = useQuery({ queryKey: keys.finance('income', from, to), queryFn: () => incomeBetween(month, end), placeholderData: keepPreviousData })
  const expenses = useQuery({ queryKey: keys.finance('expenses', from, to), queryFn: () => expensesBetween(month, end), placeholderData: keepPreviousData })
  // The month before stays on screen, dimmed, until the new one is read
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

  const remember = (id: string) => (event: LayoutChangeEvent) => {
    offsets.current[id] = event.nativeEvent.layout.y
  }
  const jump = async (id: string) => {
    const y = offsets.current[id]
    if (y === undefined) return
    const still = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
    scroll.current?.scrollTo({ y: Math.max(y - 12, 0), animated: !still })
  }
  const pickCategory = (code: string) => {
    setFilter({ kind: 'out', type: code })
    void jump('moves')
  }

  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['finance'] }), client.invalidateQueries({ queryKey: keys.registrations })])

  const add = [
    { label: t.finance.addExpense, icon: 'receipt' as const, onPress: () => tasks.expense() },
    { label: t.finance.childPayment, icon: 'money' as const, onPress: () => tasks.payment() },
    { label: t.finance.otherIncome, icon: 'income' as const, onPress: () => tasks.income() },
    { label: t.finance.monthly.add, icon: 'calendar' as const, onPress: () => tasks.recurring() }
  ]

  const shownIncome = failed ? undefined : income.data
  const shownExpenses = failed ? undefined : expenses.data

  return (
    <>
      <Stack.Screen options={headerMenu(c, t.common.add, add, (items) => menu.open(undefined, items))} />
      {menu.element}
      <Screen scrollRef={scroll} onRefresh={refresh}>
        <View style={styles.top}>
          <View style={styles.nav}>
            <Text variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite" numberOfLines={1} style={styles.flex}>
              {upperFirst(date(month, { month: 'long', year: 'numeric' }))}
            </Text>
            {offset !== 0 && (
              <Button size="sm" onPress={() => setOffset(0)}>
                {t.finance.period.thisMonth}
              </Button>
            )}
            <IconButton icon="chevronLeft" label={t.finance.period.previous} variant="well" onPress={() => setOffset((value) => value - 1)} />
            <IconButton icon="chevronRight" label={t.finance.period.next} variant="well" onPress={() => setOffset((value) => value + 1)} />
          </View>
          <Balance
            income={shownIncome}
            expenses={shownExpenses}
            isError={failed}
            waiting={waiting}
            onRetry={retry}
            onTheWay={waiting ? 0 : onTheWay}
            onShowOnTheWay={() => void jump('cards')}
          />
        </View>

        {!failed && <MonthlySection month={month} today={today} expenses={shownExpenses} waiting={waiting} />}
        <MovesSection
          key={from}
          income={shownIncome}
          expenses={shownExpenses}
          isError={failed}
          waiting={waiting}
          onRetry={retry}
          filter={filter}
          onFilter={setFilter}
          onLayout={remember('moves')}
        />
        <ExpectedSection todayKey={dayKey} />
        <OnTheWaySection today={today} onLayout={remember('cards')} />
        {!failed && <CategoriesSection expenses={shownExpenses} waiting={waiting} onPick={pickCategory} />}
      </Screen>
    </>
  )
}

type BalanceProps = {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  waiting: boolean
  onRetry: () => void
  /** Card money of this month that the bank has not credited yet. */
  onTheWay: number
  onShowOnTheWay: () => void
}

/**
 * The month in two rods on one scale, money in and money out, and what is left. Below: how the
 * money came in, and the card money that is not in the bank yet, so the figures can be matched
 * against the bank account.
 */
function Balance({ income, expenses, isError, waiting, onRetry, onTheWay, onShowOnTheWay }: BalanceProps) {
  const c = useColors()
  const { t, fmt, money } = useI18n()
  const labels = useLabels()

  if (isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
  if (!income || !expenses) {
    return (
      <View style={[styles.balance, { backgroundColor: c.surface }]}>
        <Skeleton height={18} width="45%" />
        <Skeleton height={10} />
        <Skeleton height={18} width="40%" />
        <Skeleton height={10} width="55%" />
        <Skeleton height={30} width="60%" style={styles.skeletonFigure} />
      </View>
    )
  }

  const totalIn = sumOf(income)
  const totalOut = sumOf(expenses)
  const net = totalIn - totalOut
  const scale = Math.max(totalIn, totalOut)
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)

  return (
    <View accessibilityLabel={t.finance.balance.label} style={[styles.balance, { backgroundColor: c.surface }, waiting && styles.dim]}>
      <Rod label={t.finance.balance.in} amount={totalIn} scale={scale} color={c.seriesIn} />
      <Rod label={t.finance.balance.out} amount={totalOut} scale={scale} color={c.seriesOut} />
      <View style={[styles.net, { borderTopColor: c.line }]}>
        <Text variant="callout" weight="500" tone="ink2" style={styles.flex}>
          {net < 0 ? t.finance.balance.short : t.finance.balance.left}
        </Text>
        <Text numberOfLines={1} style={[styles.figure, { color: net < 0 ? c.negativeInk : c.ink }]}>
          {money(Math.abs(net))}
        </Text>
      </View>
      {totalIn === 0 && totalOut === 0 ? (
        <Text variant="foot" tone="ink2">
          {t.finance.balance.empty}
        </Text>
      ) : (
        byMethod.length > 0 && (
          <Text variant="foot" tone="ink2">
            <Text variant="foot" tone="ink3">
              {t.finance.balance.byMethod}:{' '}
            </Text>
            {byMethod.map((row) => together(`${methodName(t, labels, row.method)} ${money(row.amount)}`)).join(' · ')}
          </Text>
        )
      )}
      {onTheWay > 0 && (
        <Pressable onPress={onShowOnTheWay} accessibilityRole="button" hitSlop={{ top: 6, bottom: 10 }} style={({ pressed }) => pressed && styles.pressed}>
          <Text variant="foot" tone="ink2">
            {fmt(t.finance.balance.onTheWay, { amount: money(onTheWay) })}{' '}
            <Text variant="foot" weight="600" tone="accentInk">
              {t.finance.balance.onTheWayLink}
            </Text>
          </Text>
        </Pressable>
      )}
    </View>
  )
}

function Rod({ label, amount, scale, color }: { label: string; amount: number; scale: number; color: string }) {
  const { money } = useI18n()
  // A tiny amount still shows as a sliver, so "some" never reads as "none"
  const width = scale > 0 && amount > 0 ? Math.max((amount / scale) * 100, 1.5) : 0
  return (
    <View style={styles.rod}>
      <View style={styles.rodHead}>
        <Text variant="sub" tone="ink2" style={styles.flex}>
          {label}
        </Text>
        <Text variant="headline" tabular>
          {money(amount)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, minHeight: 44 },
  balance: { borderRadius: 18, padding: 16, gap: 14 },
  dim: { opacity: 0.6 },
  skeletonFigure: { marginTop: 8 },
  rod: { gap: 7 },
  rodHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  track: { height: 10 },
  bar: { height: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  net: { flexDirection: 'row', alignItems: 'baseline', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 2 },
  // A figure on its own keeps proportional digits
  figure: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.4, flexShrink: 1 },
  pressed: { opacity: 0.6 }
})
