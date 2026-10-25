import { useMemo, useState } from 'react'
import type { IncomeLine } from '@hellokido/core/api'
import { useLabels, usePendingIncome, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, LoadError } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Card, CardLink } from '../../ui/Page'
import { formatPeriod, shortDate } from '../children/ChildBits'
import { FREE } from '../children/rules'
import { ChildLink } from '../today/sections'
import { IncomeTablet, ListSkeleton, Rows, cardPad, sumOf } from './bits'

const FIRST = 5

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
 * Money still to come, whatever the period on screen: unpaid package payments of active children,
 * their expected fees, and expected income of the workshop (a booked party). Archived children and
 * free participation never wait for money. The figure at the top of the page and the list read the
 * same rows, so they always agree.
 */
export function useExpected(todayKey: string) {
  const pending = usePendingIncome()
  const registrations = useRegistrations()

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

  // A registration saved before its price was agreed waits with no amount; it is not "0 ₺"
  const total = lines ? sumOf(lines) : 0
  const overdue = lines ? lines.filter((line) => line.dueDate && line.dueDate < todayKey).length : 0
  const next = lines?.map((line) => line.dueDate).filter((day): day is string => Boolean(day && day >= todayKey)).sort()[0] ?? null
  const unpriced = lines ? lines.filter((line) => !(line.amount > 0)).length : 0
  return {
    lines,
    total,
    overdue,
    next,
    unpriced,
    isError: pending.isError || registrations.isError,
    retry: () => {
      void pending.refetch()
      void registrations.refetch()
    }
  }
}

export function ExpectedSection({ todayKey, id, className }: { todayKey: string; id?: string; className?: string }) {
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
  const { lines, total, isError, retry } = useExpected(todayKey)
  const [unfolded, setUnfolded] = useState(false)

  const shown = !lines ? [] : unfolded || lines.length <= FIRST + 1 ? lines : lines.slice(0, FIRST)

  const collect = (line: IncomeLine) => {
    if (line.source === 'other') startTask('income', { kind: 'other', entry: line.entry ?? undefined, collect: true })
    else startTask('payment', { registrationId: line.registrationId ?? undefined, choice: 'collect', entryId: line.source === 'child' ? line.id : undefined })
  }

  return (
    <Card
      id={id}
      title={t.finance.expected.title}
      aside={total > 0 ? <span className="font-semibold text-ink">{money(total)}</span> : undefined}
      className={className}
      footer={
        lines &&
        lines.length > FIRST + 1 && (
          <CardLink onPress={() => setUnfolded((on) => !on)}>{unfolded ? t.common.showLess : plural(t.finance.expected.more, lines.length - FIRST)}</CardLink>
        )
      }
    >
      {isError ? (
        <div className={cardPad}>
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={retry} />
        </div>
      ) : !lines ? (
        <ListSkeleton />
      ) : lines.length === 0 ? (
        <p className={`${cardPad} text-[0.9375rem] text-ink-2`}>{t.finance.expected.empty}</p>
      ) : (
        <Rows className="pb-1.5">
          {shown.map((line) => {
            const due =
              line.dueDate &&
              (line.dueDate < todayKey ? (
                <span className="font-medium text-amber-ink">{fmt(t.finance.expected.overdue, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) })}</span>
              ) : (
                fmt(t.finance.expected.due, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) })
              ))
            const period = line.source === 'package' ? formatPeriod(i18n, line.periodStart, line.periodEnd) : null
            const what =
              line.source === 'package'
                ? labels.packageName(line.packageType)
                : line.source === 'child'
                  ? line.description || t.children.detail.fee
                  : line.description
                    ? labels.incomeCategory(line.category)
                    : ''
            const title = line.source === 'other' ? line.description || labels.incomeCategory(line.category) || t.finance.entry.otherTitle : line.student
            return (
              <li key={line.key} className="flex items-center gap-3 py-[0.6875rem]">
                {line.source === 'other' ? <IncomeTablet code={line.category} /> : <Avatar name={line.student} />}
                <div className="min-w-0 flex-1">
                  {line.source !== 'other' && line.registrationId ? (
                    <ChildLink id={line.registrationId} name={title} className="block" />
                  ) : (
                    <p className="truncate text-[0.96875rem] leading-[1.3125rem] font-medium text-ink">{title}</p>
                  )}
                  <p className="text-[0.84375rem] leading-[1.125rem] text-ink-3 text-pretty">
                    {what}
                    {/* The dot stays at the end of a line, never at the start of the next */}
                    {what && period && ' · '}
                    {period && <span className="whitespace-nowrap">{period}</span>}
                    {(what || period) && due && ' · '}
                    {due}
                  </p>
                </div>
                {line.amount > 0 ? (
                  <span className="shrink-0 text-[0.96875rem] font-semibold whitespace-nowrap">{money(line.amount)}</span>
                ) : (
                  <span className="shrink-0 text-[0.84375rem] text-ink-3">{t.finance.expected.noAmount}</span>
                )}
                <Button size="sm" variant="secondary" className="shrink-0 max-lg:h-10" onPress={() => collect(line)}>
                  {line.source === 'other' ? t.finance.expected.received : t.finance.expected.collect}
                </Button>
              </li>
            )
          })}
        </Rows>
      )}
    </Card>
  )
}
