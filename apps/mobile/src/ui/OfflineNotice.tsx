import { useSyncExternalStore } from 'react'
import { StyleSheet, View } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { Icon } from './Icon'
import { Text } from './Text'

const subscribe = (notify: () => void) => onlineManager.subscribe(notify)

/** Stays while the phone has no connection. Pages wait instead of failing and load again once it is back. */
export function OfflineNotice() {
  const c = useColors()
  const { t } = useI18n()
  const online = useSyncExternalStore(subscribe, () => onlineManager.isOnline())
  if (online) return null
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon name="offline" size={19} color={c.ink2} />
      <Text variant="foot" tone="ink2" style={styles.text}>
        {t.shell.offline}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 11 },
  text: { flex: 1 }
})
