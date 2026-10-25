import { Fragment, useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useColors } from '../theme/colors'
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

/** A resting block while something loads; it breathes unless the phone asks for less motion. */
export function Skeleton({ height = 16, width = '100%', radius = 8, style }: { height?: number; width?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const still = useReducedMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (!still) opacity.set(withRepeat(withTiming(0.45, { duration: 900 }), -1, true))
  }, [opacity, still])
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: radius, backgroundColor: c.well }, animated, style]} />
}

const LINE_WIDTHS: DimensionValue[] = ['55%', '42%', '63%']

/**
 * A card of resting rows (peg and two lines) while a list of people loads. Each row has the size of
 * a real Row with a tile, title and subtitle, so nothing jumps when the list arrives.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  const c = useColors()
  return (
    <View style={[styles.skeleton, { backgroundColor: c.surface, borderColor: c.line }]}>
      {Array.from({ length: rows }, (_, index) => (
        <Fragment key={index}>
          {index > 0 && <View style={[styles.skeletonRule, { backgroundColor: c.line2 }]} />}
          <View style={styles.skeletonRow}>
            <Skeleton height={38} width={38} radius={11} />
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

/** A small status chip: an outline, a dot and a word. Amber is kept for what needs the admin's action. */
export function Mark({ tone, children }: { tone: MarkTone; children: ReactNode }) {
  const c = useColors()
  const [background, line, ink, dot] = {
    action: [c.actionWash, c.actionLine, c.actionInk, c.action],
    positive: [c.positiveWash, c.positiveLine, c.positiveInk, c.positive],
    negative: [c.negativeWash, c.negativeLine, c.negativeInk, c.negative],
    accent: [c.accentWash, c.accentLine, c.accentInk, c.accent],
    pink: [c.pinkWash, c.pinkLine, c.pinkInk, c.pink],
    neutral: [c.surface, c.line, c.ink2, c.ink3]
  }[tone]
  return (
    <View style={[styles.mark, { backgroundColor: background, borderColor: line }]}>
      <View style={[styles.markDot, { backgroundColor: dot }]} />
      {/* The chip keeps its height, so its word grows less with the phone's text size */}
      <Text variant="caption" weight="500" numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: ink }}>
        {children}
      </Text>
    </View>
  )
}

export type NoticeTone = 'info' | 'action' | 'positive' | 'negative'

/** A sentence that explains what will happen, tinted by what it asks of the person. */
export function Notice({ tone = 'info', children, style }: { tone?: NoticeTone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const [background, ink, line] = {
    info: [c.accentWash, c.accentInk, c.accentLine],
    action: [c.actionWash, c.actionInk, c.actionLine],
    positive: [c.positiveWash, c.positiveInk, c.positiveLine],
    negative: [c.negativeWash, c.negativeInk, c.negativeLine]
  }[tone]
  return (
    <View accessibilityRole={tone === 'negative' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: background, borderColor: line }, style]}>
      <Text variant="foot" style={{ color: ink }}>
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
        <View style={{ marginBottom: 10 }}>
          <Icon name={icon} size={30} color={c.ink3} />
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
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.negativeWash, borderColor: c.negativeLine }]}>
      <Text variant="sub" style={{ color: c.negativeInk, flex: 1 }}>
        {message}
      </Text>
      <Button variant="plain" size="sm" onPress={onRetry} style={{ marginRight: -4 }}>
        {retryLabel}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  // The same measures as Card and Row in Screen.tsx
  skeleton: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  skeletonRule: { height: 1, marginLeft: 64 },
  skeletonLines: { flex: 1, gap: 1 },
  skeletonTitle: { height: 22, justifyContent: 'center' },
  skeletonSub: { height: 18, justifyContent: 'center' },
  mark: { height: 22, borderRadius: 11, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  markDot: { width: 5, height: 5, borderRadius: 3 },
  notice: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  error: { borderRadius: 14, borderWidth: 1, paddingLeft: 16, paddingRight: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }
})
