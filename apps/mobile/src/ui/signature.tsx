import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { remainingTone, type Usage } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { useColors, type Colors } from '../theme/colors'
import { initialsOf } from './Bits'
import { Text, type TextVariant } from './Text'

/*
 * The app's small pieces, the same as on the web panel:
 * - a lesson type is a coloured dot before its name;
 * - a package is a thin share bar of the lessons left, amber when it runs low;
 * - a child is a rounded square initials tile, tinted by the attendance it holds;
 * - a lesson's seats are a row of tiles with the count beside them.
 */

/** An age group as plain text; kept as a component so every place words it the same. */
export function AgeTablet({ label, variant = 'foot' }: { group?: string; label?: string; variant?: TextVariant }) {
  if (label === undefined) return null
  return (
    <Text variant={variant} tone="ink3" numberOfLines={1} style={styles.shrink}>
      {label}
    </Text>
  )
}

/** The lesson type's dot. */
export function LessonShape({ type, size = 8 }: { type: string; size?: number }) {
  const c = useColors()
  const color = type === 'duyusal' ? c.typeDuyusal : type === 'ingilizce' ? c.typeIngilizce : c.typeOzel
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
}

const BAR_WIDTHS = { sm: 64, md: 84, lg: '100%' } as const

/**
 * The lessons left as a share bar: full when the package is new, empty when it is used up.
 * Free packages have no quota and show no bar.
 */
export function BeadString({ usage, size = 'sm', label }: { usage: Usage; size?: keyof typeof BAR_WIDTHS; label: string }) {
  const c = useColors()
  if (usage.isFree || usage.total === null) return null
  const total = Math.max(usage.total, 1)
  const left = Math.min(Math.max(usage.remaining ?? 0, 0), total)
  const tone = remainingTone(usage)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.bar, { width: BAR_WIDTHS[size], height: size === 'lg' ? 8 : 6, backgroundColor: c.track }]}
    >
      <View style={[styles.fill, { width: `${Math.round((left / total) * 100)}%`, backgroundColor: tone === 'low' || tone === 'out' ? c.action : c.accent }]} />
    </View>
  )
}

export type PegSeat = {
  id: string
  name: string
  status: string
  /** Still "scheduled" although the lesson day has passed. */
  overdue?: boolean
}

const PEG_SIZES = { sm: { box: 26, radius: 7, font: 10 }, md: { box: 38, radius: 11, font: 12.5 }, lg: { box: 46, radius: 13, font: 14 } }

function pegLook(c: Colors, seat: PegSeat): { box: ViewStyle; ink: string; struck?: boolean } {
  if (seat.status === 'attended') return { box: { backgroundColor: c.positiveWash, borderColor: c.positiveLine }, ink: c.positiveInk }
  if (seat.status === 'makeup') return { box: { backgroundColor: c.pinkWash, borderColor: c.pinkLine }, ink: c.pinkInk }
  // An absence is counted, not a danger: grey
  if (seat.status === 'no_show') return { box: { backgroundColor: c.well, borderColor: c.line }, ink: c.ink3 }
  if (seat.status === 'postponed' || seat.status === 'cancelled')
    return { box: { backgroundColor: c.surface, borderStyle: 'dashed', borderColor: c.lineStrong }, ink: c.ink3, struck: true }
  if (seat.overdue) return { box: { backgroundColor: c.actionWash, borderColor: c.actionLine }, ink: c.actionInk }
  return { box: { backgroundColor: c.surface2, borderColor: c.line }, ink: c.ink2 }
}

/** One child as an initials tile, tinted by their attendance. */
export function Peg({ seat, size = 'md', style }: { seat: PegSeat; size?: keyof typeof PEG_SIZES; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const s = PEG_SIZES[size]
  const look = pegLook(c, seat)
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.peg, { width: s.box, height: s.box, borderRadius: s.radius }, look.box, style]}
    >
      {/* A tile has a fixed size, so its initials grow only a little with the phone's text size */}
      <Text
        weight="600"
        tabular
        maxFontSizeMultiplier={1.15}
        style={{ fontSize: s.font, lineHeight: s.font + 3, color: look.ink, textDecorationLine: look.struck ? 'line-through' : 'none' }}
      >
        {initialsOf(seat.name)}
      </Text>
    </View>
  )
}

/**
 * A lesson's seats: the children holding one as tiles, then the count against the planned six.
 * Children past six get a red outline (the room is planned for six; the database allows ten).
 * Children who gave up their seat follow after a thin rule.
 */
export function SocketBoard({ seats, capacity = 6, size = 'sm', label }: { seats: PegSeat[]; capacity?: number; size?: keyof typeof PEG_SIZES; label: string }) {
  const c = useColors()
  const s = PEG_SIZES[size]
  const holders = seats.filter((seat) => holdsSeat(seat.status))
  const others = seats.filter((seat) => !holdsSeat(seat.status))
  const over = holders.length > capacity
  return (
    <View accessible accessibilityLabel={label} style={styles.board}>
      {holders.map((seat, index) =>
        index >= capacity ? (
          <View key={seat.id} style={[styles.over, { borderColor: c.negative, borderRadius: s.radius + 3 }]}>
            <Peg seat={seat} size={size} />
          </View>
        ) : (
          <Peg key={seat.id} seat={seat} size={size} />
        )
      )}
      {others.length > 0 && <View style={[styles.rule, { backgroundColor: c.lineStrong, height: s.box - 6 }]} />}
      {others.map((seat) => (
        <Peg key={seat.id} seat={seat} size={size} />
      ))}
      <Text variant="foot" tabular weight={over ? '600' : undefined} tone={over ? 'negativeInk' : 'ink3'} style={styles.count}>
        {holders.length}/{capacity}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  bar: { borderRadius: 999, overflow: 'hidden', flexShrink: 0 },
  fill: { height: '100%', borderRadius: 999 },
  peg: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
  board: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  over: { borderWidth: 2, padding: 1, margin: -3 },
  rule: { width: StyleSheet.hairlineWidth * 2, marginHorizontal: 2 },
  count: { marginLeft: 4 }
})
