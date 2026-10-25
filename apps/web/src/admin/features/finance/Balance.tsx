import { Fragment } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import type { Expense, IncomeLine } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
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
  /** Card money of this period that the bank has not credited yet. */
  onTheWay: number
  onShowOnTheWay: () => void
  className?: string
}

/**
 * The period in two rods on one scale, money in and money out, and what is left. Below: how the
 * money came in, and the card money that is not in the bank yet, so the numbers can be matched
 * against the bank account.
 */
export function Balance({ income, expenses, isError, waiting, onRetry, onTheWay, onShowOnTheWay, className }: Props) {
  const { t, fmt, money } = useI18n()
  const labels = useLabels()

  if (isError) {
    return (
      <div className={className}>
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      </div>
    )
  }
  if (!income || !expenses) {
    return (
      <div aria-hidden className={cx('flex flex-col gap-4', className)}>
        <Skeleton className="h-6" />
        <Skeleton className="h-6" />
        <Skeleton className="mt-3 h-9 w-2/3" />
      </div>
    )
  }

  const totalIn = sumOf(income)
  const totalOut = sumOf(expenses)
  const net = totalIn - totalOut
  const scale = Math.max(totalIn, totalOut)
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)

  return (
    <section aria-label={t.finance.balance.label} aria-busy={waiting} className={cx('flex flex-col transition-opacity duration-200', waiting && 'opacity-60', className)}>
      <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
        <Rod label={t.finance.balance.in} amount={totalIn} scale={scale} tone="in" />
        <Rod label={t.finance.balance.out} amount={totalOut} scale={scale} tone="out" />
        <div className="col-span-3 mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="text-[0.9375rem] font-medium text-ink-2">{net < 0 ? t.finance.balance.short : t.finance.balance.left}</dt>
          {/* A standalone figure keeps proportional digits */}
          <dd className={cx('text-[1.75rem] leading-none font-semibold tracking-[-0.015em]', net < 0 && 'text-negative-ink')}>{money(Math.abs(net))}</dd>
        </div>
      </dl>

      {/* The notes stay with the figures they explain; any height left beside the chart stays below */}
      <div className="mt-4 flex flex-col gap-1.5">
        {totalIn === 0 && totalOut === 0 ? (
          <p className="text-sm text-ink-2">{t.finance.balance.empty}</p>
        ) : (
          byMethod.length > 0 && (
            <p className="text-sm text-ink-2 text-pretty">
              <span className="text-ink-3">{t.finance.balance.byMethod}: </span>
              {/* A line may break after a dot, never inside a method and its amount */}
              {byMethod.map((row, index) => (
                <Fragment key={row.method}>
                  {index > 0 && ' · '}
                  <span className="whitespace-nowrap">
                    {methodName(t, labels, row.method)} <span className="tabular">{money(row.amount)}</span>
                  </span>
                </Fragment>
              ))}
            </p>
          )
        )}
        {onTheWay > 0 && (
          <p className="text-sm text-ink-2 text-pretty">
            {fmt(t.finance.balance.onTheWay, { amount: money(onTheWay) })}{' '}
            <AriaButton
              onPress={onShowOnTheWay}
              className="relative rounded-[0.25rem] font-medium text-accent-ink underline-offset-2 outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-focus pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-2.5"
            >
              {t.finance.balance.onTheWayLink}
            </AriaButton>
          </p>
        )}
      </div>
    </section>
  )
}

function Rod({ label, amount, scale, tone }: { label: string; amount: number; scale: number; tone: 'in' | 'out' }) {
  const { money } = useI18n()
  // A tiny amount still shows as a sliver, so "some" never reads as "none"
  const width = scale > 0 && amount > 0 ? Math.max((amount / scale) * 100, 1.5) : 0
  // Each name-value group is its own div (valid in a list of terms); "contents" keeps it in the grid
  return (
    <div className="contents">
      <dt className="text-[0.9375rem] text-ink-2">{label}</dt>
      <dd className="text-right text-[1.0625rem] font-semibold tabular">{money(amount)}</dd>
      <dd aria-hidden className="h-2.5">
        <span className={cx('block h-full rounded-r-[4px]', tone === 'in' ? 'bg-series-in' : 'bg-series-out')} style={{ width: `${width}%` }} />
      </dd>
    </div>
  )
}
