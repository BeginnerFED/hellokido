import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { remainingTone, type Usage } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { lessonTypeOf, typeTone, useColors, type Colors } from '../theme/colors'
import { initialsOf } from './Bits'
import { Icon } from './Icon'
import { Text, type TextVariant } from './Text'

/*
 * The felt board's own pieces:
 * - a lesson type is a shape and a colour: İngilizce a circle, Duyusal a rounded square, Özel a
 *   diamond, so the types read without colour too;
 * - a package is a string of beads (attended, absent, planned);
 * - a child is a circle of initials, tinted by the attendance it holds;
 * - a lesson's seats are a strip of dots with the count beside them.
 */

/** An age group as plain text; kept as a component so every place words it the same. */
export function AgeTablet({ label, variant = 'sub' }: { group?: string; label?: string; variant?: TextVariant }) {
  if (label === undefined) return null
  return (
    <Text variant={variant} tone="ink3" numberOfLines={1} style={styles.shrink}>
      {label}
    </Text>
  )
}

/**
 * The lesson type's shape in its colour: a circle (İngilizce), a rounded square (Duyusal) or a
 * diamond (Özel). 10 in text, 6 under the week's days, 22 on a type tile.
 */
export function LessonShape({ type, size = 10, color }: { type: string; size?: number; color?: string }) {
  const c = useColors()
  const kind = lessonTypeOf(type)
  const fill = color ?? typeTone(c, kind).mid
  if (kind === 'ingilizce') return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill }} />
  if (kind === 'duyusal') return <View style={{ width: size, height: size, borderRadius: Math.max(2, size * 0.28), backgroundColor: fill }} />
  // A square turned a quarter: drawn a little smaller so its corners line up with the others
  const side = Math.round(size * 0.82)
  return (
    <View style={[styles.diamondBox, { width: size, height: size }]}>
      <View style={{ width: side, height: side, borderRadius: Math.max(1, size * 0.18), backgroundColor: fill, transform: [{ rotate: '45deg' }] }} />
    </View>
  )
}

const BAR_WIDTHS = { sm: 64, md: 84, lg: '100%' } as const

/**
 * The lessons left as a slim share bar, for rows: full when the package is new, empty when it is
 * used up. Free packages have no quota and show no bar. The child's page shows `Beads` instead.
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
      <View style={[styles.fill, { width: `${Math.round((left / total) * 100)}%`, backgroundColor: tone === 'low' || tone === 'out' ? c.amber : c.accent }]} />
    </View>
  )
}

/**
 * The lessons of a package as beads: attended green with a tick, absent red with an X, planned an empty
 * ring, and (`open`) lessons still to book as plain track. `label` is what a screen reader says for
 * the whole string ("4 attended, 1 absent, 3 planned"). `perRow` breaks a long package (24 lessons)
 * into rows of equal beads.
 */
export function Beads({
  attended,
  absent,
  planned,
  open = 0,
  perRow,
  label,
  style
}: {
  attended: number
  absent: number
  planned: number
  open?: number
  perRow?: number
  label: string
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const beads = [
    ...Array.from({ length: Math.max(0, attended) }, () => 'y' as const),
    ...Array.from({ length: Math.max(0, absent) }, () => 'n' as const),
    ...Array.from({ length: Math.max(0, planned) }, () => 'p' as const),
    ...Array.from({ length: Math.max(0, open) }, () => 'o' as const)
  ]
  const bead = (kind: (typeof beads)[number] | null, index: number) => (
    <View
      key={index}
      style={[
        styles.bead,
        kind === 'y' && { backgroundColor: c.green },
        kind === 'n' && { backgroundColor: c.negative },
        kind === 'p' && { borderWidth: 1.5, borderColor: c.mute },
        kind === 'o' && { backgroundColor: c.track }
      ]}
    >
      {kind === 'y' && <Icon name="check" size={13} color={c.onGreen} weight="bold" />}
      {kind === 'n' && <Icon name="close" size={12} color={c.onNegative} weight="bold" />}
    </View>
  )
  // Rows of the same count, the last one filled out with clear room, so every bead keeps one width
  const rowCount = perRow && beads.length > perRow ? Math.ceil(beads.length / perRow) : 1
  const size = Math.ceil(beads.length / rowCount)
  if (rowCount === 1) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.beads, style]}>
        {beads.map(bead)}
      </View>
    )
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.beadRows, style]}>
      {Array.from({ length: rowCount }, (_, row) => (
        <View key={row} style={styles.beads}>
          {Array.from({ length: size }, (_, place) => {
            const index = row * size + place
            return index < beads.length ? bead(beads[index], index) : <View key={`room${index}`} style={styles.room} />
          })}
        </View>
      ))}
    </View>
  )
}

/**
 * The key under the beads: a dot (or ring) and its words, in a row ("4 katıldı · 1 gelmedi · 3 planlı").
 * An empty label leaves its item out; `open` keys the lessons still to book.
 */
export function BeadLegend({ attended, absent, planned, open }: { attended: string; absent: string; planned: string; open?: string }) {
  const c = useColors()
  const item = (dot: ViewStyle, text: string | undefined) =>
    text ? (
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, dot]} />
        <Text variant="sub" tone="ink2" numberOfLines={1}>
          {text}
        </Text>
      </View>
    ) : null
  return (
    <View style={styles.legend}>
      {item({ backgroundColor: c.green }, attended)}
      {item({ backgroundColor: c.negative }, absent)}
      {item({ borderWidth: 1.5, borderColor: c.mute }, planned)}
      {item({ backgroundColor: c.track }, open)}
    </View>
  )
}

