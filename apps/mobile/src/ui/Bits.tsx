import { Fragment, useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { typeTone, useColors } from '../theme/colors'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

export function initialsOf(name: string | null | undefined) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toLocaleUpperCase('tr-TR')
}

/** The given name of "Elif Su Yılmaz": every word but the last ("Elif Su"); one word stays as it is. */
export function firstNameOf(name: string | null | undefined) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words.length > 1 ? words.slice(0, -1).join(' ') : (words[0] ?? '')
}

/** The size of a person's circle before a row's words. */
export const AVATAR = 40
/** Where the rule under a row that leads with an Avatar starts: rules now run across the card's content. */
export const AVATAR_INSET = 16

/**
 * A person as a circle of initials set on the felt (white, a felt step up in the dark). On a
 * lesson's card (`type`) it takes the lesson's ink. Only decoration: the name is always read next to it.
 */
export function Avatar({ name, size = AVATAR, type }: { name: string; size?: number; type?: string }) {
  const c = useColors()
  const tone = type ? typeTone(c, type) : null
  const font = size >= 60 ? Math.round(size * 0.34) : size >= 40 ? 14 : 13
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone ? (tone.dark ? tone.track : c.raised) : c.onFelt }
      ]}
    >
      {/* The circle has a fixed size, so its letters grow only a little with the phone's text size */}
      <Text weight="600" maxFontSizeMultiplier={1.15} style={{ fontSize: font, lineHeight: Math.round(font * 1.25), color: tone ? tone.ink : c.ink2, letterSpacing: 0.1 }}>
        {initialsOf(name)}
      </Text>
    </View>
  )
}

/** A resting block while something loads; it breathes unless the phone asks for less motion. */
export function Skeleton({ height = 16, width = '100%', radius = 8, style }: { height?: number; width?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const still = useReducedMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (!still) opacity.set(withRepeat(withTiming(0.45, { duration: 900 }), -1, true))
  }, [opacity, still])
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: radius, backgroundColor: c.track }, animated, style]} />
}

const LINE_WIDTHS: DimensionValue[] = ['55%', '42%', '63%']

/**
 * A felt card of resting rows (circle and two lines) while a list of people loads. Each row has the
 * size of a real Row with an avatar, title and subtitle, so nothing jumps when the list arrives.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  const c = useColors()
  return (
    <View style={[styles.skeleton, { backgroundColor: c.felt }]}>
      {Array.from({ length: rows }, (_, index) => (
        <Fragment key={index}>
          {index > 0 && <View style={[styles.skeletonRule, { backgroundColor: c.line }]} />}
          <View style={styles.skeletonRow}>
            <Skeleton height={AVATAR} width={AVATAR} radius={AVATAR / 2} />
            <View style={styles.skeletonLines}>
              <View style={styles.skeletonTitle}>
                <Skeleton height={13} width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
              </View>
              <View style={styles.skeletonSub}>
                <Skeleton height={10} width="35%" />
              </View>
            </View>
          </View>
        </Fragment>
      ))}
    </View>
  )
}

type MarkTone = 'action' | 'positive' | 'negative' | 'accent' | 'neutral' | 'pink'

/**
 * A status as a 7pt dot and words in its ink ("Ödeme bekliyor"), never a filled block. Amber is
 * kept for what needs the admin's action.
 */
export function Mark({ tone, children }: { tone: MarkTone; children: ReactNode }) {
  const c = useColors()
  const [ink, dot] = {
    action: [c.amberInk, c.amber],
    positive: [c.greenInk, c.green],
    negative: [c.negativeInk, c.negative],
    accent: [c.accentInk, c.accent],
    pink: [c.pinkInk, c.pink],
    neutral: [c.ink2, c.mute]
  }[tone]
  return (
    <View style={styles.mark}>
      <View style={[styles.markDot, { backgroundColor: dot }]} />
      {/* The mark keeps its line, so its words grow less with the phone's text size */}
      <Text weight="500" numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.markText, { color: ink }]}>
        {children}
      </Text>
    </View>
  )
}

