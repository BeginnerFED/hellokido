import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { format, isSameDay, subDays } from 'date-fns'
import { addExpense, cardPaymentsSince, deleteExpense, listRecurring, type Expense, type IncomeLine, type RecurringExpense } from '@hellokido/core/api'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { arrivalOf, dueDayInPeriod, formatPeriod, FREE, inPeriod, shortDate, type Period } from '@hellokido/core/view'
import { keys, useCatalog, useLabels, usePendingIncome, useRefresh, useRegistrations } from '../../data/queries'
import { tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { useActionMenu } from '../../ui/ActionMenu'
import { Avatar, DateTile, ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { ActionRow, Card, GroupFooter, QuietCard, QuietRow, Section } from '../../ui/Screen'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { ChildName } from '../today/sections'
import { CategoryTablet, IncomeTablet, methodName, ROW_INSET, sumOf, TILE, together } from './bits'

// Rows shown before a list folds; a couple more than this are shown in full
const FIRST = 5

// ---------------------------------------------------------------------------------------------

/**
 * Rent, salaries and bills of the period on screen (a month long: 1–31 Oct, or 10 Oct – 9 Nov when
 * periods start on the 10th). A fixed amount is recorded with one tap (and can be undone from the
 * message); an amount that changes opens the expense form filled in.
 */
export function MonthlySection({ period, today, expenses, waiting }: { period: Period; today: Date; expenses: Expense[] | undefined; waiting: boolean }) {
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const menu = useActionMenu()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })
  const [busy, setBusy] = useState<string | null>(null)
  // A second tap in the same moment would record the expense twice; state is too late to stop it
  const recording = useRef(false)

  const current = inPeriod(period, today)
  const future = period.start > today
  const active = useMemo(() => (templates.data ?? []).filter((row) => row.is_active), [templates.data])

  // The latest expense each template produced in this period
  const recorded = useMemo(() => {
    const map = new Map<string, Expense>()
    for (const row of expenses ?? []) {
      if (!row.recurring_expense_id) continue
      const before = map.get(row.recurring_expense_id)
      if (!before || new Date(row.expense_date ?? 0) > new Date(before.expense_date ?? 0)) map.set(row.recurring_expense_id, row)
    }
    return map
  }, [expenses])
  const done = active.filter((row) => recorded.has(row.id)).length

  // This period: the day it is recorded is the day it was paid. Another period: its usual day there.
  const dayFor = (row: RecurringExpense) => {
    if (current) return new Date()
    const day = dueDayInPeriod(period, row.day_of_month)
    day.setHours(12, 0, 0, 0)
    return day
  }

  const undo = async (id: string) => {
    try {
      await deleteExpense(id)
      toast({ tone: 'info', title: t.finance.monthly.undone })
    } catch {
      toast({ tone: 'error', title: t.finance.monthly.undoFailed })
    } finally {
      refresh.finance()
    }
  }

  const record = async (row: RecurringExpense) => {
    const when = dayFor(row)
    if (row.amount == null) {
      tasks.expense({ templateId: row.id, day: when.toISOString() })
      return
    }
    if (recording.current) return
    recording.current = true
    setBusy(row.id)
    try {
      const id = await addExpense({
        expense_type: row.expense_type,
        amount: Number(row.amount),
        description: row.title,
        expense_date: when.toISOString(),
        payment_method: row.payment_method,
        notes: null,
        recurring_expense_id: row.id
      })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refresh.finance()
      toast({
        title: fmt(t.finance.monthly.saved, { title: row.title }),
        body: fmt(t.finance.monthly.savedBody, { date: date(when, { day: 'numeric', month: 'long' }), amount: money(row.amount) }),
        action: { label: t.common.undo, onPress: () => void undo(id) }
      })
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast({ tone: 'error', title: t.finance.expense.failed })
    } finally {
      recording.current = false
      setBusy(null)
    }
  }

  const more = (row: RecurringExpense, expense: Expense | undefined) =>
    menu.open(row.title, [
      ...(expense ? [{ label: t.finance.expense.editTitle, icon: 'receipt' as const, onPress: () => tasks.expense({ id: expense.id }) }] : []),
      { label: t.finance.template.editTitle, icon: 'edit' as const, onPress: () => tasks.recurring(row.id) }
    ])

  return (
    <Section title={t.finance.monthly.title} aside={active.length > 0 && expenses && !waiting ? fmt(t.finance.monthly.progress, { done, total: active.length }) : undefined}>
      {menu.element}
      {templates.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
      ) : !templates.data || !expenses ? (
        <ListSkeleton rows={2} />
      ) : active.length === 0 ? (
        <Card>
          <QuietRow>{t.finance.monthly.empty}</QuietRow>
          <ActionRow icon="add" label={t.finance.monthly.add} onPress={() => tasks.recurring()} />
        </Card>
      ) : (
        <Card inset={ROW_INSET} style={waiting && styles.dim}>
          {[
            ...active.map((row) => {
              const expense = recorded.get(row.id)
              const due = dueDayInPeriod(period, row.day_of_month)
              const late = !expense && !future && (!current || today > due)
              const amount = row.amount != null ? together(money(row.amount)) : t.finance.monthly.varies
              const detail = expense
                ? `${fmt(t.finance.monthly.recorded, { date: date(expense.expense_date ?? expense.created_at ?? '', { day: 'numeric', month: 'short' }) })}${DOT}${together(money(expense.amount))}`
                : [amount, labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method)].filter(Boolean).join(DOT)
              return (
                <View key={row.id} style={styles.monthlyRow}>
                  {/* The row opens what can be done with it; the tile shows the day, read out with the words */}
                  <Pressable
                    onPress={() => more(row, expense)}
                    accessibilityRole="button"
                    accessibilityLabel={[row.title, !expense && fmt(t.finance.monthly.day, { day: row.day_of_month }), late && t.finance.monthly.late, detail].filter(Boolean).join(', ')}
                    accessibilityHint={fmt(t.finance.monthly.more, { title: row.title })}
                    style={({ pressed }) => [styles.monthlyWords, pressed && styles.pressed]}
                  >
                    <DateTile day={due.getDate()} under={date(due, { month: 'short' })} late={late} />
                    <View style={styles.flex}>
                      <Text weight="500" numberOfLines={1}>
                        {row.title}
                      </Text>
                      {expense ? (
                        <Mark tone="positive">{detail}</Mark>
                      ) : late ? (
                        <Mark tone="action">{`${t.finance.monthly.late}${DOT}${amount}`}</Mark>
                      ) : (
                        <Text variant="sub" tone="ink3" numberOfLines={2}>
                          {detail}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  {!expense && (
                    <Button
                      size="sm"
                      busy={busy === row.id}
                      disabled={waiting || (busy !== null && busy !== row.id)}
                      accessibilityLabel={fmt(t.finance.monthly.recordLabel, { title: row.title })}
                      onPress={() => void record(row)}
                    >
                      {t.finance.monthly.record}
                    </Button>
                  )}
                </View>
              )
            }),
            // Adding one is the last row of the list, as Calendar's "Add Alert"
            <ActionRow key="add" icon="add" label={t.finance.monthly.add} onPress={() => tasks.recurring()} />
          ]}
        </Card>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

/**
 * Overdue fees first, then package payments of the current periods, then fees with a later due day,
 * then the rest. A fee without a due day waits behind everything that has one.
 */
function rank(line: IncomeLine, todayKey: string) {
  if (line.dueDate && line.dueDate < todayKey) return 0
  if (line.source === 'package') return 1
  if (line.dueDate) return 2
  return 3
}

/**
 * Money still to come, whatever the month on screen: unpaid package payments of active children,
 * their expected fees, and expected income of the workshop (a booked party). Archived children and
 * free participation never wait for money.
 */
export function ExpectedSection({ todayKey, onLayout }: { todayKey: string; onLayout?: (event: LayoutChangeEvent) => void }) {
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const pending = usePendingIncome()
  const registrations = useRegistrations()
  const [unfolded, setUnfolded] = useState(false)

  const lines = useMemo(() => {
    if (!pending.data || !registrations.data) return null
    const active = new Set(registrations.data.filter((row) => row.is_active === true).map((row) => row.id))
    return pending.data
      .filter((line) =>
        line.source === 'other' ? true : Boolean(line.registrationId && active.has(line.registrationId)) && !(line.source === 'package' && line.packageType === FREE)
      )
      .sort(
        (a, b) =>
          rank(a, todayKey) - rank(b, todayKey) ||
          (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0) ||
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )
  }, [pending.data, registrations.data, todayKey])

  const shown = !lines ? [] : unfolded || lines.length <= FIRST + 1 ? lines : lines.slice(0, FIRST)
  // A registration saved before its price was agreed waits with no amount; it is not "0 ₺"
  const total = lines ? sumOf(lines) : 0

  const collect = (line: IncomeLine) => {
    if (line.source === 'other') tasks.income({ id: line.id, collect: true })
    else tasks.payment({ registrationId: line.registrationId ?? undefined, choice: 'collect', entryId: line.source === 'child' ? line.id : undefined })
  }

  return (
    <Section onLayout={onLayout} title={t.finance.expected.title} aside={total > 0 ? money(total) : undefined}>
      {pending.isError || registrations.isError ? (
        <LoadError
          message={t.common.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => {
            void pending.refetch()
            void registrations.refetch()
          }}
        />
      ) : !lines ? (
        <ListSkeleton />
      ) : lines.length === 0 ? (
        <QuietCard>{t.finance.expected.empty}</QuietCard>
      ) : (
        <Card inset={ROW_INSET}>
          {[
            ...shown.map((line) => {
              const overdue = Boolean(line.dueDate && line.dueDate < todayKey)
              const due = line.dueDate ? fmt(overdue ? t.finance.expected.overdue : t.finance.expected.due, { date: together(shortDate(i18n, `${line.dueDate}T00:00:00`)) }) : ''
              const period = line.source === 'package' ? formatPeriod(i18n, line.periodStart, line.periodEnd) : ''
              const what =
                line.source === 'package'
                  ? labels.packageName(line.packageType)
                  : line.source === 'child'
                    ? line.description || t.children.detail.fee
                    : line.description
                      ? labels.incomeCategory(line.category)
                      : ''
              const title = line.source === 'other' ? line.description || labels.incomeCategory(line.category) || t.finance.entry.otherTitle : line.student
              const rest = [what, period && together(period)].filter(Boolean).join(DOT)
              return (
                <View key={line.key} style={styles.personRow}>
                  {line.source === 'other' ? <IncomeTablet code={line.category} size={TILE} /> : <Avatar name={line.student} size={TILE} />}
                  <View style={styles.flex}>
                    {line.source !== 'other' && line.registrationId ? (
                      <ChildName id={line.registrationId} name={title} />
                    ) : (
                      <Text weight="500" numberOfLines={1}>
                        {title}
                      </Text>
                    )}
                    <Text variant="sub" tone="ink3" numberOfLines={3}>
                      <Text variant="sub" weight="600" tone="ink" tabular>
                        {line.amount > 0 ? together(money(line.amount)) : t.finance.expected.noAmount}
                      </Text>
                      {rest ? `${DOT}${rest}` : ''}
                      {due ? DOT : ''}
                      {due ? (
                        <Text variant="sub" weight={overdue ? '500' : '400'} tone={overdue ? 'amberInk' : 'ink3'}>
                          {due}
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                  {/* The button says whose money it is, since a screen reader may reach it on its own */}
                  <Button size="sm" accessibilityLabel={`${line.source === 'other' ? t.finance.expected.received : t.finance.expected.collect}: ${title}`} onPress={() => collect(line)}>
                    {line.source === 'other' ? t.finance.expected.received : t.finance.expected.collect}
                  </Button>
                </View>
              )
            }),
            lines.length > FIRST + 1 && (
              <ActionRow key="more" label={unfolded ? t.common.showLess : plural(t.finance.expected.more, lines.length - FIRST)} onPress={() => setUnfolded((on) => !on)} />
            )
          ]}
        </Card>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

// Names of the payers shown for a day before "+2"
const NAMES = 2

/** Card payments not credited yet, whatever the period on screen, grouped by the day they should arrive. */
export function useCardsOnTheWay(today: Date) {
  const catalog = useCatalog()
  const days = catalog.data?.settings.cardSettlementDays ?? 30
  const rate = catalog.data?.settings.cardCommissionRate ?? 0
  const since = useMemo(() => subDays(today, days), [today, days])
  const cards = useQuery({
    queryKey: keys.finance('cards', since.toISOString()),
    queryFn: () => cardPaymentsSince(since),
    enabled: !catalog.isPending
  })

  const groups = useMemo(() => {
    if (!cards.data) return null
    const byDay = new Map<string, { day: Date; lines: IncomeLine[]; amount: number }>()
    for (const line of cards.data) {
      if (!line.paymentDate) continue
      const day = arrivalOf(line.paymentDate, days)
      if (day < today) continue
      const key = format(day, 'yyyy-MM-dd')
      const group = byDay.get(key) ?? { day, lines: [], amount: 0 }
      group.lines.push(line)
      group.amount += line.amount
      byDay.set(key, group)
    }
    return [...byDay.values()].sort((a, b) => a.day.getTime() - b.day.getTime())
  }, [cards.data, days, today])

  const total = (groups ?? []).reduce((sum, group) => sum + group.amount, 0)
  const count = (groups ?? []).reduce((sum, group) => sum + group.lines.length, 0)
  return { cards, groups, total, count, days, rate }
}

/**
 * Card payments the bank has not credited yet, by the day they should arrive. Card money comes in
 * about a month later, so this is the difference between "money in" and the bank account.
 */
export function OnTheWaySection({
  today,
  ofPeriod,
  onLayout
}: {
  today: Date
  /** How much of it the viewed period's split counts, said when earlier periods' money is on its way too. */
  ofPeriod?: number | null
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const { t, fmt, plural, money, date, tag } = useI18n()
  const labels = useLabels()
  const { cards, groups, total, days, rate } = useCardsOnTheWay(today)
  const [unfolded, setUnfolded] = useState(false)
  const shown = !groups ? [] : unfolded || groups.length <= FIRST + 1 ? groups : groups.slice(0, FIRST)
  const ratePercent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 }).format(rate / 100)
  const who = (line: IncomeLine) => (line.source === 'other' ? line.description || labels.incomeCategory(line.category) : line.student)

  return (
    <Section
      onLayout={onLayout}
      title={t.finance.card.title}
      aside={total > 0 ? money(total) : undefined}
      description={
        ofPeriod != null && total > 0 && ofPeriod !== total
          ? `${plural(t.finance.card.note, days)} ${fmt(t.finance.balance.bankOfPeriod, { amount: money(ofPeriod) })}.`
          : plural(t.finance.card.note, days)
      }
    >
      {cards.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void cards.refetch()} />
      ) : !groups ? (
        <ListSkeleton rows={2} />
      ) : groups.length === 0 ? (
        <QuietCard>{t.finance.card.empty}</QuietCard>
      ) : (
        <>
          <Card>
            {[
              ...shown.map((group) => {
                const names = group.lines.slice(0, NAMES).map(who).filter(Boolean)
                const more = group.lines.length - NAMES
                const when = isSameDay(group.day, today) ? t.finance.card.arrivesToday : upperFirst(fmt(t.finance.card.arrives, { date: date(group.day, { day: 'numeric', month: 'long' }) }))
                const payers = `${names.join(', ')}${more > 0 ? ` +${more}` : ''}`
                return (
                  <View
                    key={group.day.toISOString()}
                    accessible
                    accessibilityLabel={[when, plural(t.finance.card.payments, group.lines.length), payers, money(group.amount)].filter(Boolean).join(', ')}
                    style={styles.cardRow}
                  >
                    {/* The tile shows the day; the words say whose money it is and that the day is a guess */}
                    <DateTile day={group.day.getDate()} under={date(group.day, { month: 'short' })} />
                    <View style={styles.flex}>
                      <Text weight="500" numberOfLines={1}>
                        {payers || plural(t.finance.card.payments, group.lines.length)}
                      </Text>
                      <Text variant="sub" tone="ink3" numberOfLines={2}>
                        {payers ? `${plural(t.finance.card.payments, group.lines.length)}${DOT}` : ''}
                        {when}
                      </Text>
                    </View>
                    <Text weight="600" tabular numberOfLines={1} style={styles.amount}>
                      {money(group.amount)}
                    </Text>
                  </View>
                )
              }),
              groups.length > FIRST + 1 && (
                <ActionRow key="more" label={unfolded ? t.common.showLess : t.common.showAll} onPress={() => setUnfolded((on) => !on)} />
              )
            ]}
          </Card>
          {rate > 0 && <GroupFooter>{fmt(t.finance.card.commission, { rate: ratePercent, amount: together(money(total * (1 - rate / 100))) })}</GroupFooter>}
        </>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

const percentFormats = new Map<string, Intl.NumberFormat>()

function percent(tag: string, share: number) {
  let formatter = percentFormats.get(tag)
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 })
    percentFormats.set(tag, formatter)
  }
  // A small share never rounds down to nothing
  return share > 0 && share < 0.01 ? `<${formatter.format(0.01)}` : formatter.format(share)
}

/**
 * The month's expenses by type, largest first, as bars on one scale. Every bar is the same colour:
 * the types are names, not an order. Pressing a type shows its expenses in the list.
 */
export function CategoriesSection({ expenses, waiting, onPick }: { expenses: Expense[] | undefined; waiting: boolean; onPick: (code: string) => void }) {
  const c = useColors()
  const { t, fmt, money, tag } = useI18n()
  const labels = useLabels()

  const groups = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of expenses ?? []) totals.set(row.expense_type, (totals.get(row.expense_type) ?? 0) + (Number(row.amount) || 0))
    return [...totals].map(([code, amount]) => ({ code, amount })).sort((a, b) => b.amount - a.amount)
  }, [expenses])
  const total = groups.reduce((sum, group) => sum + group.amount, 0)
  const largest = groups[0]?.amount ?? 0

  return (
    <Section title={t.finance.categories.title}>
      {!expenses ? (
        <ListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <QuietCard>{t.finance.categories.empty}</QuietCard>
      ) : (
        <Card inset={ROW_INSET} style={waiting && styles.dim}>
          {groups.map((group) => {
            const name = labels.expenseCategory(group.code)
            return (
              <Pressable
                key={group.code}
                onPress={() => onPick(group.code)}
                accessibilityRole="button"
                accessibilityLabel={`${fmt(t.finance.categories.show, { category: name })}: ${money(group.amount)}`}
                style={({ pressed }) => [styles.categoryRow, pressed && { backgroundColor: c.pressed }]}
              >
                <CategoryTablet code={group.code} size={TILE} />
                <View style={styles.flex}>
                  <View style={styles.categoryHead}>
                    <Text weight="500" numberOfLines={1} style={styles.flex}>
                      {name}
                    </Text>
                    <Text weight="600" tabular>
                      {money(group.amount)}
                    </Text>
                  </View>
                  <View style={styles.barLine}>
                    <View style={[styles.flex, styles.rail, { backgroundColor: c.track }]}>
                      <View style={[styles.bar, { width: `${largest > 0 ? Math.max((group.amount / largest) * 100, 2) : 0}%`, backgroundColor: c.out }]} />
                    </View>
                    <Text variant="foot" tone="ink3" tabular align="right" style={styles.percent}>
                      {percent(tag, total > 0 ? group.amount / total : 0)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </Card>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
  // The date tile keeps 12px before the words, the button sits 10px after them
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 14, paddingVertical: 12, minHeight: 68 },
  monthlyWords: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14, paddingVertical: 12, minHeight: 64 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 68 },
  amount: { flexShrink: 0 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  categoryHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  // The share of the largest type on a rail, so a small bar still reads against the whole
  rail: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  percent: { width: 40 }
})
