import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AttendanceStatus } from '@hellokido/core/api'
import { useLabels } from '../data/queries'
import { useI18n } from '../providers/I18n'
import { useColors, type Colors } from '../theme/colors'
import { Icon } from './Icon'
import { Text } from './Text'

const OTHER: AttendanceStatus[] = ['postponed', 'makeup']

// The chosen answer is a white piece with a dot in its tile's colour; an absence is grey, never red
function selected(c: Colors, status: AttendanceStatus) {
  if (status === 'attended') return { dot: c.positive }
  if (status === 'no_show') return { dot: c.ink3 }
  if (status === 'makeup') return { dot: c.pink }
  return { dot: c.lineStrong }
}

/**
 * Attendance in one tap: the two common answers as buttons, postponed and make-up behind "Other"
 * (the phone's own action sheet). "Scheduled" is never chosen here; a lesson only moves on from it.
 */
export function AttendancePicker({
  status,
  onChange,
  label,
  disabled
}: {
  status: string
  onChange: (status: AttendanceStatus) => void
  /** What a screen reader hears for the group, e.g. "Ada's attendance". */
  label: string
  disabled?: boolean
}) {
  const c = useColors()
  const { t } = useI18n()
  const labels = useLabels()
  const other = OTHER.includes(status as AttendanceStatus)

  const choose = (next: AttendanceStatus) => {
    if (disabled || next === status) return
    void Haptics.selectionAsync()
    onChange(next)
  }

  const openOther = () => {
    if (disabled) return
    const names = OTHER.map((mark) => labels.attendance(mark))
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: label, options: [...names, t.common.cancel], cancelButtonIndex: names.length },
        (index) => index < OTHER.length && choose(OTHER[index])
      )
    } else {
      Alert.alert(label, undefined, [...OTHER.map((mark, index) => ({ text: names[index], onPress: () => choose(mark) })), { text: t.common.cancel, style: 'cancel' }], {
        cancelable: true
      })
    }
  }

  const part = (mark: AttendanceStatus | 'other', text: string, onPress: () => void, isOn: boolean, grow: boolean) => {
    const look = isOn ? selected(c, (mark === 'other' ? status : mark) as AttendanceStatus) : null
    return (
      <Pressable
        key={mark}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={mark === 'other' ? 'button' : 'radio'}
        accessibilityState={{ selected: isOn, checked: mark === 'other' ? undefined : isOn, disabled: Boolean(disabled) }}
        hitSlop={{ top: 4, bottom: 4 }}
        style={({ pressed }) => [
          styles.part,
          grow ? styles.grow : styles.other,
          look && { backgroundColor: c.raised, borderColor: c.line },
          look && styles.lifted,
          pressed && !look && { backgroundColor: c.line2 }
        ]}
      >
        {look && <View style={[styles.dot, { backgroundColor: look.dot }]} />}
        <Text variant="sub" weight="500" numberOfLines={1} style={{ color: look ? c.ink : c.ink3, flexShrink: 1, fontSize: 14 }}>
          {text}
        </Text>
        {mark === 'other' && <Icon name="chevronDown" size={11} color={look ? c.ink : c.ink3} weight="bold" />}
      </Pressable>
    )
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.track, { backgroundColor: c.well, borderColor: c.line, opacity: disabled ? 0.6 : 1 }]}>
      {part('attended', labels.attendance('attended'), () => choose('attended'), status === 'attended', true)}
      {part('no_show', labels.attendance('no_show'), () => choose('no_show'), status === 'no_show', true)}
      {part('other', other ? labels.attendance(status) : t.today.otherStatus, openOther, other, false)}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 2 },
  part: { height: 38, borderRadius: 999, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  grow: { flex: 1 },
  other: { flexShrink: 1, minWidth: 76, paddingLeft: 12, paddingRight: 9 },
  lifted: { shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }
})
