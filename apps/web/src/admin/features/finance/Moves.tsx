import { useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components'
import { format, isSameYear } from 'date-fns'
import { PlusIcon } from '@phosphor-icons/react'
import type { Expense, IncomeLine } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { matchesSearch } from '@hellokido/core/rules/text.js'
import { useLabels, type Labels } from '../../data/queries'
import { useI18n, type I18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { ChipSelect, Chips, Segmented, type Option } from '../../ui/Choice'
import { SearchField } from '../../ui/Field'
import { Band, Card, CardLink } from '../../ui/Page'
import { useWideLayout } from '../../ui/useMediaQuery'
import { cx } from '../../ui/cx'
import { formatPeriod } from '../children/ChildBits'
import { METHODS } from '../money/PaymentFields'
import { CategoryTablet, IncomeTablet, MINUS, methodName } from './bits'

export type MoveKind = 'all' | 'in' | 'out'
/** `type` is an expense type for money out and the source (package, child, other) for money in. */
export type MoveFilter = { kind: MoveKind; methods: string[]; type: string; query: string }
export const NO_FILTER: MoveFilter = { kind: 'all', methods: [], type: 'any', query: '' }
const isFiltered = (filter: MoveFilter) => filter.kind !== 'all' || filter.methods.length > 0 || filter.type !== 'any' || filter.query.trim() !== ''

/** Where the expense sheet tells whether a saved day is on screen. */
export type VisibleRange = { from: string; to: string }

type Move = {
  key: string
  kind: 'in' | 'out'
  at: Date
  created: number
  amount: number
  method: string
  type: string
  title: string
  meta: string
  /** The weeks a package payment covers, shown after the meta and never split across lines. */
  period?: string
  haystack: string
  glyph: ReactNode
  marks: ReactNode
  href?: string
  onOpen?: () => void
}

type StartTask = ReturnType<typeof useActions>['startTask']

function incomeMove(i18n: I18n, labels: Labels, line: IncomeLine, startTask: StartTask): Move {
  const { t } = i18n
  const forChild = line.source !== 'other'
  const title = forChild ? line.student || t.common.unknown : line.description || labels.incomeCategory(line.category) || t.finance.entry.otherTitle
  const meta =
    line.source === 'package'
      ? labels.packageName(line.packageType)
      : line.source === 'child'
        ? line.description || t.children.detail.fee
        : line.description
          ? labels.incomeCategory(line.category)
          : ''
  const period = line.source === 'package' ? formatPeriod(i18n, line.periodStart, line.periodEnd) || undefined : undefined
  const method = methodName(t, labels, line.method)
  return {
    key: line.key,
    kind: 'in',
    at: new Date(line.paymentDate ?? line.createdAt ?? 0),
    created: new Date(line.createdAt ?? 0).getTime(),
    amount: line.amount,
    method: line.method,
    type: line.source,
    title,
    meta,
    period,
    haystack: [title, meta, period, line.parent, method, line.notes, formatMoney(line.amount)].filter(Boolean).join(' '),
    glyph: forChild ? <Avatar name={line.student} /> : <IncomeTablet code={line.category} />,
    // Archived children keep their payments; a missing status counts as archived, as before
    marks: forChild && line.isActive !== true && <Mark tone="neutral">{t.common.archived}</Mark>,
    // Package payments are corrected on the child's page, where the lesson counts stay in step
    href: line.source === 'package' && line.registrationId ? `/children/${line.registrationId}` : undefined,
    onOpen:
      line.source === 'package'
        ? undefined
        : () => startTask('income', { kind: line.source, registrationId: line.registrationId ?? undefined, entry: line.entry ?? undefined })
  }
}

function expenseMove(t: I18n['t'], labels: Labels, row: Expense, startTask: StartTask, visible: VisibleRange): Move {
  const category = labels.expenseCategory(row.expense_type)
  const title = row.description || category
  const meta = [row.description ? category : '', row.notes].filter(Boolean).join(' · ')
  return {
    key: `x:${row.id}`,
    kind: 'out',
    at: new Date(row.expense_date ?? row.created_at ?? 0),
    created: new Date(row.created_at ?? 0).getTime(),
    amount: Number(row.amount) || 0,
    method: row.payment_method,
    type: row.expense_type,
    title,
    meta,
    haystack: [title, meta, methodName(t, labels, row.payment_method), formatMoney(row.amount)].filter(Boolean).join(' '),
    glyph: <CategoryTablet code={row.expense_type} />,
    marks: row.recurring_expense_id && <Mark tone="neutral">{t.finance.moves.monthly}</Mark>,
    onOpen: () => startTask('expense', { expense: row, visible })
  }
}

/**
 * Every payment received and every expense of the period, newest first and grouped by day, like a
 * bank statement. Filters and search narrow the list only; the summary above always shows the
 * whole period.
 */
export function MovesSection({
  income,
  expenses,
  isError,
  waiting,
  onRetry,
  filter,
  onFilter,
  visible,
  id,
  className,
  fill = false
}: {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  waiting: boolean
  onRetry: () => void
  filter: MoveFilter
  onFilter: (next: MoveFilter) => void
  visible: VisibleRange
  id?: string
  className?: string
  /** Fill the given height and scroll inside it, so the list never sets the page's length */
  fill?: boolean
}) {
  const i18n = useI18n()
  const { t, plural, money, date } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const wide = useWideLayout()
  const first = wide ? 40 : 12
  const [limit, setLimit] = useState(first)
  // A filled card scrolls inside, so it holds the whole period; a page that grows shows it in steps
  const cap = fill ? Infinity : limit

  const moves = useMemo(() => {
    if (!income || !expenses) return null
    return [...income.map((line) => incomeMove(i18n, labels, line, startTask)), ...expenses.map((row) => expenseMove(i18n.t, labels, row, startTask, visible))].sort(
      (a, b) => b.at.getTime() - a.at.getTime() || b.created - a.created
    )
  }, [income, expenses, i18n, labels, startTask, visible])

  const change = (next: Partial<MoveFilter>) => {
    setLimit(first)
    onFilter({ ...filter, ...next })
  }

  const typeOptions = useMemo<Option<string>[]>(() => {
    if (!moves || filter.kind === 'all') return []
    const counts = new Map<string, number>()
    for (const move of moves) if (move.kind === filter.kind) counts.set(move.type, (counts.get(move.type) ?? 0) + 1)
    // A type picked from the expense bars stays offered even if a filter hides its rows
    if (filter.type !== 'any' && !counts.has(filter.type)) counts.set(filter.type, 0)
    const name = (code: string) => (filter.kind === 'in' ? (t.finance.moves.sources[code] ?? code) : labels.expenseCategory(code))
    return [
      { id: 'any', label: t.finance.moves.anyType },
      ...[...counts]
        .map(([code, count]) => ({ id: code, label: name(code), badge: count }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.tag))
    ]
  }, [moves, filter.kind, filter.type, labels, t, i18n.tag])

  const query = filter.query.trim()
  const shown = (moves ?? []).filter(
    (move) =>
      (filter.kind === 'all' || move.kind === filter.kind) &&
      (filter.methods.length === 0 || filter.methods.includes(move.method)) &&
      (filter.type === 'any' || move.type === filter.type) &&
      (!query || matchesSearch(move.haystack, query))
  )
  const filtered = isFiltered(filter)
  const totalIn = shown.reduce((sum, move) => sum + (move.kind === 'in' ? move.amount : 0), 0)
  const totalOut = shown.reduce((sum, move) => sum + (move.kind === 'out' ? move.amount : 0), 0)

  const days: { key: string; day: Date; moves: Move[] }[] = []
  for (const move of shown.slice(0, cap)) {
    const key = format(move.at, 'yyyy-MM-dd')
    const last = days[days.length - 1]
    if (last?.key === key) last.moves.push(move)
    else days.push({ key, day: move.at, moves: [move] })
  }
  const now = new Date()

  return (
    <Card
      id={id}
      title={t.finance.moves.title}
      aside={moves && <span className="text-[0.8125rem] text-ink-3 tabular">{plural(t.finance.moves.count, filtered ? shown.length : moves.length)}</span>}
      className={className}
      bodyClassName={cx(fill && 'flex flex-col')}
      footer={
        moves &&
        shown.length > cap && (
          <CardLink onPress={() => setLimit((count) => count + 60)}>{plural(t.finance.moves.showMore, Math.min(60, shown.length - limit))}</CardLink>
        )
      }
    >
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-0.5 pb-3 sm:px-[1.375rem]">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<MoveKind>
            aria-label={t.finance.moves.kindLabel}
            fit
            options={(['all', 'in', 'out'] as const).map((kind) => ({ id: kind, label: t.finance.moves.kinds[kind] }))}
            value={filter.kind}
            onChange={(kind) => change({ kind, type: 'any' })}
          />
          <SearchField
            value={filter.query}
            onChange={(text) => change({ query: text })}
            placeholder={t.finance.moves.search}
            label={t.finance.moves.search}
            className="min-w-[12rem] flex-1"
          />
        </div>
        {/* Phones: one row that scrolls sideways */}
        <div className="flex items-center gap-2 max-lg:-mx-4 max-lg:-my-1.5 max-lg:overflow-x-auto max-lg:px-4 max-lg:py-1.5 sm:max-lg:-mx-[1.375rem] sm:max-lg:px-[1.375rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chips
            aria-label={t.finance.moves.methodLabel}
            multiple
            options={METHODS.map((method) => ({ id: method, label: t.finance.methodShort[method] ?? method }))}
            selected={filter.methods}
            onChange={(methods) => change({ methods })}
            className="flex-nowrap"
          />
          {filter.kind !== 'all' && typeOptions.length > 1 && (
            <ChipSelect aria-label={t.finance.moves.typeLabel} options={typeOptions} value={filter.type} neutral="any" onChange={(type) => change({ type })} />
          )}
        </div>

        {/* With nothing left, the empty message below carries its own way back */}
        {filtered && shown.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span className="tabular">
              {totalIn > 0 && `+${money(totalIn)}`}
              {totalIn > 0 && totalOut > 0 && ' · '}
              {totalOut > 0 && `${MINUS}${money(totalOut)}`}
            </span>
            <Button size="sm" variant="ghost" className="-ml-2" onPress={() => change(NO_FILTER)}>
              {t.common.clearFilters}
            </Button>
          </div>
        )}
      </div>

      {isError ? (
        <div className="px-4 pb-4 sm:px-[1.375rem]">
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
        </div>
      ) : !moves ? (
        <div aria-hidden className="flex flex-col gap-2 px-4 pt-2 pb-4 sm:px-[1.375rem]">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : moves.length === 0 ? (
        <EmptyState
          className="py-12"
          title={t.finance.moves.empty}
            body={t.finance.moves.emptyBody}
            action={
              <Button variant="secondary" size="sm" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => startTask('expense', { visible })}>
                {t.finance.addExpense}
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            className="py-12"
            title={t.finance.moves.noMatch}
            action={
              <Button variant="secondary" size="sm" onPress={() => change(NO_FILTER)}>
                {t.common.clearFilters}
              </Button>
            }
          />
        ) : (
          <div
            aria-busy={waiting}
            className={cx('pb-2 transition-opacity duration-200', fill && 'min-h-0 flex-1 overflow-y-auto overscroll-contain', waiting && 'opacity-60')}
          >
            {days.map((group) => {
              const day = date(group.day, isSameYear(group.day, now) ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              const net = group.moves.reduce((sum, move) => sum + (move.kind === 'in' ? move.amount : -move.amount), 0)
              return (
                <section key={group.key} aria-labelledby={`day-${group.key}`} className="border-t border-line pt-1.5">
                  <Band sticky={fill} className="justify-between">
                    <h3 id={`day-${group.key}`} className="first-letter:uppercase">
                      {day}
                    </h3>
                    <span className="font-medium text-ink-3">
                      {net >= 0 ? '+' : MINUS}
                      {money(Math.abs(net))}
                    </span>
                  </Band>
                  <ul className="[&>li+li]:border-t [&>li+li]:border-line">
                    {group.moves.map((move) => (
                      <li key={move.key}>
                        <MoveRow move={move} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
    </Card>
  )
}

const rowClass = cx(
  'flex w-full items-center gap-3 px-4 py-[0.6875rem] text-left no-underline outline-none transition-colors duration-150 sm:px-[1.375rem]',
  'data-hovered:bg-hover data-pressed:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
)

function MoveRow({ move }: { move: Move }) {
  const { t, money } = useI18n()
  const labels = useLabels()
  const method = methodName(t, labels, move.method)
  const content = (
    <>
      <span aria-hidden className="shrink-0">
        {move.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[0.96875rem] leading-[1.3125rem] font-medium text-ink">{move.title}</span>
          {move.marks}
        </span>
        {/* Phones give the package and its dates a second line rather than cut the dates off */}
        {(move.meta || move.period) && (
          <span className="block text-[0.84375rem] leading-[1.125rem] text-ink-3 max-lg:line-clamp-2 lg:truncate">
            {move.meta}
            {move.meta && move.period && ' · '}
            {move.period && <span className="whitespace-nowrap">{move.period}</span>}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.96875rem] leading-[1.3125rem] font-semibold whitespace-nowrap text-ink">
          {move.kind === 'in' ? '+' : MINUS}
          {money(move.amount)}
        </span>
        {method && <span className="block text-[0.84375rem] leading-[1.125rem] text-ink-3">{method}</span>}
      </span>
    </>
  )
  return move.href ? (
    <AriaLink href={move.href} className={rowClass}>
      {content}
    </AriaLink>
  ) : (
    <AriaButton onPress={move.onOpen} className={rowClass}>
      {content}
    </AriaButton>
  )
}
