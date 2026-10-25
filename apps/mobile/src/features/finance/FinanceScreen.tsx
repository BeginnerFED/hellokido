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
import * as Haptics from 'expo-haptics'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesBetween, incomeBetween, type Expense, type IncomeLine } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { arrivalOf, boundsOf, cycleOf, isCycle, isOpen, leftByPlace, PARTNERS, samePeriod, stepPeriod, totalsOf, type Period, type Totals } from '@hellokido/core/view'
import { keys, useCatalog, useLabels } from '../../data/queries'
import { useClock } from '../../lib/clock'
import { headerMenus, tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu, type MenuItem } from '../../ui/ActionMenu'
import { LoadError, Skeleton, StatTile } from '../../ui/Bits'
import { IconButton } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Card, RoundButton, Screen } from '../../ui/Screen'
import { DotLine, dots, Text } from '../../ui/Text'
import { METHODS } from '../payment/fields'
import { MINUS, methodName, sumOf, together } from './bits'
import { MovesSection, NO_FILTER, type MoveFilter } from './Moves'
import { choosePeriod, matchPreset, periodName, presetName, presetPeriod, useChosenPeriod } from './period'
import { PeriodsChart, useMoneySeries } from './PeriodsChart'
import { usePeriodRule } from './rule'
import { CategoriesSection, ExpectedSection, MonthlySection, OnTheWaySection, useCardsOnTheWay } from './sections'

/**
 * A money period (the one since the last salaries unless another is chosen) as a felt board: what
 * there is to share and where that money is (bank, on its way to the bank, cash), money in and out
 * as two tiles, then the period's fixed expenses, the list behind the figures, what is still to
 * come, and the last six periods side by side.
 */
