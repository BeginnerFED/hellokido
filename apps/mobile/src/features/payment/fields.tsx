import { useMemo, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { PaymentMethod } from '@hellokido/core/api'
import { PACKAGE_LESSON_TOTALS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount } from '@hellokido/core/rules/money.js'
import { FREE } from '@hellokido/core/view'
import { useCatalog, useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import type { NoticeTone } from '../../ui/Bits'
import { AmountField, DateField, Segmented, type Option } from '../../ui/Fields'
import { Row } from '../../ui/Screen'
import { Text } from '../../ui/Text'

export type Note = { tone: NoticeTone; text: string }

const NOTE_TONES = { info: 'ink2', action: 'actionInk', positive: 'positiveInk', negative: 'negativeInk' } as const

/**
 * What a group's choices mean or warn about, as tinted lines under its card: the phone's forms say
 * it in a footnote, not in a box. Nothing when there is nothing to say.
 */
export function groupNotes(notes: (Note | null | false | undefined)[]): ReactNode | undefined {
  const shown = notes.filter((note): note is Note => Boolean(note))
  if (shown.length === 0) return undefined
  return (
    <View style={styles.notes}>
      {shown.map((note) => (
        <Text key={note.text} variant="foot" tone={NOTE_TONES[note.tone]} accessibilityRole={note.tone === 'negative' ? 'alert' : undefined}>
          {note.text}
        </Text>
      ))}
    </View>
  )
}

export const METHODS: Exclude<PaymentMethod, 'belirlenmedi'>[] = ['banka', 'nakit', 'kart']

/** Amount text that is either empty or a positive amount; anything else gets a message. */
export function amountError(amount: string, message: string) {
  return amount.trim() && !isPositiveAmount(amount) ? message : undefined
}

type PaymentRowsProps = {
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

/**
 * How a received payment was made: method, amount and day, as rows for the card they go in. Rows,
 * not one component, so the card draws its hairlines between them.
 */
export function usePaymentRows({ method, onMethod, amount, onAmount, date, onDate, amountLabel, dateLabel, suggestion }: PaymentRowsProps): ReactNode[] {
  const { t, fmt, money } = useI18n()
  const showSuggestion = suggestion != null && suggestion > 0 && !amount.trim()
  // In the order of the expense sheet: amount, method, day
  return [
    <AmountField key="amount" label={amountLabel ?? t.finance.entry.amount} value={amount} onChange={onAmount} error={amountError(amount, t.common.amountInvalid)} />,
    // The usual price in the tint, as a line that fills the amount when tapped
    showSuggestion && (
      <Row
        key="suggestion"
        title={
          <Text variant="body" tone="accentInk" tabular numberOfLines={1}>
            {fmt(t.children.form.suggestedPrice, { amount: money(suggestion) })}
          </Text>
        }
        onPress={() => onAmount(formatAmountForInput(suggestion))}
      />
    ),
    <Segmented<PaymentMethod>
      key="method"
      label={t.finance.entry.method}
      options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
      value={method === 'belirlenmedi' ? null : method}
      onChange={onMethod}
    />,
    <DateField key="date" label={dateLabel ?? t.finance.entry.paymentDate} value={date} onChange={onDate} shortcuts />
  ].filter(Boolean)
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

const styles = StyleSheet.create({
  // Also used as a group's footnote: the lines take its width and wrap
  notes: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 }
})
