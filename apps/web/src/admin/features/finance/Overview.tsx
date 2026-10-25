import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import type { Expense, IncomeLine } from '@hellokido/core/api'
import { formatMoney } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { arrivalOf, leftByPlace, PARTNERS, type Totals } from '@hellokido/core/view'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Figure } from '../../ui/Figures'
import { cx } from '../../ui/cx'
import { METHODS } from '../money/PaymentFields'
import { MINUS, methodName, sumOf } from './bits'

export type ShowWhat = 'in' | 'out' | 'bank' | 'expected'

type Props = {
  income: IncomeLine[] | undefined
  expenses: Expense[] | undefined
  isError: boolean
  /** The previous period is still on screen while the new one loads. */
  waiting: boolean
  onRetry: () => void
  today: Date
  /** Card money the bank has not credited yet, whatever the period (the list of it is further down); null while it loads. */
  onTheWay: { amount: number; count: number } | null
  /** Days until card money reaches the bank (Settings › Card payments); null while it loads. */
  settle: number | null
  /** Money still to come, whatever the period (the list of it is further down); null while it loads. */
  expected: { total: number; count: number; overdue: number; next: string | null; unpriced: number } | null
  /** The period just before, of the same length; null when it is not known. */
  before: Totals | null
  /**
   * A whole money period: whether its money is still to be shared (open) and the salary rows of the
   * pay-outs, kept apart from the other expenses. Null for any other range.
   */
  share: { open: boolean; payouts: Set<string> | undefined } | null
  /** A figure was pressed: the list behind it. */
  onShow: (what: ShowWhat) => void
  className?: string
}

const gridClass = 'grid grid-cols-2 gap-3 sm:gap-3.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]'
const heroClass = 'on-felt col-span-2 flex min-w-0 flex-col rounded-panel bg-felt px-5 py-5 xl:col-span-1 xl:row-span-2 sm:px-6 sm:py-[1.375rem]'
// An amount in a line of text never breaks between the number and the lira sign
const together = (text: string) => text.replace(/ /g, '\u00a0') // an escape, so no editor can flatten it to a plain space

/**
 * The period on a felt board. The large card is what the period comes to: in the period still
 * running, what the partners will share and where that money is now (in the bank, on its way to
 * the bank, in the till), with each partner's part; in a closed period the salaries paid out, with
 * how the money came in; otherwise what is left. Beside it four tiles: money in, money out (without
 * the salaries of a pay-out), card money on its way to the bank and the payments still to come.
 * Each tile opens the list behind it.
 */
