import type { ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useColors, type Colors } from '../theme/colors'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

/**
 * primary: the one filled blue button of a screen ("Ödeme al").
 * secondary: raised white with a soft lift, the small action buttons on felt ("Gir", "Tahsil et").
 * quiet: felt with no shadow ("Ara", "Mesaj").
 * plain: blue words only.
 * danger: raised with red words.
 * tinted and gray are the older names of secondary.
 */
type Variant = 'primary' | 'secondary' | 'quiet' | 'plain' | 'danger' | 'tinted' | 'gray'
type Size = 'lg' | 'md' | 'sm'

// Pills of 48, 44 and 34
const SIZES = {
  lg: { height: 48, paddingHorizontal: 22, font: 16, icon: 18 },
  md: { height: 44, paddingHorizontal: 18, font: 15.5, icon: 18 },
  sm: { height: 34, paddingHorizontal: 14, font: 14, icon: 15 }
} as const

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** The smallest fingertip each phone asks for: 44pt on the iPhone, 48dp on Android. */
const TOUCH = Platform.OS === 'android' ? 48 : 44

function tones(c: Colors, variant: Variant): { background: string; ink: string; shadow?: string } {
  switch (variant) {
    // The solid blue keeps white words readable (AA); a black fill reads as gloomy here (owner)
    case 'primary':
      return { background: c.fill, ink: c.onFill }
    case 'quiet':
      return { background: c.felt, ink: c.ink }
    case 'danger':
      return { background: c.raised, ink: c.negativeInk, shadow: c.liftShadow }
    case 'plain':
      return { background: 'transparent', ink: c.accentInk }
    default:
      return { background: c.raised, ink: c.ink, shadow: c.liftShadow }
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

export function Button({ children, onPress, variant = 'secondary', size = 'md', icon, disabled, busy, accessibilityLabel, style }: Props) {
  const c = useColors()
  const s = SIZES[size]
  const tone = tones(c, variant)
  const inactive = Boolean(disabled || busy)
  // 0 at rest, 1 under the finger: the button dims as the phone's own do, then settles back
  const press = useSharedValue(0)
  const pressStyle = useAnimatedStyle(() => ({ opacity: disabled ? 0.4 : 1 - press.get() * 0.3 }))
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 60 }))}
      onPressOut={() => press.set(withTiming(0, { duration: 220 }))}
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
          borderRadius: s.height / 2,
          paddingHorizontal: variant === 'plain' ? 4 : s.paddingHorizontal,
          backgroundColor: tone.background
        },
        tone.shadow !== undefined && { boxShadow: tone.shadow },
        style,
        pressStyle
      ]}
    >
      <View style={[styles.content, busy && styles.hidden]}>
        {icon && <Icon name={icon} size={s.icon} color={tone.ink} weight="regular" />}
        {/* A long Turkish label gives up a little size before it gives up its last word */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          weight={variant === 'primary' ? '600' : '500'}
          style={[styles.label, { fontSize: s.font, lineHeight: Math.round(s.font + 5), color: tone.ink }]}
        >
          {children}
        </Text>
      </View>
      {busy && <ActivityIndicator color={tone.ink} style={StyleSheet.absoluteFill} />}
    </AnimatedPressable>
  )
}

/**
 * A round button that is only an icon; the label is what a screen reader says.
 * glass: the 44pt round button over the page (in-content headers), with the float shadow.
 * felt: a felt circle with no shadow (Finance's period arrows).
 * tinted: a raised circle with a soft lift, on felt. well: a track circle. plain: the icon alone.
 */
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
  variant?: 'tinted' | 'plain' | 'well' | 'glass' | 'felt'
  size?: number
  color?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const background = { tinted: c.raised, well: c.track, glass: c.glass, felt: c.felt, plain: 'transparent' }[variant]
  const shadow = variant === 'glass' ? c.floatShadow : variant === 'tinted' ? c.liftShadow : undefined
  // Every round button answers to a whole fingertip, however small it is drawn
  const slop = Math.max(0, (TOUCH - size) / 2)
  const glyph = variant === 'glass' || variant === 'felt' ? Math.round(size * 0.45) : Math.round(size * 0.5)
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
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        shadow !== undefined && { boxShadow: shadow },
        style
      ]}
    >
      <Icon name={icon} size={glyph} color={color ?? (variant === 'plain' ? c.accentInk : c.ink)} weight="regular" />
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
