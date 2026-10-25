import type { ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { useColors, type Colors } from '../theme/colors'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

type Variant = 'primary' | 'tinted' | 'plain' | 'danger'
type Size = 'lg' | 'md' | 'sm'

// Every button is a pill, as in the rest of the app's design
const SIZES = {
  lg: { height: 50, radius: 25, paddingHorizontal: 22, font: 16, icon: 19 },
  md: { height: 44, radius: 22, paddingHorizontal: 16, font: 15, icon: 17 },
  sm: { height: 34, radius: 17, paddingHorizontal: 13, font: 14, icon: 15 }
} as const

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** The smallest fingertip each phone asks for: 44pt on the iPhone, 48dp on Android. */
const TOUCH = Platform.OS === 'android' ? 48 : 44

function tones(c: Colors, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { background: c.accentSolid, ink: c.onAccent, line: c.accentSolid }
    // The everyday button: white with a grey outline
    case 'tinted':
      return { background: c.surface, ink: c.ink, line: c.lineStrong }
    case 'danger':
      return { background: c.negativeWash, ink: c.negativeInk, line: c.negativeLine }
    default:
      return { background: 'transparent', ink: c.accentInk, line: 'transparent' }
  }
}

type Props = {
  children: ReactNode
  onPress?: () => void
  variant?: Variant
  size?: Size
  icon?: IconName
  disabled?: boolean
  /** Saving: the label stays in place under a spinner so the button keeps its width. */
  busy?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function Button({ children, onPress, variant = 'tinted', size = 'md', icon, disabled, busy, accessibilityLabel, style }: Props) {
  const c = useColors()
  const s = SIZES[size]
  const tone = tones(c, variant)
  const inactive = Boolean(disabled || busy)
  const still = useReducedMotion()
  // 0 at rest, 1 under the finger: the pill dims and gives a little, then settles back
  const press = useSharedValue(0)
  const sinks = variant !== 'plain' && !still
  const pressStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.45 : 1 - press.get() * 0.28,
    transform: [{ scale: sinks ? 1 - press.get() * 0.025 : 1 }]
  }))
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
      onPressOut={() => press.set(withTiming(0, { duration: 200 }))}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      // Small buttons still take a whole fingertip
      hitSlop={s.height < TOUCH ? { top: (TOUCH - s.height) / 2, bottom: (TOUCH - s.height) / 2, left: 4, right: 4 } : undefined}
      style={[
        styles.base,
        {
          height: s.height,
          borderRadius: s.radius,
          paddingHorizontal: variant === 'plain' ? 4 : s.paddingHorizontal,
          backgroundColor: tone.background,
          borderWidth: 1,
          borderColor: tone.line
        },
        style,
        pressStyle
      ]}
    >
      <View style={[styles.content, busy && styles.hidden]}>
        {icon && <Icon name={icon} size={s.icon} color={tone.ink} weight="semibold" />}
        {/* A long Turkish label gives up a little size before it gives up its last word */}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} weight="500" style={[styles.label, { fontSize: s.font, lineHeight: s.font + 5, color: tone.ink }]}>
          {children}
        </Text>
      </View>
      {busy && <ActivityIndicator color={tone.ink} style={StyleSheet.absoluteFill} />}
    </AnimatedPressable>
  )
}

/** A round button that is only an icon; the label is what a screen reader says. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'tinted',
  size = 34,
  color,
  disabled,
  style
}: {
  icon: IconName
  label: string
  onPress?: () => void
  variant?: 'tinted' | 'plain' | 'well'
  size?: number
  color?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const background = variant === 'tinted' ? c.surface : variant === 'well' ? c.well : 'transparent'
  // Every round button answers to a whole fingertip, however small it is drawn
  const slop = Math.max(0, (TOUCH - size) / 2)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={slop}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderWidth: variant === 'tinted' ? 1 : 0,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.6 : 1
        },
        style
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={color ?? (variant === 'plain' ? c.accentInk : c.ink)} weight="semibold" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: '100%' },
  label: { flexShrink: 1 },
  hidden: { opacity: 0 },
  round: { alignItems: 'center', justifyContent: 'center' }
})
