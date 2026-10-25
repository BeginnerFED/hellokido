import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isSameMonth, startOfMonth } from 'date-fns'
import { CheckIcon, DotsThreeIcon, PencilSimpleIcon, PlusIcon, ReceiptIcon } from '@phosphor-icons/react'
import { addExpense, deleteExpense, listRecurring, type Expense, type RecurringExpense } from '@hellokido/core/api'
import { keys, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { LoadError, Mark } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Menu, MenuItem } from '../../ui/Menu'
import { Section } from '../../ui/Page'
import { useSheet } from '../../ui/useSheet'
import { cx } from '../../ui/cx'
import { ListSkeleton, Rows, methodName } from './bits'
import type { VisibleRange } from './Moves'
import { dueDayIn } from './period'
import { RecurringSheet } from './RecurringSheet'

/**
 * Rent, salaries and bills of the month on screen. A fixed amount is recorded with one tap (and can
 * be undone from the message); an amount that changes opens the expense form filled in.
 */
export function MonthlySection({
  month,
  expenses,
  waiting,
  today,
  visible,
  className
}: {
  /** Any day of the month on screen. */
  month: Date
  /** The month's expenses; undefined while they load. */
  expenses: Expense[] | undefined
  waiting: boolean
  today: Date
  visible: VisibleRange
  className?: string
}) {
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const { startTask } = useActions()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })
  const sheet = useSheet<RecurringExpense | null>()
  const [busy, setBusy] = useState<string | null>(null)

  const current = isSameMonth(month, today)
  const future = startOfMonth(month) > today
  const active = useMemo(() => (templates.data ?? []).filter((row) => row.is_active), [templates.data])

  // The latest expense each template produced in this month
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

  // This month: the day it is recorded is the day it was paid. Another month: its usual day there.
  const dayFor = (row: RecurringExpense) => {
    if (current) return new Date()
    const day = dueDayIn(month, row.day_of_month)
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
      startTask('expense', { template: row, day: when.toISOString(), visible })
      return
    }
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
      refresh.finance()
      toast({
        tone: 'success',
        title: fmt(t.finance.monthly.saved, { title: row.title }),
        body: fmt(t.finance.monthly.savedBody, { date: date(when, { day: 'numeric', month: 'long' }), amount: money(row.amount) }),
        action: { label: t.common.undo, onAction: () => void undo(id) }
      })
    } catch {
      toast({ tone: 'error', title: t.finance.expense.failed })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      boxed
      title={t.finance.monthly.title}
      aside={active.length > 0 && !waiting ? fmt(t.finance.monthly.progress, { done, total: active.length }) : undefined}
      className={className}
    >
      {templates.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
      ) : !templates.data ? (
        <ListSkeleton rows={2} />
      ) : active.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-[46ch] text-sm text-ink-2 text-pretty">{t.finance.monthly.empty}</p>
          <Button size="sm" variant="secondary" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => sheet.open(null)}>
            {t.finance.monthly.add}
          </Button>
        </div>
      ) : (
        <>
          <Rows className={cx('transition-opacity duration-200', waiting && 'opacity-60')}>
            {active.map((row) => {
              const expense = recorded.get(row.id)
              const due = dueDayIn(month, row.day_of_month)
              const late = !expense && !future && (!current || today.getDate() > due.getDate())
              const method = methodName(t, labels, row.payment_method)
              return (
                <li key={row.id} className="flex items-center gap-3 py-2.5">
                  <span
                    aria-hidden
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-tablet text-[0.8125rem] font-semibold tabular',
                      expense ? 'bg-positive-wash text-positive-ink' : late ? 'bg-action-wash text-action-ink' : 'bg-well text-ink-2'
                    )}
                  >
                    {expense ? <CheckIcon weight="bold" className="size-4" /> : due.getDate()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-[0.9375rem] font-medium text-ink">{row.title}</span>
                      {late && <Mark tone="action">{t.finance.monthly.late}</Mark>}
                    </p>
                    <p className="truncate text-[0.8125rem] text-ink-3">
                      {expense ? (
                        fmt(t.finance.monthly.recorded, { date: date(expense.expense_date ?? expense.created_at ?? '', { day: 'numeric', month: 'short' }) })
                      ) : (
                        <>
                          {/* The tablet shows the day; it is read out here */}
                          <span className="sr-only">{fmt(t.finance.monthly.day, { day: row.day_of_month })} · </span>
                          {[labels.expenseCategory(row.expense_type), method].filter(Boolean).join(' · ')}
                        </>
                      )}
                    </p>
                  </div>
                  <span className={cx('shrink-0 text-sm tabular', expense || row.amount != null ? 'font-semibold text-ink' : 'text-ink-3')}>
                    {expense ? money(expense.amount) : row.amount != null ? money(row.amount) : t.finance.monthly.varies}
                  </span>
                  {!expense && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 max-lg:h-10"
                      isPending={busy === row.id}
                      isDisabled={waiting || (busy !== null && busy !== row.id)}
                      aria-label={fmt(t.finance.monthly.recordLabel, { title: row.title })}
                      onPress={() => void record(row)}
                    >
                      {t.finance.monthly.record}
                    </Button>
                  )}
                  <Menu
                    label={fmt(t.finance.monthly.more, { title: row.title })}
                    trigger={
                      <IconButton label={fmt(t.finance.monthly.more, { title: row.title })} size="sm" className="-mr-2 shrink-0 max-lg:size-10">
                        <DotsThreeIcon aria-hidden weight="bold" className="size-[1.125rem]" />
                      </IconButton>
                    }
                  >
                    {expense && (
                      <MenuItem icon={<ReceiptIcon aria-hidden className="size-[1.125rem]" />} onAction={() => startTask('expense', { expense, visible })}>
                        {t.finance.expense.editTitle}
                      </MenuItem>
                    )}
                    <MenuItem icon={<PencilSimpleIcon aria-hidden className="size-[1.125rem]" />} onAction={() => sheet.open(row)}>
                      {t.finance.template.editTitle}
                    </MenuItem>
                  </Menu>
                </li>
              )
            })}
          </Rows>
          <Button variant="ghost" size="sm" className="mt-1 -ml-3" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => sheet.open(null)}>
            {t.finance.monthly.add}
          </Button>
        </>
      )}
      {sheet.isOpen || sheet.key > 0 ? <RecurringSheet key={sheet.key} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} template={sheet.payload} /> : null}
    </Section>
  )
}
