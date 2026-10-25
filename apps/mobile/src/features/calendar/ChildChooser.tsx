import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { Registration } from '@hellokido/core/api'
import { byName, matchesChild } from '@hellokido/core/view'
import { useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { Avatar, AVATAR_INSET, EmptyState, ListSkeleton, LoadError } from '../../ui/Bits'
import { SearchField } from '../../ui/Fields'
import { Icon } from '../../ui/Icon'
import { Card } from '../../ui/Screen'
import { DOT, Text } from '../../ui/Text'

/** "3 yaş · Ayşe Yılmaz": what tells two children apart in a list. */
export const describeChild = (child: { student_age?: string | null; parent_name?: string | null }) =>
  [child.student_age, child.parent_name].filter(Boolean).join(DOT)

/**
 * Active children to tick for a lesson, found by their own or a parent's name, as the phone's own
 * people pickers: a search field over avatar rows with a tick circle at the end. Those ticked when
 * the list opened stay on top, so the order never jumps while ticking; archived children are never
 * offered, and `hidden` ones (already in the lesson) are left out.
 */
export function ChildChooser({ selected, onToggle, hidden }: { selected: Set<string>; onToggle: (child: Registration, on: boolean) => void; hidden?: Set<string> }) {
  const c = useColors()
  const { t } = useI18n()
  const registrations = useRegistrations()
  const [query, setQuery] = useState('')
  const [pinned] = useState(() => new Set(selected))

  const list = useMemo(() => {
    const active = (registrations.data ?? []).filter((row) => row.is_active === true && !hidden?.has(row.id))
    const top = active.filter((row) => pinned.has(row.id)).sort(byName)
    const rest = active.filter((row) => !pinned.has(row.id)).sort(byName)
    return [...top, ...rest].filter((row) => matchesChild(row, query))
  }, [registrations.data, hidden, pinned, query])

  return (
    <View style={styles.stack}>
      <SearchField value={query} onChange={setQuery} placeholder={t.calendar.lesson.pickerSearch} label={t.calendar.lesson.chooseChildren} />
      {registrations.isError ? (
        <LoadError message={t.calendar.lesson.pickerFailed} retryLabel={t.common.retry} onRetry={() => void registrations.refetch()} />
      ) : !registrations.data ? (
        <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <EmptyState icon="search" title={t.calendar.lesson.pickerEmpty} />
      ) : (
        <Card inset={AVATAR_INSET}>
          {list.map((child) => {
            const on = selected.has(child.id)
            const detail = describeChild(child)
            return (
              <Pressable
                key={child.id}
                onPress={() => {
                  void Haptics.selectionAsync()
                  onToggle(child, !on)
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={detail ? `${child.student_name}, ${detail}` : child.student_name}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.pressed }]}
              >
                <Avatar name={child.student_name} />
                <View style={styles.flex}>
                  <Text weight="500" numberOfLines={1}>
                    {child.student_name}
                  </Text>
                  {detail !== '' && (
                    <Text variant="sub" tone="ink3" numberOfLines={1}>
                      {detail}
                    </Text>
                  )}
                </View>
                {/* The phone's tick circle: filled in the blue when chosen, an empty ring when not */}
                <View style={[styles.tick, on ? { backgroundColor: c.fill } : { borderWidth: 1.5, borderColor: c.mute }]}>
                  {on && <Icon name="check" size={13} color={c.onFill} weight="bold" />}
                </View>
              </Pressable>
            )
          })}
        </Card>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 62 },
  flex: { flex: 1, minWidth: 0, gap: 1 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
})
