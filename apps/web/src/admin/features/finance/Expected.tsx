import { useMemo, useState } from 'react'
import type { IncomeLine } from '@hellokido/core/api'
import { useLabels, usePendingIncome, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { LoadError } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Section } from '../../ui/Page'
import { Peg } from '../../ui/signature'
import { formatPeriod, shortDate } from '../children/ChildBits'
import { FREE } from '../children/rules'
import { ChildLink } from '../today/sections'
import { IncomeTablet, ListSkeleton, Rows, sumOf } from './bits'

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
 * free participation never wait for money.
 */
export function ExpectedSection({ todayKey, className }: { todayKey: string; className?: string }) {
  const i18n = useI18n()
  const { t, fmt, plural, money } = i18n
  const labels = useLabels()
  const { startTask } = useActions()
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
    if (line.source === 'other') startTask('income', { kind: 'other', entry: line.entry ?? undefined, collect: true })
    else startTask('payment', { registrationId: line.registrationId ?? undefined, choice: 'collect', entryId: line.source === 'child' ? line.id : undefined })
  }

  return (
    <Section boxed title={t.finance.expected.title} aside={total > 0 ? <span className="font-medium text-ink tabular">{money(total)}</span> : undefined} className={className}>
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
        <p className="text-sm text-ink-2">{t.finance.expected.empty}</p>
      ) : (
        <>
          <Rows>
            {shown.map((line) => {
              const due =
                line.dueDate &&
                (line.dueDate < todayKey ? (
                  <span className="font-medium text-action-ink">{fmt(t.finance.expected.overdue, { date: shortDate(i18n, `${line.dueDate}T00:00:00`) })}</span>
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
                <li key={line.key} className="flex items-center gap-3 py-2.5">
                  {line.source === 'other' ? (
                    <IncomeTablet code={line.category} />
                  ) : (
                    <Peg seat={{ id: line.registrationId ?? line.key, name: line.student, status: 'scheduled' }} size="md" />
                  )}
                  <div className="min-w-0 flex-1">
                    {line.source !== 'other' && line.registrationId ? (
                      <ChildLink id={line.registrationId} name={title} className="block" />
                    ) : (
                      <p className="truncate text-[0.9375rem] font-medium text-ink">{title}</p>
                    )}
                    <p className="text-[0.8125rem] text-ink-3 text-pretty">
                      {what}
                      {/* The dot stays at the end of a line, never at the start of the next */}
                      {what && period && ' · '}
                      {period && <span className="whitespace-nowrap">{period}</span>}
                      {(what || period) && due && ' · '}
                      {due}
                    </p>
                  </div>
                  {line.amount > 0 ? (
                    <span className="shrink-0 text-sm font-semibold tabular">{money(line.amount)}</span>
                  ) : (
                    <span className="shrink-0 text-[0.8125rem] text-ink-3">{t.finance.expected.noAmount}</span>
                  )}
                  <Button size="sm" variant="secondary" className="shrink-0 max-lg:h-10" onPress={() => collect(line)}>
                    {line.source === 'other' ? t.finance.expected.received : t.finance.expected.collect}
                  </Button>
                </li>
              )
            })}
          </Rows>
          {lines.length > FIRST + 1 && (
            <Button variant="ghost" size="sm" className="mt-1 -ml-3" onPress={() => setUnfolded((on) => !on)}>
              {unfolded ? t.common.showLess : plural(t.finance.expected.more, lines.length - FIRST)}
            </Button>
          )}
        </>
      )}
    </Section>
  )
}
