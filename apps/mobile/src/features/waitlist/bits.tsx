import { StyleSheet, View } from 'react-native'
import { differenceInCalendarDays } from 'date-fns'
import type { I18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { initialsOf } from '../../ui/Bits'
import { Text } from '../../ui/Text'

/**
 * "3 weeks ago", "yesterday", "today" in the screen's language, in the same steps as the web panel.
 * A day typed in the future reads as today, never as "asked in 3 days".
 */
export function askedAgo({ t, plural }: Pick<I18n, 't' | 'plural'>, day: Date, today = new Date()) {
  const past = Math.max(0, differenceInCalendarDays(today, day))
  const ago = t.mobile.ago
  if (past === 0) return ago.today
  if (past === 1) return ago.yesterday
  if (past < 7) return plural(ago.days, past)
  if (past < 14) return ago.lastWeek
  if (past < 30) return plural(ago.weeks, Math.floor(past / 7))
  if (past < 60) return ago.lastMonth
  if (past < 365) return plural(ago.months, Math.floor(past / 30))
  if (past < 730) return ago.lastYear
  return plural(ago.years, Math.floor(past / 365))
}

/**
 * A seat not taken yet: the peg of a child who has no place, an empty socket with initials. Square
 * like every other child's tile; the dashed edge is what says "no seat yet".
 */
export function WaitPeg({ name }: { name: string }) {
  const c = useColors()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.peg, { borderColor: c.lineStrong }]}>
      <Text weight="600" tabular style={[styles.initials, { color: c.ink2 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  peg: { width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2 }
})
