import { Fragment } from 'react'
import type { Expense, IncomeLine } from '@hellokido/core/api'
import type { Totals } from '@hellokido/core/view'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Figure, FigureGrid } from '../../ui/Figures'
import { Card } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { METHODS } from '../money/PaymentFields'
import { methodName, sumOf } from './bits'

type Props = {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  /** The previous period is still on screen while the new one loads. */
  waiting: boolean
  onRetry: () => void
  /** Card money the bank has not credited yet, whatever the period (the list of it is further down); null while it loads. */
  onTheWay: { amount: number; count: number } | null
  /** The period just before, of the same length; null when it is not known. */
  before: Totals | null
  /** A figure was pressed: the list behind it. */
  onShow: (what: 'in' | 'out' | 'bank') => void
  className?: string
}

/**
 * The period in four figures: money in, money out, what is left, and the card money that is not
 * in the bank yet, each against the period before. The footer says how the money came in, so the
 * figures can be matched against the till and the bank account.
 */
export function Overview({ income, expenses, isError, waiting, onRetry, onTheWay, before, onShow, className }: Props) {
  const { t, fmt, plural, money } = useI18n()
  const labels = useLabels()

  if (isError) {
    return (
      <Card className={className}>
        <div className="p-5">
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
        </div>
      </Card>
    )
  }
  if (!income || !expenses) {
    return (
      <Card className={className}>
        <FigureGrid>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} aria-hidden className="flex flex-col gap-2.5 bg-surface px-4 py-4 sm:px-5 sm:py-[1.125rem]">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </FigureGrid>
      </Card>
    )
  }

  const totalIn = sumOf(income)
  const totalOut = sumOf(expenses)
  const net = totalIn - totalOut
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)
  const beforeNet = before ? before.in - before.out : 0
  const hint = (...parts: (string | false | null)[]) => parts.filter(Boolean).join(' · ')
  // An amount in a hint never breaks between the number and the lira sign
  const whole = (value: number) => money(value).replace(/ /g, ' ')

  return (
    <Card
      className={cx('transition-opacity duration-200', waiting && 'opacity-60', className)}
      footer={
        totalIn === 0 && totalOut === 0 ? (
          <span>{t.finance.balance.empty}</span>
        ) : byMethod.length > 0 ? (
          <span className="text-pretty">
            {t.finance.balance.byMethod}:{' '}
            {/* A line may break after a dot, never inside a method and its amount */}
            {byMethod.map((row, index) => (
              <Fragment key={row.method}>
                {index > 0 && ' · '}
                <span className="whitespace-nowrap text-ink-2">
                  {methodName(t, labels, row.method)} <span className="tabular">{money(row.amount)}</span>
                </span>
              </Fragment>
            ))}
          </span>
        ) : undefined
      }
    >
      <section aria-label={t.finance.balance.label} aria-busy={waiting}>
        <FigureGrid>
          <Figure
            label={t.finance.balance.in}
            value={money(totalIn)}
            hint={hint(plural(t.finance.balance.payments, income.length), before && fmt(t.finance.balance.before, { amount: whole(before.in) }))}
            onPress={() => onShow('in')}
          />
          <Figure
            label={t.finance.balance.out}
            value={money(totalOut)}
            hint={hint(plural(t.finance.balance.expenses, expenses.length), before && fmt(t.finance.balance.before, { amount: whole(before.out) }))}
            onPress={() => onShow('out')}
          />
          <Figure
            label={net < 0 ? t.finance.balance.short : t.finance.balance.left}
            value={<span className={cx(net < 0 && 'text-negative-ink')}>{money(Math.abs(net))}</span>}
            hint={
              before
                ? fmt(beforeNet < 0 ? t.finance.balance.beforeShort : t.finance.balance.before, { amount: whole(Math.abs(beforeNet)) })
                : t.finance.balance.leftHint
            }
          />
          <Figure
            label={t.finance.balance.bank}
            value={onTheWay ? money(onTheWay.amount) : <Skeleton className="my-0.5 h-7 w-24" />}
            hint={
              onTheWay && onTheWay.amount > 0
                ? hint(plural(t.finance.card.payments, onTheWay.count), t.finance.balance.bankHint)
                : onTheWay && t.finance.balance.bankNone
            }
            onPress={onTheWay && onTheWay.amount > 0 ? () => onShow('bank') : undefined}
          />
        </FigureGrid>
      </section>
    </Card>
  )
}
