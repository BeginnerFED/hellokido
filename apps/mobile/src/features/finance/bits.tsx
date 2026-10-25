import { StyleSheet, View } from 'react-native'
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

/** The tile of a finance row: as large as a child's peg, so names line up whatever leads the row. */
export const TILE = 38
/** Where the rule between finance rows starts: the row's 16px edge, the tile and the 12px gap. */
export const ROW_INSET = 16 + TILE + 12

// Settings lists the types in smaller rows; the finance lists mix them with children's pegs
const tabletLook = (size: number) => ({ width: size, height: size, borderRadius: size >= TILE ? 11 : 9 })

/** An expense type as a small tablet with its picture. Own types get a receipt. */
export function CategoryTablet({ code, size = 32 }: { code: string | null | undefined; size?: number }) {
  const c = useColors()
  return (
    <View style={[styles.tablet, tabletLook(size), { backgroundColor: c.well }]}>
      <Icon name={CATEGORY_ICONS[code ?? ''] ?? 'receipt'} size={Math.round(size * 0.52)} color={c.ink2} />
    </View>
  )
}

const INCOME_ICONS: Record<string, IconName> = { etkinlik: 'party', 'dogum-gunu': 'cake', satis: 'bag' }

/** Income that belongs to no child (a party, a sale), with the picture of its category. */
export function IncomeTablet({ code, size = 32 }: { code?: string | null; size?: number }) {
  const c = useColors()
  return (
    <View style={[styles.tablet, tabletLook(size), { backgroundColor: c.accentWash2 }]}>
      <Icon name={INCOME_ICONS[code ?? ''] ?? 'money'} size={Math.round(size * 0.52)} color={c.accentInk} />
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

export { together } from '../../ui/Text'

const styles = StyleSheet.create({
  tablet: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
})