/**
 * Where a lesson stands, as words on its card: "Şimdi" led by the pink live dot while it runs, or a
 * plain word ("Bitti", "Sıradaki"). Bare text in the card's ink, so it never reads as a button.
 */
export function LiveMark({ children, live, type }: { children: string; live?: boolean; type?: string }) {
  const c = useColors()
  const tone = type ? typeTone(c, type) : null
  return (
    <View style={styles.live}>
      {live && <View style={[styles.liveDot, { backgroundColor: c.pink, boxShadow: `0 0 0 3px ${c.pink}38` }]} />}
      <Text weight={live ? '600' : '500'} numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.liveText, { color: tone?.ink ?? c.ink2 }, !live && styles.liveQuiet]}>
        {children}
      </Text>
    </View>
  )
}

export type NoticeTone = 'info' | 'action' | 'positive' | 'negative'

/** A sentence that explains what will happen: on felt, led by a dot in the colour of what it asks. */
export function Notice({ tone = 'info', children, style }: { tone?: NoticeTone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const [ink, dot] = {
    info: [c.ink2, c.accent],
    action: [c.amberInk, c.amber],
    positive: [c.greenInk, c.green],
    negative: [c.negativeInk, c.negative]
  }[tone]
  return (
    <View accessibilityRole={tone === 'negative' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: c.felt }, style]}>
      <View style={[styles.noticeDot, { backgroundColor: dot }]} />
      <Text variant="sub" style={[styles.flex, { color: ink }]}>
        {children}
      </Text>
    </View>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  const c = useColors()
  return (
    <View style={styles.empty}>
      {icon && (
        <View style={[styles.emptyIcon, { backgroundColor: c.onFelt }]}>
          <Icon name={icon} size={24} color={c.ink2} />
        </View>
      )}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {body && (
        <Text variant="sub" tone="ink2" align="center" style={{ marginTop: 4, maxWidth: 300 }}>
          {body}
        </Text>
      )}
      {action && <View style={{ marginTop: 14 }}>{action}</View>}
    </View>
  )
}

/** Where a list failed to load: what happened and a way to try again. */
export function LoadError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  const c = useColors()
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.felt }]}>
      <View style={[styles.noticeDot, { backgroundColor: c.negative, marginTop: 0 }]} />
      <Text variant="sub" style={{ color: c.negativeInk, flex: 1 }}>
        {message}
      </Text>
      <Button size="sm" onPress={onRetry}>
        {retryLabel}
      </Button>
    </View>
  )
}

type TodoRowProps = {
  icon: IconName
  title: string
  /** The concrete line under it: which children, which lesson, how much. */
  subtitle?: ReactNode
  /** An amber dot on the icon: the job is overdue. */
  alert?: boolean
  /** The small button at the end ("Gir", "Gör", "Gönder"); none when the job is done. */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string; busy?: boolean }
  /** A tap on the row itself (the words), such as unfolding the list behind it. */
  onPress?: () => void
  accessibilityLabel?: string
  /** Expanded or folded, for a row that unfolds a list. */
  expanded?: boolean
}