export function FinanceScreen() {
  const c = useColors()
  const i18n = useI18n()
  const { t, fmt, date } = i18n
  const client = useQueryClient()
  const menu = useActionMenu()
  const { dayKey } = useClock()
  const today = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  // Nothing is read until the periods are known, so the screen never shows a wrong period first
  const { rule, payouts } = usePeriodRule(today)
  const current = useMemo(() => cycleOf(today, rule ?? 1), [today, rule])
  const period = useChosenPeriod() ?? current
  const bounds = useMemo(() => boundsOf(period), [period])
  const from = bounds.from.toISOString()
  const to = bounds.to.toISOString()
  const ready = rule !== undefined
  const cycle = rule !== undefined && isCycle(period, rule)
  const [filter, setFilter] = useState<MoveFilter>(NO_FILTER)
  const scroll = useRef<ScrollViewInstance>(null)
  const offsets = useRef<Record<string, number>>({})

  const income = useQuery({ queryKey: keys.finance('income', from, to), queryFn: () => incomeBetween(bounds.from, bounds.to), enabled: ready, placeholderData: keepPreviousData })
  const expenses = useQuery({ queryKey: keys.finance('expenses', from, to), queryFn: () => expensesBetween(bounds.from, bounds.to), enabled: ready, placeholderData: keepPreviousData })
  const series = useMoneySeries(today, rule)
  const cards = useCardsOnTheWay(today)
  // How long card money takes to reach the bank lives in Settings; until it is read the split waits
  const catalog = useCatalog()
  // The period before stays on screen, dimmed, until the new one is read
  const waiting = income.isPlaceholderData || expenses.isPlaceholderData
  const failed = income.isError || expenses.isError
  const retry = () => {
    void income.refetch()
    void expenses.refetch()
  }
  const before = useMemo(
    () => totalsOf(series.data, series.first, stepPeriod(period, -1, rule), cycle ? payouts : undefined),
    [series.data, series.first, period, rule, cycle, payouts]
  )

  // The current period is never pinned, so a phone left open into the next one moves along with it
  const go = (next: Period) => {
    choosePeriod(samePeriod(next, current) ? null : next)
    // Android reads the heading out by itself (a live region); VoiceOver is told
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(periodName(i18n, next))
  }
  const step = (direction: 1 | -1) => {
    void Haptics.selectionAsync()
    go(stepPeriod(period, direction, rule))
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

  // The card days live in Settings, so a pull reads them again too
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

  // The iPhone's menu ticks the period on screen; Android's sheet leaves it out
  const preset = rule ? matchPreset(period, today, rule) : null
  const periodChoices: MenuItem[] = rule
    ? [
        ...(['thisPeriod', 'lastPeriod', 'last14', 'today'] as const).map((id) => ({
          label: presetName(t, id, rule),
          selected: id === preset,
          onPress: () => go(id === 'thisPeriod' ? current : presetPeriod(id, today, rule))
        })),
        { label: t.finance.period.custom, onPress: tasks.financePeriod }
      ]
    : []
  const otherPeriods = () => menu.open(undefined, periodChoices.filter((choice) => !choice.selected))
  // The iPhone opens both from its own bar as its own dropdowns: "+" at the edge, the period beside it
  const bar = {
    options: headerMenus([
      { label: t.common.add, icon: 'add', items: add },
      ...(rule ? [{ label: t.finance.period.otherPeriod, icon: 'calendar' as const, items: periodChoices }] : [])
    ]),
    buttons: rule ? 2 : 1
  }
  const fromBar = Platform.OS === 'ios'

  const shownIncome = failed || !ready ? undefined : income.data
  const settle = catalog.isPending ? null : cards.days
  // The part of the card money on its way that this period's split counts; the list further down holds all of it
  const wayOfPeriod =
    settle === null || !shownIncome
      ? null
      : sumOf(shownIncome.filter((line) => line.method === 'kart' && line.paymentDate && arrivalOf(line.paymentDate, settle) >= today))
  const shownExpenses = failed || !ready ? undefined : expenses.data
  const isCurrent = samePeriod(period, current)
  const lastPayday = rule?.paydays.at(-1)

  return (
    <>
      {menu.element}
      <Screen
        scrollRef={scroll}
        onRefresh={refresh}
        title={t.shell.nav.finance}
        bar={bar}
        actions={fromBar ? undefined : <RoundButton icon="add" label={t.common.add} onPress={() => menu.open(undefined, add)} />}
      >
        {/* The period and its figures read as one block; the sections below keep the usual room apart */}
        <View style={styles.head}>
          <View style={styles.bar}>
            <IconButton icon="chevronLeft" label={t.finance.period.previous} variant="felt" size={40} disabled={!ready} onPress={() => step(-1)} />
            {ready ? (
              <View style={styles.middle}>
                {fromBar ? (
                  // On the iPhone the period is chosen from the bar, so here it is only named
                  <View accessible accessibilityLabel={periodName(i18n, period)} style={styles.pick}>
                    <Text variant="headline" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.periodName, styles.shrink]}>
                      {periodName(i18n, period)}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={otherPeriods}
                    accessibilityRole="button"
                    accessibilityLabel={`${periodName(i18n, period)}. ${t.finance.period.otherPeriod}`}
                    accessibilityLiveRegion="polite"
                    hitSlop={8}
                    style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
                  >
                    {/* A long custom range ("10 Eki 2025 – 9 Kas 2026") shrinks a little before it is cut */}
                    <Text variant="headline" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.periodName, styles.shrink]}>
                      {periodName(i18n, period)}
                    </Text>
                    <Icon name="chevronDown" size={14} color={c.ink2} weight="semibold" />
                  </Pressable>
                )}
                {isCurrent ? (
                  <Text variant="sub" tone="ink3" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {lastPayday
                      ? fmt(t.finance.period.lastPaid, { date: date(lastPayday, { day: 'numeric', month: 'long' }) })
                      : rule.startDay !== 1
                        ? fmt(t.finance.period.startsOn, { day: rule.startDay })
                        : t.finance.period.thisMonth}
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
                    <Text variant="sub" weight="600" tone="accentInk" numberOfLines={1}>
                      {t.finance.period.backToCurrent}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              // Periods follow the salary pay-outs: until those are read no period is named, so a
              // wrong month never shows first and then jumps
              <View accessible accessibilityLabel={t.common.loading} style={styles.middle}>
                <Line line={24} height={16} width={150} />
                <Line line={18} height={11} width={104} />
              </View>
            )}
            <IconButton icon="chevronRight" label={t.finance.period.next} variant="felt" size={40} disabled={!ready} onPress={() => step(1)} />
          </View>

          <Overview
            income={shownIncome}
            expenses={shownExpenses}
            isError={failed}
            waiting={waiting}
            onRetry={retry}
            before={waiting ? null : before}
            today={today}
            settle={settle}
            share={rule && cycle ? { open: isOpen(period, rule), payouts } : null}
            onShow={show}
          />
        </View>

        {!failed && cycle && <MonthlySection period={period} today={today} expenses={shownExpenses} waiting={waiting} />}
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
        <OnTheWaySection today={today} ofPeriod={wayOfPeriod} onLayout={remember('cards')} />
        {!failed && <CategoriesSection expenses={shownExpenses} waiting={waiting} onPick={pickCategory} />}
        {rule && <PeriodsChart today={today} rule={rule} payouts={payouts} period={period} series={series} onPick={go} />}
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
  /** Today's midnight: card money due at the bank from today on is still on its way. */
  today: Date
  /** The days card money takes to reach the bank (Settings); null while Settings are read. */
  settle: number | null
  /**
   * A whole money period: whether its money is still to be shared (open) and the salary rows of the
   * pay-outs, kept apart from the other expenses. Null for any other range.
   */
  share: { open: boolean; payouts: Set<string> | undefined } | null
  onShow: (what: 'in' | 'out' | 'bank') => void
}

