import { StyleSheet, View } from 'react-native'
import { Button } from '../../ui/Button'
import type { IconName } from '../../ui/Icon'

export type QuickAction = { key: string; label: string; icon: IconName; onPress: () => void; accessibilityLabel?: string; primary?: boolean }

/**
 * The buttons under a child's name, in equal thirds: quiet felt pills ("Ara", "Mesaj") and the
 * page's one filled button ("Ödeme al").
 */
export function QuickActions({ items }: { items: QuickAction[] }) {
  if (items.length === 0) return null
  return (
    <View style={styles.quick}>
      {items.map((item) => (
        <Button
          key={item.key}
          variant={item.primary ? 'primary' : 'quiet'}
          icon={item.icon}
          onPress={item.onPress}
          accessibilityLabel={item.accessibilityLabel ?? item.label}
          style={styles.item}
        >
          {item.label}
        </Button>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: 8 },
  item: { flex: 1, minWidth: 0, paddingHorizontal: 8 }
})
