import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from '@phosphor-icons/react'
import { listRecurring, type RecurringExpense } from '@hellokido/core/api'
import { keys, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { useSheet } from '../../ui/useSheet'
import { cx } from '../../ui/cx'
import { ListSkeleton, methodName } from '../finance/bits'
import { RecurringSheet } from '../finance/RecurringSheet'
import { SettingList, SettingRow } from './bits'

/** Every monthly expense, paused ones too: Finance only lists the running ones. */
export function MonthlyList() {
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })
  const sheet = useSheet<RecurringExpense | null>()

  const add = (
    <Button
      variant={templates.data?.length ? 'ghost' : 'secondary'}
      size="sm"
      className={templates.data?.length ? 'mt-2 -ml-3' : undefined}
      icon={<PlusIcon aria-hidden weight="bold" className="size-4" />}
      onPress={() => sheet.open(null)}
    >
      {t.finance.monthly.add}
    </Button>
  )

  return (
    <>
      {templates.isError ? (
        <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
      ) : !templates.data ? (
        <ListSkeleton rows={2} />
      ) : (
        <>
          {templates.data.length > 0 && (
            <SettingList>
              {templates.data.map((row) => (
                <SettingRow
                  key={row.id}
                  lead={
                    <span
                      aria-hidden
                      className={cx(
                        'grid size-8 shrink-0 place-items-center rounded-tablet bg-well text-[0.8125rem] font-semibold tabular',
                        row.is_active ? 'text-ink-2' : 'text-ink-3'
                      )}
                    >
                      {row.day_of_month}
                    </span>
                  }
                  title={row.title}
                  muted={!row.is_active}
                  mark={!row.is_active && <Mark tone="neutral">{t.finance.monthly.paused}</Mark>}
                  meta={
                    <>
                      {/* The tablet shows the day; it is read out here */}
                      <span className="sr-only">{fmt(t.finance.monthly.day, { day: row.day_of_month })} · </span>
                      {[labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method)].filter(Boolean).join(' · ')}
                    </>
                  }
                  trail={
                    row.amount != null ? (
                      <span className={cx('font-semibold', row.is_active ? 'text-ink' : 'text-ink-2')}>{money(row.amount)}</span>
                    ) : (
                      <span className="text-ink-3">{t.finance.monthly.varies}</span>
                    )
                  }
                  onPress={() => sheet.open(row)}
                />
              ))}
            </SettingList>
          )}
          {add}
        </>
      )}
      {sheet.isOpen || sheet.key > 0 ? <RecurringSheet key={sheet.key} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} template={sheet.payload} /> : null}
    </>
  )
}