// A share is below zero when more went out of the bank (or the till) than came into it
const signed = (money: (value: number) => string, value: number) => `${value < 0 ? MINUS : ''}${money(Math.abs(value))}`

// Figures and ₺ are about 0.6em wide in Geologica; dots, commas and spaces about half that
const ems = (text: string) => [...text].reduce((sum, char) => sum + (/[\d₺+−]/.test(char) ? 0.6 : 0.3), 0)

/**
 * One size for both tiles: the largest at which the longer amount fits a tile on this phone, so
 * "188.714,45 ₺" beside "9.850 ₺" never sets the two in different sizes.
 */
function tileSize(screenWidth: number, amounts: string[]) {
  // The screen's gutters and the gap between the tiles, then a tile's own padding
  const room = (screenWidth - 32 - 10) / 2 - 32
  const widest = Math.max(...amounts.map(ems))
  return [24, 22, 20, 18].find((size) => widest * size <= room) ?? 16
}

/** A resting line as tall as the text it stands for, so the card keeps its height when the figures come. */
function Line({ line, height, width }: { line: number; height: number; width: DimensionValue }) {
  return (
    <View style={[styles.line, { height: line }]}>
      <Skeleton height={height} width={width} radius={height / 2} />
    </View>
  )
}

const STRIPES = Array.from({ length: 100 }, (_, index) => index)

/** Card money on its way to the bank: the bank's blue in stripes, bank money that has not landed yet. */
function Stripes({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.stripes}>
      {STRIPES.map((index) => (
        <View key={index} style={[styles.stripe, { left: index * 5, backgroundColor: color }]} />
      ))}
    </View>
  )
}

/**
 * The period's summary: a felt card with what is left of it (in the period still running, what
 * the partners will share, with where that money is now and each partner's part; in a closed one,
 * the salaries paid out of it), then money in and money out as two tiles, each against the period
 * before. Pressing a tile shows its moves.
 */