export function Overview({ income, expenses, isError, waiting, onRetry, today, onTheWay, settle, expected, before, share, onShow, className }: Props) {
  const { t, fmt, plural, money, date } = useI18n()
  const labels = useLabels()

  if (isError) {
    return (
      <div className={cx('rounded-panel bg-felt p-5', className)}>
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      </div>
    )
  }
  if (!income || !expenses) {
    return (
      <div aria-hidden className={cx(gridClass, className)}>
        <div className={heroClass}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-12 w-56" />
          <Skeleton className="mt-6 h-3.5 w-full" />
          <Skeleton className="mt-4 h-9 w-full" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2.5 rounded-tile bg-felt px-[1.125rem] py-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
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
  const sharing = open && net > 0
  const beforeNet = before ? before.in - before.out : 0
  const byMethod = METHODS.map((method) => ({ method, amount: sumOf(income.filter((line) => line.method === method)) })).filter((row) => row.amount > 0)
  const signed = (value: number) => `${value < 0 ? MINUS : ''}${money(Math.abs(value))}`
  // What each partner gets from the bank and from the till, as they pay it out
  const place = leftByPlace(income, expenses, payouts)
  const each = [`${t.finance.methodShort.banka} ${signed(place.bank / PARTNERS)}`, `${t.finance.methodShort.nakit} ${signed(place.cash / PARTNERS)}`]

  const headAmount = paid > 0 ? paid : Math.abs(net)
  const headLabel = paid > 0 ? t.finance.balance.paid : net < 0 ? t.finance.balance.short : open ? t.finance.balance.toShare : t.finance.balance.left
  const negative = paid === 0 && net < 0
  // Under the figure, unless the per-partner row at the foot of the card says it already
  const headHint =
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

  // Where the money to share is now: card money of this period the bank has not credited yet is on
  // its way; the rest of the bank part is in the bank. The three parts add up to the figure above.
  const way = settle === null ? null : sumOf(income.filter((line) => line.method === 'kart' && line.paymentDate && arrivalOf(line.paymentDate, settle) >= today))
  const parts =
    way === null
      ? null
      : [
          { id: 'bank', label: t.finance.balance.inBank, amount: place.bank - way, color: 'bg-sky' },
          { id: 'way', label: t.finance.balance.bank, amount: way, color: 'on-the-way' },
          { id: 'cash', label: t.finance.methodShort.nakit, amount: place.cash, color: 'bg-cash' }
        ]
  // A part below zero cannot be drawn as a length; the words below still say it
  const drawn = parts !== null && parts.every((part) => part.amount >= 0)

  const outNote = [paid > 0 ? upperFirst(t.finance.balance.noSalaries) : '', before ? fmt(t.finance.balance.before, { amount: together(money(before.out)) }) : '']
    .filter(Boolean)
    .join(', ')

  return (
    <section aria-label={t.finance.balance.label} aria-busy={waiting} className={cx(gridClass, 'transition-opacity duration-200', waiting && 'opacity-60', className)}>
      <div className={heroClass}>
        <p className="text-[0.9375rem] leading-5 font-medium text-ink-2">{headLabel}</p>
        {/* The figure as large as the card allows; ₺ steps down beside it. A shortfall says so in its label and its red */}
        <p
          className={cx(
            'mt-1.5 text-[2.75rem] leading-[3.25rem] font-semibold tracking-[-0.035em] whitespace-nowrap sm:text-[3.5rem] sm:leading-[3.75rem]',
            negative && 'text-negative-ink'
          )}
        >
          {formatMoney(headAmount)}
          <span className="ml-1.5 text-[1.75rem] font-medium tracking-normal sm:text-[2.125rem]">₺</span>
        </p>
        {headHint && <p className="mt-1 text-[0.84375rem] leading-[1.125rem] text-ink-3">{headHint}</p>}

        {sharing ? (
          <>
            {parts === null ? (
              <div aria-hidden>
                <Skeleton className="mt-5 h-3.5 rounded-[4px]" />
                <Skeleton className="mt-3.5 h-10" />
              </div>
            ) : (
              <>
                {drawn && (
                  <div aria-hidden className="mt-5 flex h-3.5 gap-[3px]">
                    {parts
                      .filter((part) => part.amount > 0)
                      .map((part) => (
                        <span key={part.id} className={cx('min-w-1 rounded-[4px]', part.color)} style={{ flexGrow: part.amount }} />
                      ))}
                  </div>
                )}
                <div className={cx('grid grid-cols-3 gap-2.5', drawn ? 'mt-3.5' : 'mt-5')}>
                  {parts.map((part) => {
                    const body = (
                      <>
                        <span className="flex items-start gap-1.5 text-[0.8125rem] leading-[1.0625rem] text-ink-3">
                          <span aria-hidden className={cx('mt-1 size-[9px] shrink-0 rounded-[3px]', part.color)} />
                          {part.label}
                        </span>
                        {/* Amounts stay on one line even when a label takes two */}
                        <span className="mt-auto block pt-[3px] text-[1.0625rem] leading-[1.375rem] font-semibold text-ink">{together(signed(part.amount))}</span>
                      </>
                    )
                    // The money on its way is listed further down, by the day it should arrive
                    return part.id === 'way' && part.amount > 0 ? (
                      <AriaButton
                        key={part.id}
                        onPress={() => onShow('bank')}
                        aria-label={`${part.label} ${signed(part.amount)}. ${t.finance.balance.showBank}`}
                        className="-m-1.5 flex min-w-0 flex-col rounded-control p-1.5 text-left outline-none transition-colors duration-150 data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus"
                      >
                        {body}
                      </AriaButton>
                    ) : (
                      <div key={part.id} className="flex min-w-0 flex-col">
                        {body}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            <Foot>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] leading-5 font-medium text-ink-2">{t.finance.balance.each}</p>
                <p className="mt-0.5 text-[0.84375rem] leading-[1.125rem] text-ink-3 text-pretty">{each.map(together).join(' · ')}</p>
              </div>
              <span className="shrink-0 text-[1.375rem] leading-7 font-semibold tracking-[-0.015em] whitespace-nowrap">{money(net / PARTNERS)}</span>
            </Foot>
          </>
        ) : empty ? (
          <Foot>
            <p className="text-[0.9375rem] text-ink-2">{t.finance.balance.empty}</p>
          </Foot>
        ) : byMethod.length > 0 ? (
          <Foot column>
            <p className="text-[0.9375rem] leading-5 font-medium text-ink-2">{t.finance.balance.byMethod}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2.5">
              {byMethod.map((row) => (
                <div key={row.method} className="min-w-0">
                  <span className="block text-[0.8125rem] leading-[1.0625rem] text-ink-3">{methodName(t, labels, row.method)}</span>
                  <span className="mt-[3px] block text-[1.0625rem] leading-[1.375rem] font-semibold">{together(money(row.amount))}</span>
                </div>
              ))}
            </div>
          </Foot>
        ) : null}
      </div>

      <Figure
        label={t.finance.balance.in}
        dot="bg-sky"
        value={money(totalIn)}
        hint={plural(t.finance.balance.payments, income.length)}
        hint2={before ? upperFirst(fmt(t.finance.balance.before, { amount: together(money(before.in)) })) : undefined}
        onPress={() => onShow('in')}
      />
      <Figure
        label={t.finance.balance.out}
        dot="bg-out"
        value={money(totalOut)}
        hint={plural(t.finance.balance.expenses, expenses.length - salaries.length)}
        hint2={outNote ? upperFirst(outNote) : undefined}
        onPress={() => onShow('out')}
      />
      <Figure
        label={t.finance.balance.bank}
        dot="on-the-way"
        value={onTheWay ? money(onTheWay.amount) : <Skeleton className="my-0.5 h-7 w-24" />}
        hint={onTheWay && (onTheWay.amount > 0 ? plural(t.finance.card.payments, onTheWay.count) : t.finance.balance.bankNone)}
        hint2={
          onTheWay && onTheWay.amount > 0
            ? // When part of it belongs to earlier periods, say how much the split above counts, so the two figures agree
              upperFirst(way !== null && way !== onTheWay.amount ? fmt(t.finance.balance.bankOfPeriod, { amount: together(money(way)) }) : t.finance.balance.bankHint)
            : undefined
        }
        onPress={onTheWay && onTheWay.amount > 0 ? () => onShow('bank') : undefined}
      />
      <Figure
        label={t.finance.expected.title}
        dot="bg-amber"
        value={expected ? money(expected.total) : <Skeleton className="my-0.5 h-7 w-24" />}
        hint={expected && (expected.count > 0 ? plural(t.finance.balance.payments, expected.count) : t.finance.expected.empty)}
        hint2={
          expected && expected.overdue > 0 ? (
            <span className="text-amber-ink">{plural(t.finance.web.overdue, expected.overdue)}</span>
          ) : expected?.next ? (
            fmt(t.finance.web.nextDue, { date: date(`${expected.next}T00:00:00`, { day: 'numeric', month: 'long' }) })
          ) : expected && expected.unpriced > 0 ? (
            // A payment saved before its price was agreed is not "0 ₺"
            t.finance.expected.noAmount
          ) : undefined
        }
        onPress={expected && expected.count > 0 ? () => onShow('expected') : undefined}
      />
    </section>
  )
}

/** The foot of the large card: a line above it, pushed to the bottom when the card is taller than its content. */
function Foot({ children, column }: { children: ReactNode; column?: boolean }) {
  return (
    <>
      <div aria-hidden className="min-h-4 flex-1" />
      <div className={cx('border-t border-line pt-4', column ? 'block' : 'flex items-center gap-4')}>{children}</div>
    </>
  )
}