/** One row of Today's cards (a job of "Seni bekleyenler", or payments and packages): an icon in a circle, what it is, and one small button. */
export function TodoRow({ icon, title, subtitle, alert, action, onPress, accessibilityLabel, expanded }: TodoRowProps) {
  const c = useColors()
  const words = (
    <>
      <View style={[styles.todoIcon, { backgroundColor: c.onFelt }]}>
        <Icon name={icon} size={18} color={c.ink2} />
        {alert && <View style={[styles.tileDot, { backgroundColor: c.amber, borderColor: c.felt }]} />}
      </View>
      <View style={styles.flex}>
        <Text weight="500" numberOfLines={2}>
          {title}
        </Text>
        {subtitle !== undefined &&
          (typeof subtitle === 'string' ? (
            <Text variant="sub" tone="ink3" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
      </View>
    </>
  )
  return (
    <View style={styles.todo}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={expanded === undefined ? undefined : { expanded }}
          style={({ pressed }) => [styles.todoWords, pressed && { opacity: 0.6 }]}
        >
          {words}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={accessibilityLabel} style={styles.todoWords}>
          {words}
        </View>
      )}
      {action && (
        <Button size="sm" onPress={action.onPress} busy={action.busy} accessibilityLabel={action.accessibilityLabel}>
          {action.label}
        </Button>
      )}
    </View>
  )
}

/**
 * A felt tile of one figure (Gelen / Giden): a dot and a label, the amount (24) and a sub-line.
 * Pressing it filters what it counts; `selected` shows the filter is on.
 */
export function StatTile({
  label,
  value,
  sub,
  note,
  dot,
  valueSize,
  onPress,
  selected,
  accessibilityLabel,
  accessibilityHint,
  style
}: {
  label: string
  value: string
  sub?: string
  /** A quieter second line under `sub` (the period before), up to two lines. */
  note?: string
  /** The colour of the dot before the label (c.sky, c.out). */
  dot?: string
  /** One size for the figures of tiles side by side (24 unless a long amount needs less). */
  valueSize?: number
  onPress?: () => void
  selected?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const body = (
    <>
      <View style={styles.statLabel}>
        {dot && <View style={[styles.markDot, { backgroundColor: dot }]} />}
        <Text weight="500" tone="ink2" numberOfLines={1} style={styles.statLabelText}>
          {label}
        </Text>
      </View>
      <Text tabular weight="600" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, valueSize !== undefined && { fontSize: valueSize }]}>
        {value}
      </Text>
      {sub !== undefined && (
        <Text variant="sub" tone="ink3" numberOfLines={1}>
          {sub}
        </Text>
      )}
      {note ? (
        <Text variant="foot" tone="ink3" numberOfLines={2} style={styles.statNote}>
          {note}
        </Text>
      ) : null}
    </>
  )
  const look = [styles.stat, { backgroundColor: selected ? c.skyFelt : c.felt }, style]
  if (!onPress) return <View style={look}>{body}</View>
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [look, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {body}
    </Pressable>
  )
}

/**
 * A day as a 44pt tile before a row: the day (17) over a short month or weekday (11). `late`
 * tints it amber for a day that has passed with the job still open.
 */
export function DateTile({ day, under, late }: { day: string | number; under: string; late?: boolean }) {
  const c = useColors()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dateTile, { backgroundColor: late ? c.lateTile : c.onFelt }]}
    >
      <Text weight="600" tabular maxFontSizeMultiplier={1.15} style={[styles.dateDay, { color: late ? c.amberInk : c.ink }]}>
        {day}
      </Text>
      <Text maxFontSizeMultiplier={1.15} style={[styles.dateUnder, { color: late ? c.amberInk : c.ink3 }]}>
        {under}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // The same measures as Card and Row in Screen.tsx
  skeleton: { borderRadius: 26, overflow: 'hidden', paddingVertical: 4 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 62 },
  skeletonRule: { height: 1, marginHorizontal: 16 },
  skeletonLines: { flex: 1, gap: 1 },
  skeletonTitle: { height: 21, justifyContent: 'center' },
  skeletonSub: { height: 18, justifyContent: 'center' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  markDot: { width: 7, height: 7, borderRadius: 4 },
  markText: { fontSize: 13, lineHeight: 17, flexShrink: 1 },
  live: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 14, lineHeight: 18 },
  liveQuiet: { opacity: 0.75 },
  notice: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  error: { borderRadius: 20, paddingLeft: 16, paddingRight: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14, paddingVertical: 12, minHeight: 64 },
  todoWords: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  todoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  stat: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 15 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statLabelText: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  statValue: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, marginTop: 4 },
  statNote: { marginTop: 6 },
  dateTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dateDay: { fontSize: 17, lineHeight: 19 },
  dateUnder: { fontSize: 11, lineHeight: 13, marginTop: 1 }
})
