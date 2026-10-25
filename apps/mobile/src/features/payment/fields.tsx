import { useMemo } from 'react'
import { View } from 'react-native'
import type { PaymentMethod } from '@hellokido/core/api'
import { PACKAGE_LESSON_TOTALS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount } from '@hellokido/core/rules/money.js'
import { FREE } from '@hellokido/core/view'
import { useCatalog, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { AmountField, Chip, DateField, Segmented, type Option } from '../../ui/Fields'

export type FormState = { dirty: boolean; busy: boolean }

export const METHODS: Exclude<PaymentMethod, 'belirlenmedi'>[] = ['banka', 'nakit', 'kart']

/** Amount text that is either empty or a positive amount; anything else gets a message. */
export function amountError(amount: string, message: string) {
  return amount.trim() && !isPositiveAmount(amount) ? message : undefined
}

type PaymentFieldsProps = {
  method: PaymentMethod | null
  onMethod: (method: PaymentMethod) => void
  amount: string
  onAmount: (amount: string) => void
  date: Date | null
  onDate: (date: Date | null) => void
  amountLabel?: string
  dateLabel?: string
  /** The package's usual price, offered while the amount is empty (never filled in silently). */
  suggestion?: number | null
}

/** How a received payment was made: method, amount and day. */
export function PaymentFields({ method, onMethod, amount, onAmount, date, onDate, amountLabel, dateLabel, suggestion }: PaymentFieldsProps) {
  const { t, fmt, money } = useI18n()
  const showSuggestion = suggestion != null && suggestion > 0 && !amount.trim()
  return (
    <>
      <Segmented<PaymentMethod>
        label={t.finance.entry.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method === 'belirlenmedi' ? null : method}
        onChange={onMethod}
      />
      <View style={{ gap: 10 }}>
        <AmountField label={amountLabel ?? t.finance.entry.amount} value={amount} onChange={onAmount} error={amountError(amount, t.common.amountInvalid)} />
        {showSuggestion && (
          <View style={{ flexDirection: 'row' }}>
            <Chip label={fmt(t.children.form.suggestedPrice, { amount: money(suggestion) })} onPress={() => onAmount(formatAmountForInput(suggestion))} />
          </View>
        )}
      </View>
      <DateField label={dateLabel ?? t.finance.entry.paymentDate} value={date} onChange={onDate} shortcuts />
    </>
  )
}

// Order of the packages while the catalog loads (the catalog's sort order wins once it is here)
const FALLBACK_CODES = ['tek-seferlik', 'hafta-1', 'hafta-2', 'hafta-3', 'hafta-4', '3ay-hafta-1', '3ay-hafta-2', '3ay-yarim-hafta-1', '3ay-yarim-hafta-2', FREE]

/** Package choices with their lesson count; hidden packages stay available for the row that uses one. */
export function usePackageOptions({ includeFree, current }: { includeFree: boolean; current?: string | null }) {
  const { t, plural } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  return useMemo(() => {
    const rows = catalog?.packages.length
      ? catalog.packages.filter((row) => row.is_active || row.code === current).map((row) => ({ code: row.code, lessons: row.lessons }))
      : FALLBACK_CODES.map((code) => ({ code, lessons: (PACKAGE_LESSON_TOTALS as Record<string, number>)[code] ?? null }))
    return rows
      .filter((row) => includeFree || row.code !== FREE)
      .map(
        (row): Option<string> => ({
          id: row.code,
          label: labels.packageName(row.code),
          description: row.code === FREE ? t.children.form.noQuota : row.lessons ? plural(t.children.form.lessons, row.lessons) : undefined
        })
      )
  }, [catalog, current, includeFree, labels, plural, t])
}

/** The package's usual price, if one is set in the catalog. */
export function usePackagePrice(code: string | null) {
  const catalog = useCatalog().data
  if (!code) return null
  const price = catalog?.packages.find((row) => row.code === code)?.default_price
  return price == null ? null : Number(price)
}
