import { useCallback, useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, SlideInDown, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../providers/I18n'
import { useColors } from '../theme/colors'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

export type MenuItem = { label: string; icon?: IconName; onPress: () => void; destructive?: boolean }

type Menu = { title?: string; message?: string; items: MenuItem[] }

/**
 * A short list of things to do: the iPhone's own action sheet; on Android a sheet that looks like
 * one (its alert holds three buttons at most).
 */
export function useActionMenu() {
  const c = useColors()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const still = useReducedMotion()
  // The words stay while the sheet fades out; only `shown` decides whether it is on screen
  const [menu, setMenu] = useState<Menu | null>(null)
  const [shown, setShown] = useState(false)

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
            destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
            // The app's blue instead of the system's
            tintColor: c.accentInk
          },
          (index) => items[index]?.onPress()
        )
      } else {
        setMenu({ title, message, items })
        setShown(true)
      }
    },
    [t, c]
  )

  const close = () => setShown(false)

  const element =
    Platform.OS === 'ios' ? null : (
      <Modal visible={shown} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.backdrop}>
          {/* Behind the panel, so a tap on the panel's title never closes it */}
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <Animated.View
            entering={still ? undefined : SlideInDown.duration(280).easing(Easing.out(Easing.exp))}
            style={[styles.panel, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]}
          >
            {(menu?.title || menu?.message) && (
              <View style={[styles.title, { borderBottomColor: c.line2 }]}>
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
                  close()
                  item.onPress()
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.pressed }]}
              >
                {item.icon && <Icon name={item.icon} size={20} color={item.destructive ? c.negativeInk : c.accentInk} />}
                <Text variant="body" style={[styles.label, { color: item.destructive ? c.negativeInk : c.ink }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Modal>
    )

  return { open, element }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,14,20,0.4)' },
  panel: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10 },
  title: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, marginBottom: 4, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { minHeight: 54, paddingHorizontal: 22, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { flex: 1, minWidth: 0 }
})
