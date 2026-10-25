import { useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type ScrollViewInstance
} from 'react-native'
import { Stack } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesBetween, incomeBetween, type Expense, type IncomeLine } from '@hellokido/core/api'
import { boundsOf, cycleOf, isMonthLong, samePeriod, stepPeriod, totalsOf, type Period, type Totals } from '@hellokido/core/view'
import { keys, useCatalog, useLabels } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenu, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { LoadError, Skeleton } from '../../ui/Bits'
import { IconButton } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Card, Screen } from '../../ui/Screen'
import { DOT, dots, Text } from '../../ui/Text'
import { METHODS } from '../payment/fields'
import { methodName, sumOf, together } from './bits'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { choosePeriod, matchPreset, periodName, presetName, presetPeriod, useChosenPeriod } from './period'
import { PeriodsChart, useMoneySeries } from './PeriodsChart'
import { CategoriesSection, ExpectedSection, MonthlySection, OnTheWaySection, useCardsOnTheWay } from './sections'

/**
 * A money period (the one that holds today unless another is chosen): what came in and went out
 * against the period before, the period's fixed expenses, the list behind the figures, what is
 * still to come, and the last six periods side by side.
 */
export function FinanceScreen() {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt } = i18n
  const client = useQueryClient()
  const menu = useActionMenu()
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const catalog = useCatalog()
  // Nothing is read until the start day is known, so the screen never shows the calendar month first
  const startDay = catalog.data?.settings.moneyPeriodStartDay ?? (catalog.isError ? 1 : undefined)
  const current = useMemo(() => cycleOf(today, startDay ?? 1), [today, startDay])
  const period = useChosenPeriod() ?? current
  const bounds = useMemo(() => boundsOf(period), [period])
  const from = bounds.from.toISOString()
  const to = bounds.to.toISOString()
  const ready = startDay !== undefined
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)
  const scroll = useRef<ScrollViewInstance>(null)
  const offsets = useRef<Record<string, number>>({})

  const income = useQuery({ queryKey: keys.finance('income', from, to), queryFn: () => incomeBetween(bounds.from, bounds.to), enabled: ready, placeholderData: keepPreviousData })
  const expenses = useQuery({ queryKey: keys.finance('expenses', from, to), queryFn: () => expensesBetween(bounds.from, bounds.to), enabled: ready, placeholderData: keepPreviousData })
  const series = useMoneySeries(today, startDay)
  const cards = useCardsOnTheWay(today)
  // The period before stays on screen, dimmed, until the new one is read
  const waiting = income.isPlaceholderData || expenses.isPlaceholderData
  const failed = income.isError || expenses.isError
  const retry = () => {
    void income.refetch()
    void expenses.refetch()
  }
  const before = useMemo(() => totalsOf(series.data, series.first, stepPeriod(period, -1)), [series.data, series.first, period])

  // The current period is never pinned, so a phone left open into the next one moves along with it
  const go = (next: Period) => {
    choosePeriod(samePeriod(next, current) ? null : next)
    // Android reads the heading out by itself (a live region); VoiceOver is told
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(periodName(i18n, next))
  }
  const step = (direction: 1 | -1) => {
    void Haptics.selectionAsync()
    go(stepPeriod(period, direction))
  }

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
  const show = (what: 'in' | 'out' | 'bank') => {
    void Haptics.selectionAsync()
    if (what !== 'bank') setFilter({ kind: what, type: 'any' })
    void jump(what === 'bank' ? 'cards' : 'moves')
  }

  // The period start day and the card days live in Settings, so a pull reads them again too
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['finance'] }),
      client.invalidateQueries({ queryKey: keys.registrations }),
      client.invalidateQueries({ queryKey: keys.catalog })
    ])

  const add = [
    { label: t.finance.addExpense, icon: 'receipt' as const, onPress: () => tasks.expense() },
    { label: t.finance.childPayment, icon: 'money' as const, onPress: () => tasks.payment() },
    { label: t.finance.otherIncome, icon: 'income' as const, onPress: () => tasks.income() },
    { label: t.finance.monthly.add, icon: 'calendar' as const, onPress: () => tasks.recurring() }
  ]

  const preset = matchPreset(period, today, startDay ?? 1)
  const otherPeriods = () =>
    menu.open(undefined, [
      ...(preset === 'thisPeriod' ? [] : [{ label: presetName(t, 'thisPeriod', startDay ?? 1), onPress: () => go(current) }]),
      ...(['lastPeriod', 'last14', 'today'] as const)
        .filter((id) => id !== preset)
        .map((id) => ({ label: presetName(t, id, startDay ?? 1), onPress: () => go(presetPeriod(id, today, startDay ?? 1)) })),
      { label: t.finance.period.custom, onPress: tasks.financePeriod },
      { label: t.finance.period.changeStart, onPress: tasks.moneyPeriod }
    ])

  const shownIncome = failed || !ready ? undefined : income.data
  const shownExpenses = failed || !ready ? undefined : expenses.data
  const isCurrent = samePeriod(period, current)

  return (
    <>
      <Stack.Screen options={headerMenu(c, t.common.add, add, (items) => menu.open(undefined, items))} />
      {menu.element}
      <Screen scrollRef={scroll} onRefresh={refresh}>
        {/* The period and its figures read as one block; the sections below keep the usual 30px apart */}
        <View style={styles.head}>
          <View style={styles.bar}>
            <IconButton icon="chevronLeft" label={t.finance.period.previous} size={38} onPress={() => step(-1)} />
            <View style={styles.middle}>
              <Pressable
                onPress={otherPeriods}
                accessibilityRole="button"
                accessibilityLabel={`${periodName(i18n, period)}. ${t.finance.period.otherPeriod}`}
                accessibilityLiveRegion="polite"
                hitSlop={8}
                style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
              >
                {/* A long custom range ("10 Eki 2025 – 9 Kas 2026") shrinks a little before it is cut */}
                <Text variant="headline" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.shrink}>
                  {periodName(i18n, period)}
                </Text>
                <Icon name="chevronDown" size={12} color={c.ink3} weight="semibold" />
              </Pressable>
              {isCurrent ? (
                <Text variant="foot" tone="ink3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {startDay === undefined || startDay === 1 ? presetName(t, 'thisPeriod', 1) : fmt(t.finance.period.startsOn, { day: startDay })}
                </Text>
              ) : (
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync()
                    go(current)
                  }}
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 12, left: 16, right: 16 }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text variant="foot" weight="600" tone="accentInk" numberOfLines={1}>
                    {t.finance.period.backToCurrent}
                  </Text>
                </Pressable>
              )}
            </View>
            <IconButton icon="chevronRight" label={t.finance.period.next} size={38} onPress={() => step(1)} />
          </View>

          <Overview
            income={shownIncome}
            expenses={shownExpenses}
            isError={failed}
            waiting={waiting}
            onRetry={retry}
            before={waiting ? null : before}
            onTheWay={cards.cards.isError ? undefined : cards.groups ? { amount: cards.total, count: cards.count } : null}
            onShow={show}
          />
        </View>

        {!failed && ready && isMonthLong(period) && <MonthlySection period={period} today={today} expenses={shownExpenses} waiting={waiting} />}
        {/* A failed read is told once, in the overview with its retry; the list waits for it */}
        {!failed && (
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
        )}
        <ExpectedSection todayKey={dayKey} />
        <OnTheWaySection today={today} onLayout={remember('cards')} />
        {!failed && <CategoriesSection expenses={shownExpenses} waiting={waiting} onPick={pickCategory} />}
        {startDay !== undefined && <PeriodsChart today={today} startDay={startDay} period={period} series={series} onPick={go} />}
      </Screen>
    </>
  )
}

