import { StyleSheet, View } from 'react-native'
import { endOfMonth } from 'date-fns'
import type { Messages } from '@hellokido/core/i18n'
import type { Labels } from '../../data/queries'
import { useColors } from '../../theme/colors'
import { Icon, type IconName } from '../../ui/Icon'

const CATEGORY_ICONS: Record<string, IconName> = {
  kira: 'house',
  elektrik: 'bolt',
  su: 'drop',
  dogalgaz: 'flame',
  internet: 'wifi',
  maas: 'group',
  malzeme: 'brush',
  mutfak: 'kitchen',
  reklam: 'megaphone',
  filament: 'cube'
}

/** An expense type as a small tablet with its picture, the size of a child's peg. Own types get a receipt. */
export function CategoryTablet({ code }: { code: string | null | undefined }) {
  const c = useColors()
  return (
    <View style={[styles.tablet, { backgroundColor: c.well }]}>
      <Icon name={CATEGORY_ICONS[code ?? ''] ?? 'receipt'} size={17} color={c.ink2} />
    </View>
  )
}

const INCOME_ICONS: Record<string, IconName> = { etkinlik: 'party', 'dogum-gunu': 'cake', satis: 'bag' }

/** Income that belongs to no child (a party, a sale), with the picture of its category. */
export function IncomeTablet({ code }: { code?: string | null }) {
  const c = useColors()
  return (
    <View style={[styles.tablet, { backgroundColor: c.accentWash2 }]}>
      <Icon name={INCOME_ICONS[code ?? ''] ?? 'money'} size={17} color={c.accentInk} />
    </View>
  )
}

export const MINUS = '−'

export const sumOf = (rows: { amount: number | string | null }[]) => rows.reduce((total, row) => total + (Number(row.amount) || 0), 0)

/** "Card", "Bank", "Cash"; nothing for a payment whose method was never set. */
export function methodName(t: Messages, labels: Labels, method: string | null | undefined) {
  if (!method || method === 'belirlenmedi') return ''
  return t.finance.methodShort[method] ?? labels.method(method)
}

/** The day a monthly expense falls on in a given month; the 31st becomes the last day of a short month. */
export function dueDayIn(month: Date, dayOfMonth: number) {
  const last = endOfMonth(month).getDate()
  return new Date(month.getFullYear(), month.getMonth(), Math.min(Math.max(dayOfMonth, 1), last))
}

/** Words that stay on one line ("Card 5.850 ₺"): a sentence may break between them, never inside. */
export const together = (text: string) => text.replace(/ /g, ' ')

const styles = StyleSheet.create({
  tablet: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
})