/** A lesson's seats as six dots, taken ones filled in the type's colour, with a line beside them ("2 yer boş"). */
export function SeatDots({ taken, capacity = 6, type = 'ingilizce', label }: { taken: number; capacity?: number; type?: string; label: string }) {
  const c = useColors()
  const mid = typeTone(c, type).mid
  const dots = Math.max(capacity, taken)
  return (
    <View accessible accessibilityLabel={label} style={styles.seatStrip}>
      <View style={styles.seatDots}>
        {Array.from({ length: dots }, (_, index) => (
          <View
            key={index}
            style={[styles.seatDot, index < taken ? { backgroundColor: index >= capacity ? c.amber : mid } : { borderWidth: 1.5, borderColor: c.mute }]}
          />
        ))}
      </View>
      <Text variant="sub" tone="ink2" style={styles.shrink}>
        {label}
      </Text>
    </View>
  )
}

/**
 * A lesson type to choose in a sheet: the shape (22) over the name. The chosen tile takes the
 * type's felt, a 2pt ring in its colour and a check badge at its corner.
 */
export function TypeTile({ type, label, selected, onPress, disabled }: { type: string; label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const c = useColors()
  const tone = typeTone(c, type)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.typeTile,
        // The ring is always there, clear until chosen, so choosing never shifts the words
        { backgroundColor: selected ? tone.felt : c.felt, borderColor: selected ? tone.mid : 'transparent' },
        pressed && { transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.5 }
      ]}
    >
      <LessonShape type={type} size={22} />
      <Text weight="500" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.typeLabel, { color: selected ? tone.ink : c.ink }]}>
        {label}
      </Text>
      {selected && (
        <View style={[styles.typeCheck, { backgroundColor: tone.mid }]}>
          <Icon name="check" size={12} color={tone.dark ? c.page : '#FFFFFF'} weight="bold" />
        </View>
      )}
    </Pressable>
  )
}

/** A thin progress track in a lesson's colours: how much of it has passed. */
export function ProgressTrack({ share, type }: { share: number; type: string }) {
  const c = useColors()
  const tone = typeTone(c, type)
  const width = `${Math.round(Math.min(Math.max(share, 0), 1) * 100)}%` as const
  return (
    <View style={[styles.progress, { backgroundColor: tone.track }]}>
      <View style={[styles.progressFill, { width, backgroundColor: tone.mid }]} />
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

const PEG_SIZES = { sm: { box: 22, font: 10.5 }, md: { box: 36, font: 13 }, lg: { box: 44, font: 14 } }

/** The size of a seat's circle before a row's words. */
export const PEG = PEG_SIZES.md.box
/** Where the rule under a row that leads with a peg starts: rules now run across the card's content. */
export const PEG_INSET = 16

function pegLook(c: Colors, seat: PegSeat): { box: ViewStyle; ink: string; struck?: boolean } {
  if (seat.status === 'attended') return { box: { backgroundColor: c.positiveWash }, ink: c.greenInk }
  if (seat.status === 'makeup') return { box: { backgroundColor: c.pinkFelt }, ink: c.pinkInk }
  // An absence is seen at once: red, as on the child's beads
  if (seat.status === 'no_show') return { box: { backgroundColor: c.negativeWash }, ink: c.negativeInk }
  if (seat.status === 'postponed' || seat.status === 'cancelled')
    return { box: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.mute }, ink: c.ink3, struck: true }
  if (seat.overdue) return { box: { backgroundColor: c.lateTile }, ink: c.amberInk }
  return { box: { backgroundColor: c.onFelt }, ink: c.ink2 }
}

/** One child as a circle of initials, tinted by their attendance. */
export function Peg({ seat, size = 'md', style }: { seat: PegSeat; size?: keyof typeof PEG_SIZES; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const s = PEG_SIZES[size]
  const look = pegLook(c, seat)
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.peg, { width: s.box, height: s.box, borderRadius: s.box / 2 }, look.box, style]}
    >
      {/* A circle has a fixed size, so its initials grow only a little with the phone's text size */}
      <Text
        weight="600"
        maxFontSizeMultiplier={1.15}
        style={{ fontSize: s.font, lineHeight: Math.round(s.font * 1.3), color: look.ink, textDecorationLine: look.struck ? 'line-through' : 'none' }}
      >
        {initialsOf(seat.name)}
      </Text>
    </View>
  )
}

/**
 * A lesson's seats: the children holding one as circles, then the count against the planned six.
 * Children past six get an amber ring, a seat to sort out (the room is planned for six; the database allows ten).
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
          <View key={seat.id} style={[styles.over, { borderColor: c.amber, borderRadius: s.box / 2 + 3 }]}>
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
      <Text variant="sub" tabular weight={over ? '600' : '500'} tone={over ? 'amberInk' : 'ink3'} style={styles.count}>
        {holders.length}/{capacity}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  diamondBox: { alignItems: 'center', justifyContent: 'center' },
  bar: { borderRadius: 999, overflow: 'hidden', flexShrink: 0 },
  fill: { height: '100%', borderRadius: 999 },
  beads: { flexDirection: 'row', gap: 7 },
  bead: { flex: 1, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  beadRows: { gap: 7 },
  room: { flex: 1, height: 26 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  seatStrip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seatDots: { flexDirection: 'row', gap: 5 },
  seatDot: { width: 18, height: 18, borderRadius: 9 },
  typeTile: { flex: 1, minHeight: 82, borderRadius: 20, borderWidth: 2, paddingHorizontal: 10, paddingVertical: 12, gap: 10, justifyContent: 'space-between' },
  typeLabel: { fontSize: 15, lineHeight: 20 },
  typeCheck: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  peg: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  board: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  over: { borderWidth: 2, padding: 1, margin: -3 },
  rule: { width: StyleSheet.hairlineWidth * 2, marginHorizontal: 2 },
  count: { marginLeft: 4 }
})