function Overview({ income, expenses, isError, waiting, onRetry, before, today, settle, share, onShow }: OverviewProps) {
  const c = useColors()
  const { t, fmt, plural, money } = useI18n()
  const labels = useLabels()
  const { width } = useWindowDimensions()

  if (isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
  if (!income || !expenses) {
    const tile = (
      <View style={[styles.tileSkeleton, { backgroundColor: c.felt }]}>
        <Line line={20} height={12} width="45%" />
        <Line line={34} height={22} width="75%" />
        <Line line={18} height={11} width="50%" />
      </View>
    )
    return (
      <>
        <Card padded>
          <Line line={20} height={13} width="34%" />
          <Line line={54} height={38} width="62%" />
          <View style={styles.moneyBar}>
            <Skeleton height={12} radius={4} />
          </View>
          <View style={styles.legend}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.legendCell}>
                <Line line={16} height={10} width="70%" />
                <Line line={21} height={14} width="80%" />
              </View>
            ))}
          </View>
        </Card>
        <View style={styles.tiles}>
          {tile}
          {tile}
        </View>
      </>
    )
  }

  const payouts = share?.payouts
  const salaries = payouts ? expenses.filter((row) => payouts.has(row.id)) : []
  const paid = sumOf(salaries)
  const totalIn = sumOf(income)
  const totalOut = sumOf(expenses) - paid
  const net = totalIn - totalOut
  const leftover = net - paid
  const open = share?.open === true
  const beforeNet = before ? before.in - before.out : 0
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)
  // What each partner gets from the bank and from the till
  const place = leftByPlace(income, expenses, payouts)
  const each = [
    `${t.finance.methodShort.banka} ${signed(money, place.bank / PARTNERS)}`,
    `${t.finance.methodShort.nakit} ${signed(money, place.cash / PARTNERS)}`
  ]
  const headAmount = paid > 0 ? paid : Math.abs(net)
  const netLabel = paid > 0 ? t.finance.balance.paid : net < 0 ? t.finance.balance.short : open ? t.finance.balance.toShare : t.finance.balance.left
  const sharing = open && net > 0
  // Under the figure, unless the per-partner line at the foot of the card says it already
  const netHint =
    paid > 0
      ? Math.abs(leftover) < 1
        ? upperFirst(t.finance.balance.paidAll)
        : upperFirst(fmt(leftover > 0 ? t.finance.balance.paidLeft : t.finance.balance.paidOver, { amount: together(money(Math.abs(leftover))) }))
      : sharing
        ? null
        : before
          ? upperFirst(fmt(beforeNet < 0 ? t.finance.balance.beforeShort : t.finance.balance.before, { amount: together(money(Math.abs(beforeNet))) }))
          : t.finance.balance.leftHint
  const empty = totalIn === 0 && totalOut === 0 && paid === 0
  const negative = paid === 0 && net < 0

  // Where the money to share is now: card money of this period the bank has not credited yet is on
  // its way; the rest of the bank part is in the bank. The three parts add up to the figure above.
  const onTheWay =
    settle === null ? null : sumOf(income.filter((line) => line.method === 'kart' && line.paymentDate && arrivalOf(line.paymentDate, settle) >= today))
  const parts =
    onTheWay === null
      ? null
      : [
          { id: 'bank', label: t.finance.balance.inBank, amount: place.bank - onTheWay, color: c.sky },
          { id: 'way', label: t.finance.balance.bank, amount: onTheWay, color: c.skyTrack, stripes: c.sky },
          { id: 'cash', label: t.finance.methodShort.nakit, amount: place.cash, color: c.cash }
        ]
  // A part below zero cannot be drawn as a length; the words below still say it
  const drawn = parts !== null && parts.every((part) => part.amount >= 0)

  const amountIn = money(totalIn)
  const amountOut = money(totalOut)
  const size = tileSize(width, [amountIn, amountOut])
  const outNote = [paid > 0 ? upperFirst(t.finance.balance.noSalaries) : '', before ? fmt(t.finance.balance.before, { amount: together(money(before.out)) }) : ''].filter(Boolean).join(', ')

  return (
    <>
      <Card padded style={waiting && styles.dim}>
        <View accessible accessibilityLabel={[`${netLabel} ${money(headAmount)}`, netHint].filter(Boolean).join('. ')}>
          <Text weight="500" tone="ink2" style={styles.heroLabel}>
            {netLabel}
          </Text>
          {/* The figure as large as the page allows; ₺ steps down beside it. A shortfall says so in its label and its red */}
          <Text variant="money" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.money, { color: negative ? c.negativeInk : c.ink }]}>
            {formatMoney(headAmount)}
            <Text weight="500" style={[styles.lira, { color: negative ? c.negativeInk : c.ink }]}>
              {' ₺'}
            </Text>
          </Text>
          {netHint ? (
            <Text variant="sub" tone="ink3" style={styles.heroHint}>
              {netHint}
            </Text>
          ) : null}
        </View>

        {sharing && (
          <>
            {parts === null ? (
              <>
                <View style={styles.moneyBar}>
                  <Skeleton height={12} radius={4} />
                </View>
                <View style={styles.legend}>
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={styles.legendCell}>
                      <Line line={16} height={10} width="70%" />
                      <Line line={21} height={14} width="80%" />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                {drawn && (
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.moneyBar}>
                    {parts
                      .filter((part) => part.amount > 0)
                      .map((part) => (
                        <View key={part.id} style={[styles.moneyPart, { flexGrow: part.amount, backgroundColor: part.color }]}>
                          {part.stripes && <Stripes color={part.stripes} />}
                        </View>
                      ))}
                  </View>
                )}
                <View style={styles.legend}>
                  {parts.map((part) => {
                    const amount = signed(money, part.amount)
                    const body = (
                      <>
                        <View style={styles.legendHead}>
                          <View style={[styles.legendKey, { backgroundColor: part.color }]}>{part.stripes && <Stripes color={part.stripes} />}</View>
                          <Text variant="foot" tone="ink3" numberOfLines={2} style={styles.shrink}>
                            {part.label}
                          </Text>
                        </View>
                        <Text weight="600" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.legendAmount}>
                          {amount}
                        </Text>
                      </>
                    )
                    // The money on its way is listed further down, by the day it should arrive
                    return part.id === 'way' && part.amount > 0 ? (
                      <Pressable
                        key={part.id}
                        onPress={() => onShow('bank')}
                        accessibilityRole="button"
                        accessibilityLabel={`${part.label} ${amount}`}
                        accessibilityHint={t.finance.balance.showBank}
                        hitSlop={6}
                        style={({ pressed }) => [styles.legendCell, pressed && styles.pressed]}
                      >
                        {body}
                      </Pressable>
                    ) : (
                      <View key={part.id} accessible accessibilityLabel={`${part.label} ${amount}`} style={styles.legendCell}>
                        {body}
                      </View>
                    )
                  })}
                </View>
              </>
            )}
            <View
              accessible
              accessibilityLabel={`${t.finance.balance.each} ${money(net / PARTNERS)}. ${each.join(', ')}`}
              style={[styles.foot, styles.footRow, { borderTopColor: c.line }]}
            >
              <View style={styles.flex}>
                <Text weight="500" tone="ink2" style={styles.heroLabel}>
                  {t.finance.balance.each}
                </Text>
                <DotLine variant="sub" tone="ink3" tabular numberOfLines={2} parts={each.map(together)} />
              </View>
              <Text tabular weight="600" numberOfLines={1} style={styles.eachAmount}>
                {money(net / PARTNERS)}
              </Text>
            </View>
          </>
        )}

        {!sharing &&
          (empty ? (
            <View style={[styles.foot, { borderTopColor: c.line }]}>
              <Text variant="sub" tone="ink2">
                {t.finance.balance.empty}
              </Text>
            </View>
          ) : byMethod.length > 0 ? (
            <View
              accessible
              accessibilityLabel={`${t.finance.balance.byMethod}: ${byMethod.map((row) => `${methodName(t, labels, row.method)} ${money(row.amount)}`).join(', ')}`}
              style={[styles.foot, styles.footRow, styles.footSplit, { borderTopColor: c.line }]}
            >
              <Text weight="500" tone="ink2" numberOfLines={1} style={[styles.heroLabel, styles.splitLabel]}>
                {t.finance.balance.byMethod}
              </Text>
              <DotLine
                variant="sub"
                weight="500"
                tabular
                align="right"
                parts={byMethod.map((row) => together(`${methodName(t, labels, row.method)} ${money(row.amount)}`))}
                style={styles.flex}
              />
            </View>
          ) : null)}
      </Card>

      <View style={[styles.tiles, waiting && styles.dim]}>
        <StatTile
          label={t.finance.balance.in}
          dot={c.sky}
          value={amountIn}
          valueSize={size}
          sub={plural(t.finance.balance.payments, income.length)}
          note={before ? fmt(t.finance.balance.before, { amount: together(money(before.in)) }) : undefined}
          accessibilityLabel={dots(`${t.finance.balance.in} ${amountIn}`, plural(t.finance.balance.payments, income.length), before && fmt(t.finance.balance.before, { amount: money(before.in) }))}
          accessibilityHint={t.finance.balance.showIn}
          onPress={() => onShow('in')}
        />
        <StatTile
          label={t.finance.balance.out}
          dot={c.out}
          value={amountOut}
          valueSize={size}
          sub={plural(t.finance.balance.expenses, expenses.length - salaries.length)}
          note={outNote || undefined}
          accessibilityLabel={dots(`${t.finance.balance.out} ${amountOut}`, plural(t.finance.balance.expenses, expenses.length - salaries.length), outNote)}
          accessibilityHint={t.finance.balance.showOut}
          onPress={() => onShow('out')}
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
  head: { gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, minHeight: 44 },
  middle: { flex: 1, minWidth: 0, alignItems: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  periodName: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  line: { justifyContent: 'center' },
  heroLabel: { fontSize: 15, lineHeight: 20 },
  money: { marginTop: 4 },
  lira: { fontSize: 30, lineHeight: 50, letterSpacing: 0 },
  heroHint: { marginTop: 2 },
  // One row of parts, each as long as its amount
  moneyBar: { flexDirection: 'row', gap: 3, height: 12, marginTop: 16 },
  moneyPart: { flexBasis: 0, borderRadius: 4, overflow: 'hidden' },
  stripes: { position: 'absolute', top: 0, bottom: 0, left: -16, right: 0, transform: [{ skewX: '-45deg' }] },
  stripe: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  legend: { flexDirection: 'row', gap: 8, marginTop: 12 },
  legendCell: { flex: 1, minWidth: 0 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendKey: { width: 9, height: 9, borderRadius: 3, overflow: 'hidden' },
  legendAmount: { fontSize: 16, lineHeight: 21, marginTop: 3 },
  // The foot of the card under a rule: each partner's part, or how the money came in
  foot: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footSplit: { alignItems: 'flex-start' },
  splitLabel: { flexShrink: 0, maxWidth: '45%' },
  eachAmount: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  tiles: { flexDirection: 'row', gap: 10 },
  tileSkeleton: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 15, gap: 2 }
})
