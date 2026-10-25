import { useQuery } from '@tanstack/react-query'
import { listRecurring, type RecurringExpense } from '@hellokido/core/api'
import { keys, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Mark } from '../../ui/Bits'
import { useSheet } from '../../ui/useSheet'
import { cx } from '../../ui/cx'
import { methodName } from '../finance/bits'
import { RecurringSheet } from '../finance/RecurringSheet'
import { RowPiece, SettingAddRow, SettingBody, SettingList, SettingRow, SettingSkeleton } from './bits'

/** Every monthly expense, paused ones too: Finance only lists the running ones. */
export function MonthlyList() {
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })
  const sheet = useSheet<RecurringExpense | null>()

  return (
    <>
      {templates.isError ? (
        <SettingBody>
          <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
        </SettingBody>
      ) : !templates.data ? (
        <SettingSkeleton rows={2} />
      ) : (
        <SettingList>
          {templates.data.map((row) => (
            <SettingRow
              key={row.id}
              lead={<RowPiece muted={!row.is_active}>{row.day_of_month}</RowPiece>}
              title={row.title}
              muted={!row.is_active}
              mark={!row.is_active && <Mark tone="neutral">{t.finance.monthly.paused}</Mark>}
              meta={
                <>
                  {/* The piece shows the day; it is read out here */}
                  <span className="sr-only">{fmt(t.finance.monthly.day, { day: row.day_of_month })} · </span>
                  {[labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method)].filter(Boolean).join(' · ')}
                </>
              }
              trail={
                row.amount != null ? (
                  <span className={cx('font-semibold', row.is_active ? 'text-ink' : 'text-ink-3')}>{money(row.amount)}</span>
                ) : (
                  <span className="text-ink-3">{t.finance.monthly.varies}</span>
                )
              }
              onPress={() => sheet.open(row)}
            />
          ))}
          <SettingAddRow onPress={() => sheet.open(null)}>{t.finance.monthly.add}</SettingAddRow>
        </SettingList>
      )}
      {sheet.isOpen || sheet.key > 0 ? <RecurringSheet key={sheet.key} isOpen={sheet.isOpen} onOpenChange={sheet.setOpen} template={sheet.payload} /> : null}
    </>
  )
}
