import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isSameDay, subDays } from 'date-fns'
import { cardPaymentsSince, type IncomeLine } from '@hellokido/core/api'
import { arrivalOf } from '@hellokido/core/view'
import { keys, useCatalog, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Section } from '../../ui/Page'
import { ListSkeleton, Rows } from './bits'

const FIRST = 5
const NAMES = 2

// The day a card payment should reach the bank; shared with the phone app
export { arrivalOf }

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
export function OnTheWaySection({ today, id, className }: { today: Date; id?: string; className?: string }) {
  const { t, fmt, plural, money, date, tag } = useI18n()
  const labels = useLabels()
  const { cards, groups, total, days, rate } = useCardsOnTheWay(today)
  const [unfolded, setUnfolded] = useState(false)
  const shown = !groups ? [] : unfolded || groups.length <= FIRST + 1 ? groups : groups.slice(0, FIRST)
  const ratePercent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 }).format(rate / 100)

  const who = (line: IncomeLine) => (line.source === 'other' ? line.description || labels.incomeCategory(line.category) : line.student)

  return (
    <Section
      boxed
      id={id}
      title={t.finance.card.title}
      aside={total > 0 ? <span className="font-medium text-ink tabular">{money(total)}</span> : undefined}
      className={className}
    >
      <p className="mb-2 text-[0.8125rem] text-ink-3 text-pretty">{plural(t.finance.card.note, days)}</p>
      {cards.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void cards.refetch()} />
      ) : !groups ? (
        <ListSkeleton rows={2} />
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink-2">{t.finance.card.empty}</p>
      ) : (
        <>
          <Rows>
            {shown.map((group) => {
              const names = group.lines.slice(0, NAMES).map(who).filter(Boolean)
              const more = group.lines.length - NAMES
              return (
                <li key={group.day.toISOString()} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-medium text-ink">
                      {isSameDay(group.day, today) ? t.finance.card.arrivesToday : fmt(t.finance.card.arrives, { date: date(group.day, { day: 'numeric', month: 'long' }) })}
                    </p>
                    <p className="truncate text-[0.8125rem] text-ink-3">
                      {plural(t.finance.card.payments, group.lines.length)} · {names.join(', ')}
                      {more > 0 && ` +${more}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular">{money(group.amount)}</span>
                </li>
              )
            })}
          </Rows>
          {groups.length > FIRST + 1 && (
            <Button variant="ghost" size="sm" className="mt-1 -ml-3" onPress={() => setUnfolded((on) => !on)}>
              {unfolded ? t.common.showLess : t.common.showAll}
            </Button>
          )}
          {rate > 0 && (
            <p className="mt-2 text-[0.8125rem] text-ink-2">{fmt(t.finance.card.commission, { rate: ratePercent, amount: money(total * (1 - rate / 100)) })}</p>
          )}
        </>
      )}
    </Section>
  )
}