type OverviewProps = {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  waiting: boolean
  onRetry: () => void
  /** The period just before, of the same length; null when it is not known. */
  before: Totals | null
  /**
   * Card money the bank has not credited yet, whatever the period (listed further down): null while
   * it loads, undefined when it could not be read (the list further down says so, with a retry).
   */
  onTheWay: { amount: number; count: number } | null | undefined
  onShow: (what: 'in' | 'out' | 'bank') => void
}

// Figures (and ₺) are about 0.6em wide in the system font; dots, commas and spaces about half that
const ems = (text: string) => [...text].reduce((sum, char) => sum + (/[\d₺+−]/.test(char) ? 0.6 : 0.3), 0)

/**
 * One size for both halves: the largest at which the longer amount fits half of the card on this
 * phone, so "188.714,45 ₺" beside "9.850 ₺" never sets the two in different sizes.
 */
function halfSize(screenWidth: number, amounts: string[]) {
  // The screen's padding, the card's edges and middle rule, the half's own padding
  const room = (screenWidth - 32 - 2 - 1) / 2 - 32
  const widest = Math.max(...amounts.map(ems))
  return [21, 19, 17].find((size) => widest * size <= room) ?? 15
}

/** A resting line as tall as the text it stands for, so the card keeps its height when the figures come. */
function Line({ line, height, width }: { line: number; height: number; width: DimensionValue }) {
  return (
    <View style={[styles.line, { height: line }]}>
      <Skeleton height={height} width={width} />
    </View>
  )
}

