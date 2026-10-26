import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { format, isSameYear } from 'date-fns'
import type { Expense, IncomeLine } from '@hellokido/core/api'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { packageStartText } from '@hellokido/core/view'
import { useLabels, type Labels } from '../../data/queries'
import { tasks, useOpenChild } from '../../lib/navigation'
import { useI18n, type I18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { Avatar, EmptyState, ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Chip, Segmented } from '../../ui/Fields'
import { ActionRow, Card, GroupTitle, Section } from '../../ui/Screen'
import { DOT, DotLine, dots, Text } from '../../ui/Text'
import { CategoryTablet, IncomeTablet, MINUS, methodName, ROW_INSET, TILE, together } from './bits'

export type MoveKind = 'all' | 'in' | 'out'
/** `type` is an expense type for money out, the source (package, child, other) for money in. */
export type MoveFilter = { kind: MoveKind; type: string }
export const NO_FILTER: MoveFilter = { kind: 'all', type: 'any' }

// Moves shown before "show more", and how many more each press adds
const FIRST = 12
const STEP = 40

type Move = {
  key: string
  kind: 'in' | 'out'
  at: Date
  created: number
  amount: number
  method: string
  type: string
  title: string
  /** What the money was for and when; each part takes its own line when they do not fit one. */
  meta: string[]
  glyph: ReactNode
  /** A word beside the name (archived, monthly); it is read out with the row. */
  mark: string | null
  onOpen?: () => void
}

function incomeMove(i18n: I18n, labels: Labels, line: IncomeLine, openChild: (id: string) => void): Move {
  const { t } = i18n
  const forChild = line.source !== 'other'
  const title = forChild ? line.student || t.common.unknown : line.description || labels.incomeCategory(line.category) || t.finance.entry.otherTitle
  const what =
    line.source === 'package'
      ? labels.packageName(line.packageType)
      : line.source === 'child'
        ? line.description || t.children.detail.fee
        : line.description
          ? labels.incomeCategory(line.category)
          : ''
  const period = line.source === 'package' ? packageStartText(i18n, line.periodStart, line.packageType) : ''
  const registrationId = line.registrationId
  return {
    key: line.key,
    kind: 'in',
    at: new Date(line.paymentDate ?? line.createdAt ?? 0),
    created: new Date(line.createdAt ?? 0).getTime(),
    amount: line.amount,
    method: line.method,
    type: line.source,
    title,
    // The weeks a package covers stay together on one line
    meta: [what, together(period)].filter(Boolean),
    glyph: forChild ? <Avatar name={line.student} size={TILE} /> : <IncomeTablet code={line.category} size={TILE} />,
    // Archived children keep their payments; a missing status counts as archived, as before
    mark: forChild && line.isActive !== true ? t.common.archived : null,
    // Package payments are corrected on the child's page, where the lesson counts stay in step
    onOpen: line.source === 'package' ? (registrationId ? () => openChild(registrationId) : undefined) : () => tasks.income({ id: line.id })
  }
}

function expenseMove(t: I18n['t'], labels: Labels, row: Expense): Move {
  const category = labels.expenseCategory(row.expense_type)
  return {
    key: `x:${row.id}`,
    kind: 'out',
    at: new Date(row.expense_date ?? row.created_at ?? 0),
    created: new Date(row.created_at ?? 0).getTime(),
    amount: Number(row.amount) || 0,
    method: row.payment_method,
    type: row.expense_type,
    title: row.description || category,
    meta: [row.description ? category : '', row.notes ?? ''].filter(Boolean),
    glyph: <CategoryTablet code={row.expense_type} size={TILE} />,
    mark: row.recurring_expense_id ? t.finance.moves.monthly : null,
    onOpen: () => tasks.expense({ id: row.id })
  }
}

type Props = {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  waiting: boolean
  onRetry: () => void
  filter: MoveFilter
  onFilter: (next: MoveFilter) => void
  onLayout?: (event: LayoutChangeEvent) => void
}

/**
 * Every payment received and every expense of the month, newest first and grouped by day, like a
 * bank statement. The filter narrows the list only; the figures above always show the whole month.
 */
export function MovesSection({ income, expenses, isError, waiting, onRetry, filter, onFilter, onLayout }: Props) {
  const i18n = useI18n()
  const { t, plural, money, date } = i18n
  const labels = useLabels()
  const openChild = useOpenChild()
  const [limit, setLimit] = useState(FIRST)

  const moves = useMemo(() => {
    if (!income || !expenses) return null
    return [...income.map((line) => incomeMove(i18n, labels, line, openChild)), ...expenses.map((row) => expenseMove(i18n.t, labels, row))].sort(
      (a, b) => b.at.getTime() - a.at.getTime() || b.created - a.created
    )
  }, [income, expenses, i18n, labels, openChild])

  const change = (next: MoveFilter) => {
    setLimit(FIRST)
    onFilter(next)
  }

  const shown = (moves ?? []).filter((move) => (filter.kind === 'all' || move.kind === filter.kind) && (filter.type === 'any' || move.type === filter.type))
  const filtered = filter.kind !== 'all' || filter.type !== 'any'
  const totalIn = shown.reduce((sum, move) => sum + (move.kind === 'in' ? move.amount : 0), 0)
  const totalOut = shown.reduce((sum, move) => sum + (move.kind === 'out' ? move.amount : 0), 0)
  const totals = [totalIn > 0 && together(`+${money(totalIn)}`), totalOut > 0 && together(`${MINUS}${money(totalOut)}`)].filter(Boolean).join(DOT)

  const days: { key: string; day: Date; moves: Move[] }[] = []
  for (const move of shown.slice(0, limit)) {
    const key = format(move.at, 'yyyy-MM-dd')
    const last = days[days.length - 1]
    if (last?.key === key) last.moves.push(move)
    else days.push({ key, day: move.at, moves: [move] })
  }
  const now = new Date()
  const typeName = filter.type === 'any' ? '' : filter.kind === 'in' ? (t.finance.moves.sources[filter.type] ?? filter.type) : labels.expenseCategory(filter.type)

  return (
    <Section onLayout={onLayout} title={t.finance.moves.title} aside={moves ? plural(t.finance.moves.count, filtered ? shown.length : moves.length) : undefined}>
      <View style={styles.controls}>
        <Segmented<MoveKind>
          options={(['all', 'in', 'out'] as const).map((kind) => ({ id: kind, label: t.finance.moves.kinds[kind] }))}
          value={filter.kind}
          onChange={(kind) => change({ kind, type: 'any' })}
        />
        {/* With nothing left, the empty message below carries its own way back */}
        {filtered && shown.length > 0 && (
          <View style={styles.filterLine}>
            {typeName !== '' && (
              <Chip
                label={typeName}
                selected
                removable
                onPress={() => change({ ...filter, type: 'any' })}
                accessibilityLabel={`${typeName}, ${t.common.clearFilters}`}
              />
            )}
            <Text variant="sub" weight="500" tone="ink2" tabular numberOfLines={1} style={styles.flex}>
              {totals}
            </Text>
          </View>
        )}
      </View>

      {isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      ) : !moves ? (
        <ListSkeleton rows={5} />
      ) : moves.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt"
            title={t.finance.moves.empty}
            body={t.finance.moves.emptyBody}
            action={
              <Button size="sm" icon="add" onPress={() => tasks.expense()}>
                {t.finance.addExpense}
              </Button>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <EmptyState
          title={t.finance.moves.noMatchFilter}
          action={
            <Button size="sm" onPress={() => change(NO_FILTER)}>
              {t.common.clearFilters}
            </Button>
          }
        />
      ) : (
        <View style={[styles.days, waiting && styles.dim]}>
          {days.map((group) => (
            <View key={group.key}>
              <GroupTitle>
                {upperFirst(
                  date(group.day, isSameYear(group.day, now) ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                )}
              </GroupTitle>
              <Card inset={ROW_INSET}>
                {group.moves.map((move) => (
                  <MoveRow key={move.key} move={move} />
                ))}
              </Card>
            </View>
          ))}
          {shown.length > limit && (
            // A card of its own: the days above are cards too, and none of them is where the rest goes
            <Card>
              <ActionRow label={plural(t.finance.moves.showMore, Math.min(STEP, shown.length - limit))} onPress={() => setLimit((count) => count + STEP)} />
            </Card>
          )}
        </View>
      )}
    </Section>
  )
}

function MoveRow({ move }: { move: Move }) {
  const c = useColors()
  const { t, money } = useI18n()
  const labels = useLabels()
  const method = methodName(t, labels, move.method)
  // The sign, the figure and ₺ never part across lines
  const amount = together(`${move.kind === 'in' ? '+' : MINUS}${money(move.amount)}`)
  const body = (
    <>
      {move.glyph}
      <View style={styles.flex}>
        <View style={styles.nameLine}>
          <Text weight="500" numberOfLines={1} style={styles.shrink}>
            {move.title}
          </Text>
          {move.mark ? <Mark tone="neutral">{move.mark}</Mark> : null}
        </View>
        {move.meta.length > 0 ? <DotLine variant="sub" tone="ink3" numberOfLines={2} parts={move.meta} /> : null}
      </View>
      <View style={styles.amount}>
        <Text weight="600" tabular numberOfLines={1}>
          {amount}
        </Text>
        {method ? (
          <Text variant="sub" tone="ink3" numberOfLines={1}>
            {method}
          </Text>
        ) : null}
      </View>
    </>
  )
  if (!move.onOpen) return <View style={styles.move}>{body}</View>
  return (
    <Pressable
      onPress={move.onOpen}
      accessibilityRole="button"
      accessibilityLabel={[move.title, move.mark, dots(...move.meta), amount, method].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.move, pressed && { backgroundColor: c.pressed }]}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  controls: { gap: 10, marginBottom: 14 },
  filterLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, minHeight: 34 },
  days: { gap: 18 },
  dim: { opacity: 0.6 },
  move: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  // A word beside the name (archived, monthly) as a quiet mark: it gives way before the name does
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  amount: { alignItems: 'flex-end', flexShrink: 0 }
})
