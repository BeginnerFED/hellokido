import { useCallback, useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

export type MenuItem = { label: string; icon?: IconName; onPress: () => void; destructive?: boolean }

/**
 * A short list of things to do: the iPhone's own action sheet; on Android a sheet that looks like
 * one (its alert holds three buttons at most).
 */
export function useActionMenu() {
  const c = useColors()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const [menu, setMenu] = useState<{ title?: string; message?: string; items: MenuItem[] } | null>(null)

  const open = useCallback(
    (title: string | undefined, items: MenuItem[], message?: string) => {
      if (Platform.OS === 'ios') {
        const destructive = items.findIndex((item) => item.destructive)
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title,
            message,
            options: [...items.map((item) => item.label), t.common.cancel],
            cancelButtonIndex: items.length,
            destructiveButtonIndex: destructive >= 0 ? destructive : undefined
          },
          (index) => items[index]?.onPress()
        )
      } else {
        setMenu({ title, message, items })
      }
    },
    [t]
  )

  const element =
    Platform.OS === 'ios' ? null : (
      <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setMenu(null)} accessibilityLabel={t.common.close}>
          <View style={[styles.panel, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]}>
            {(menu?.title || menu?.message) && (
              <View style={styles.title}>
                {menu.title && (
                  <Text variant="foot" weight={menu.message ? '600' : undefined} tone={menu.message ? 'ink2' : 'ink3'} align="center">
                    {menu.title}
                  </Text>
                )}
                {menu.message && (
                  <Text variant="foot" tone="ink3" align="center">
                    {menu.message}
                  </Text>
                )}
              </View>
            )}
            {menu?.items.map((item, index) => (
              <Pressable
                // Two saved messages may share a name
                key={`${index}:${item.label}`}
                accessibilityRole="button"
                onPress={() => {
                  setMenu(null)
                  item.onPress()
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.well }]}
              >
                {item.icon && <Icon name={item.icon} size={20} color={item.destructive ? c.negativeInk : c.accentInk} />}
                <Text variant="body" style={{ color: item.destructive ? c.negativeInk : c.ink }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    )

  return { open, element }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,14,20,0.4)' },
  panel: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10 },
  title: { paddingHorizontal: 20, paddingVertical: 8, gap: 2 },
  item: { minHeight: 54, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 14 }
})
