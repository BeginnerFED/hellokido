import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { AttendanceStatus } from '@hellokido/core/api'
import { useLabels } from '../data/queries'
import { useI18n } from '../providers/I18n'
import { typeTone, useColors } from '../theme/colors'
import { useActionMenu } from './ActionMenu'
import { Icon } from './Icon'
import { Text } from './Text'

const OTHER: AttendanceStatus[] = ['postponed', 'makeup']
const PAD = 3

type Part = { mark: AttendanceStatus | 'other'; text: string; onPress: () => void; on: boolean }

/**
 * Attendance in one tap: "Katıldı | Gelmedi | Diğer" on a pill track, the answer a raised thumb
 * that slides to it. Postponed and make-up are behind "Diğer" (the phone's own action sheet).
 * "Scheduled" is never chosen here; a lesson only moves on from it. On a lesson's card (`type`)
 * the track and words take the lesson's colours; `compact` is the 190pt picker of a row's end.
 */
export function AttendancePicker({
  status,
  onChange,
  label,
  disabled,
  type,
  compact
}: {
  status: string
  onChange: (status: AttendanceStatus) => void
  /** What a screen reader hears for the group, e.g. "Ada's attendance". */
  label: string
  disabled?: boolean
  type?: string
  compact?: boolean
}) {
  const c = useColors()
  const { t } = useI18n()
  const labels = useLabels()
  const still = useReducedMotion()
  const other = OTHER.includes(status as AttendanceStatus)
  const tone = type ? typeTone(c, type) : null

  const choose = (next: AttendanceStatus) => {
    if (disabled || next === status) return
    void Haptics.selectionAsync()
    onChange(next)
  }

  // The iPhone's own action sheet; on Android the app's sheet, since its alert puts "Cancel" where "OK" goes
  const menu = useActionMenu()
  const openOther = () => {
    if (disabled) return
    menu.open(
      label,
      OTHER.map((mark) => ({ label: labels.attendance(mark), selected: mark === status, onPress: () => choose(mark) }))
    )
  }

  const parts: Part[] = [
    { mark: 'attended', text: labels.attendance('attended'), onPress: () => choose('attended'), on: status === 'attended' },
    { mark: 'no_show', text: labels.attendance('no_show'), onPress: () => choose('no_show'), on: status === 'no_show' },
    { mark: 'other', text: other ? labels.attendance(status) : t.today.otherStatus, onPress: openOther, on: other }
  ]
  const chosen = parts.findIndex((part) => part.on)

  // Where each segment sits, so the thumb can slide from one to the next
  const [frames, setFrames] = useState<({ x: number; width: number } | undefined)[]>([])
  const x = useSharedValue(0)
  const width = useSharedValue(0)
  const placed = useRef(false)
  const frame = chosen >= 0 ? frames[chosen] : undefined
  useEffect(() => {
    if (!frame) {
      placed.current = false
      return
    }
    const timing = { duration: 180, easing: Easing.out(Easing.cubic) }
    // Put in place the first time; slide afterwards, unless the phone asks for less motion
    if (still || !placed.current) {
      x.set(frame.x)
      width.set(frame.width)
    } else {
      x.set(withTiming(frame.x, timing))
      width.set(withTiming(frame.width, timing))
    }
    placed.current = true
  }, [frame, still, x, width])
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: width.get() }))

  const ink = tone ? tone.ink : c.ink2
  const attendedInk = tone?.dark ? '#BFF0D3' : c.greenInk
  const font = compact ? 13 : 13.5

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, compact && styles.compact, { backgroundColor: tone ? tone.track : c.track, opacity: disabled ? 0.6 : 1 }]}
    >
      {frame && <Animated.View style={[styles.thumb, { backgroundColor: tone ? tone.thumb : c.raised, boxShadow: c.liftShadow }, thumb]} />}
      {parts.map((part, index) => {
        const color = part.on ? (part.mark === 'attended' ? attendedInk : tone ? tone.ink : part.mark === 'no_show' ? c.ink2 : c.ink) : ink
        return (
          <Pressable
            key={part.mark}
            onPress={part.onPress}
            disabled={disabled}
            onLayout={(event) => {
              const { x: left, width: size } = event.nativeEvent.layout
              setFrames((current) => {
                const before = current[index]
                if (before && Math.abs(before.x - left) < 0.5 && Math.abs(before.width - size) < 0.5) return current
                const next = [...current]
                next[index] = { x: left, width: size }
                return next
              })
            }}
            accessibilityRole={part.mark === 'other' ? 'button' : 'radio'}
            accessibilityState={{ selected: part.on, checked: part.mark === 'other' ? undefined : part.on, disabled: Boolean(disabled) }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [styles.part, compact && styles.partCompact, pressed && !part.on && { opacity: 0.55 }]}
          >
            {part.on && part.mark === 'attended' && <Icon name="check" size={compact ? 12 : 13} color={color} weight="bold" />}
            <Text weight="500" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2} style={{ color, fontSize: font, lineHeight: font + 4, flexShrink: 1 }}>
              {part.text}
            </Text>
          </Pressable>
        )
      })}
      {menu.element}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 999, padding: PAD, minHeight: 36 },
  // Wide enough for the tick and the three words at 13pt; the name beside it gives way first
  compact: { width: 200, flexShrink: 0 },
  // Drawn under the words; slides between the segments
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: 999 },
  // Each segment as wide as its words, sharing what is left
  part: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minHeight: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 10 },
  partCompact: { paddingHorizontal: 6, gap: 3 }
})
