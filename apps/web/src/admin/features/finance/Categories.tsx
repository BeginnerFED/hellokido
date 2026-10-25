import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import type { Expense } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Skeleton } from '../../ui/Bits'
import { Section } from '../../ui/Page'
import { cx } from '../../ui/cx'
import { CategoryTablet } from './bits'

const percentFormats = new Map<string, Intl.NumberFormat>()

function percent(tag: string, share: number) {
  let format = percentFormats.get(tag)
  if (!format) {
    format = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 })
    percentFormats.set(tag, format)
  }
  // A small share never rounds down to nothing
  return share > 0 && share < 0.01 ? `<${format.format(0.01)}` : format.format(share)
}

/**
 * The period's expenses by type, largest first, as bars on one scale. Every bar is the same colour:
 * the types are names, not an order. Pressing a type shows its expenses in the list.
 */
export function CategoriesSection({
  expenses,
  waiting,
  onPick,
  className
}: {
  expenses: Expense[] | undefined
  waiting: boolean
  onPick: (code: string) => void
  className?: string
}) {
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
    <Section boxed title={t.finance.categories.title} className={className}>
      {!expenses ? (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink-2">{t.finance.categories.empty}</p>
      ) : (
        <ul aria-busy={waiting} className={cx('-mx-3 flex flex-col transition-opacity duration-200', waiting && 'opacity-60')}>
          {groups.map((group) => {
            const name = labels.expenseCategory(group.code)
            return (
              <li key={group.code}>
                <AriaButton
                  onPress={() => onPick(group.code)}
                  aria-label={`${fmt(t.finance.categories.show, { category: name })}: ${money(group.amount)}`}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-control px-3 py-2 text-left outline-none transition-colors duration-150',
                    'data-hovered:bg-[color-mix(in_oklab,var(--well)_70%,transparent)] data-pressed:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset'
                  )}
                >
                  <CategoryTablet code={group.code} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name}</span>
                      <span className="shrink-0 text-sm font-semibold tabular">{money(group.amount)}</span>
                    </span>
                    <span aria-hidden className="mt-1.5 flex items-center gap-2.5">
                      <span className="h-1.5 min-w-0 flex-1">
                        <span
                          className="block h-full rounded-r-[3px] bg-series-out"
                          style={{ width: `${largest > 0 ? Math.max((group.amount / largest) * 100, 1.5) : 0}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-[0.75rem] text-ink-3 tabular">{percent(tag, total > 0 ? group.amount / total : 0)}</span>
                    </span>
                  </span>
                </AriaButton>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