/**
 * What is left of the period first, then money in and money out side by side, each against the
 * period before, then the card money that is not in the bank yet and how the money came in, so
 * the figures can be matched against the till and the bank account.
 */
function Overview({ income, expenses, isError, waiting, onRetry, before, onTheWay, onShow }: OverviewProps) {
  const c = useColors()
  const { t, fmt, plural, money } = useI18n()
  const labels = useLabels()
  const { width } = useWindowDimensions()

  if (isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
  if (!income || !expenses) {
    const half = (
      <View style={styles.cell}>
        <Line line={20} height={14} width="45%" />
        <Line line={26} height={20} width="75%" />
        <Line line={18} height={12} width="40%" />
        <Line line={18} height={12} width="55%" />
        <Line line={18} height={12} width="50%" />
      </View>
    )
    return (
      <Card>
        <View style={styles.net}>
          <Line line={20} height={14} width="22%" />
          <Line line={38} height={30} width="52%" />
          <Line line={18} height={12} width="44%" />
        </View>
        <View style={styles.pair}>
          {half}
          <View style={[styles.divider, { backgroundColor: c.line2 }]} />
          {half}
        </View>
        <View style={styles.bank}>
          <View style={styles.flex}>
            <Line line={21} height={15} width="55%" />
            <Line line={18} height={12} width="40%" />
          </View>
          <Skeleton height={18} width={80} />
        </View>
      </Card>
    )
  }

  const totalIn = sumOf(income)
  const totalOut = sumOf(expenses)
  const net = totalIn - totalOut
  const beforeNet = before ? before.in - before.out : 0
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)
  const netLabel = net < 0 ? t.finance.balance.short : t.finance.balance.left
  const netHint = before
    ? fmt(beforeNet < 0 ? t.finance.balance.beforeShort : t.finance.balance.before, { amount: together(money(Math.abs(beforeNet))) })
    : t.finance.balance.leftHint
  const amountIn = money(totalIn)
  const amountOut = money(totalOut)
  const size = halfSize(width, [amountIn, amountOut])
  const bank = Boolean(onTheWay && onTheWay.amount > 0)

  const bankBody = (
    <>
      <View style={styles.flex}>
        <Text variant="callout" weight="500" numberOfLines={1}>
          {t.finance.balance.bank}
        </Text>
        {onTheWay && (
          <Text variant="foot" tone="ink3" numberOfLines={2}>
            {bank ? dots(plural(t.finance.card.payments, onTheWay.count), t.finance.balance.bankHint) : t.finance.balance.bankNone}
          </Text>
        )}
      </View>
      {onTheWay ? (
        <Text variant="callout" weight="600" tabular numberOfLines={1}>
          {money(onTheWay.amount)}
        </Text>
      ) : (
        <Skeleton height={18} width={80} />
      )}
      {bank && <Icon name="chevronRight" size={13} color={c.ink3} weight="semibold" />}
    </>
  )

  return (
    <Card style={waiting && styles.dim}>
      <View accessible accessibilityLabel={`${netLabel} ${money(Math.abs(net))}. ${netHint}`} style={styles.net}>
        <Text variant="sub" tone="ink2">
          {netLabel}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.figure, { color: net < 0 ? c.negativeInk : c.ink }]}>
          {money(Math.abs(net))}
        </Text>
        <Text variant="foot" tone="ink3">
          {netHint}
        </Text>
      </View>

      <View style={styles.pair}>
        <Half
          label={t.finance.balance.in}
          amount={amountIn}
          size={size}
          count={plural(t.finance.balance.payments, income.length)}
          before={before ? money(before.in) : null}
          a11y={t.finance.balance.showIn}
          onPress={() => onShow('in')}
        />
        <View style={[styles.divider, { backgroundColor: c.line2 }]} />
        <Half
          label={t.finance.balance.out}
          amount={amountOut}
          size={size}
          count={plural(t.finance.balance.expenses, expenses.length)}
          before={before ? money(before.out) : null}
          a11y={t.finance.balance.showOut}
          onPress={() => onShow('out')}
        />
      </View>

      {/* Hidden when the card payments could not be read: their own list below says so and retries */}
      {onTheWay !== undefined &&
        (bank ? (
          <Pressable
            onPress={() => onShow('bank')}
            accessibilityRole="button"
            accessibilityHint={t.finance.balance.showBank}
            style={({ pressed }) => [styles.bank, pressed && { backgroundColor: c.well }]}
          >
            {bankBody}
          </Pressable>
        ) : (
          <View accessible style={styles.bank}>
            {bankBody}
          </View>
        ))}

      {totalIn === 0 && totalOut === 0 ? (
        <View style={styles.methods}>
          <Text variant="foot" tone="ink2">
            {t.finance.balance.empty}
          </Text>
        </View>
      ) : byMethod.length > 0 ? (
        <View style={styles.methods}>
          <Text variant="foot" tone="ink2">
            <Text variant="foot" tone="ink3">
              {t.finance.balance.byMethod}:{' '}
            </Text>
            {byMethod.map((row) => together(`${methodName(t, labels, row.method)} ${money(row.amount)}`)).join(DOT)}
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

type HalfProps = {
  label: string
  amount: string
  /** The font size both halves share. */
  size: number
  count: string
  /** The same amount in the period before; null when it is not known. */
  before: string | null
  a11y: string
  onPress: () => void
}

/**
 * Money in or money out: the figure, how many payments made it, and the period before on two lines
 * of its own, so a long amount never wraps one half and leaves the halves uneven.
 */
function Half({ label, amount, size, count, before, a11y, onPress }: HalfProps) {
  const c = useColors()
  const { t, fmt } = useI18n()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[`${label} ${amount}`, count, before && fmt(t.finance.balance.before, { amount: before })].filter(Boolean).join('. ')}
      accessibilityHint={a11y}
      style={({ pressed }) => [styles.cell, pressed && { backgroundColor: c.well }]}
    >
      <View style={styles.cellHead}>
        <Text variant="sub" tone="ink2" numberOfLines={1} style={styles.flex}>
          {label}
        </Text>
        <Icon name="chevronRight" size={12} color={c.ink3} weight="semibold" />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} tabular style={[styles.half, { fontSize: size }]}>
        {amount}
      </Text>
      <Text variant="foot" tone="ink3" numberOfLines={1}>
        {count}
      </Text>
      {before ? (
        <>
          <Text variant="foot" tone="ink3" numberOfLines={1}>
            {t.finance.balance.beforeLabel}
          </Text>
          <Text variant="foot" tone="ink3" tabular numberOfLines={1}>
            {before}
          </Text>
        </>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
  head: { gap: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  middle: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  line: { justifyContent: 'center' },
  net: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 3 },
  // A figure on its own keeps proportional digits
  figure: { fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  pair: { flexDirection: 'row' },
  // As thick as the card's own rules between its parts
  divider: { width: 1 },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingVertical: 13, gap: 2 },
  cellHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The line height stays when the size steps down, so both halves keep one rhythm
  half: { lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 14, paddingVertical: 12, minHeight: 56 },
  methods: { paddingHorizontal: 16, paddingVertical: 12 }
})
