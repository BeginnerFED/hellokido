import { useCallback, useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, SlideInDown, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../providers/I18n'
import { tint, useColors } from '../theme/colors'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'

/** `selected` marks the current choice when the menu picks a value (SelectField). */
export type MenuItem = { label: string; icon?: IconName; onPress: () => void; destructive?: boolean; selected?: boolean }

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
            // The system sheet holds words only, so the current choice carries its tick in the words
            options: [...items.map((item) => (item.selected ? `✓ ${item.label}` : item.label)), t.common.cancel],
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
        <View style={[styles.backdrop, { backgroundColor: tint(c.scrim, 0.4) }]}>
          {/* Behind the panel, so a tap on the panel's title never closes it */}
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <Animated.View
            entering={still ? undefined : SlideInDown.duration(280).easing(Easing.out(Easing.exp))}
            style={[styles.panel, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 8 }]}
          >
            {(menu?.title || menu?.message) && (
              <View style={[styles.title, { borderBottomColor: c.line }]}>
                {menu.title && (
                  <Text variant="sub" weight={menu.message ? '600' : undefined} tone={menu.message ? 'ink2' : 'ink3'} align="center">
                    {menu.title}
                  </Text>
                )}
                {menu.message && (
                  <Text variant="sub" tone="ink3" align="center">
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
                accessibilityState={{ selected: Boolean(item.selected) }}
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
                {item.selected && <Icon name="check" size={18} color={c.accentInk} weight="semibold" />}
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Modal>
    )

  return { open, element }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10 },
  title: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, marginBottom: 4, gap: 2, borderBottomWidth: 1 },
  item: { minHeight: 54, paddingHorizontal: 22, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { flex: 1, minWidth: 0 }
})
