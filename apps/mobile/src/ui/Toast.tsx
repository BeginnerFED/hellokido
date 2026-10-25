import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../theme/colors'
import { Icon } from './Icon'
import { Text } from './Text'

type Tone = 'success' | 'info' | 'warning' | 'error'
/** One thing to do about what just happened, such as undoing it. */
type ToastAction = { label: string; onPress: () => void }
type Toast = { id: number; title: string; body?: string; tone: Tone; action?: ToastAction }
type Show = (toast: { title: string; body?: string; tone?: Tone; action?: ToastAction }) => void

const ToastContext = createContext<Show | null>(null)

/**
 * Short confirmations ("Saved") at the top of the screen. Errors inside an open sheet are shown in
 * the sheet itself: a sheet sits above everything drawn here.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback<Show>(({ title, body, tone = 'success', action }) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: Date.now(), title, body, tone, action })
    AccessibilityInfo.announceForAccessibility(body ? `${title}. ${body}` : title)
    // A toast that offers an undo waits long enough to be read and tapped
    timer.current = setTimeout(() => setToast(null), action ? 7000 : tone === 'error' || tone === 'warning' ? 5000 : 2600)
  }, [])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const still = useReducedMotion()
  const icon = toast.tone === 'success' ? 'checkCircle' : toast.tone === 'info' ? 'info' : 'warning'
  const iconColor = toast.tone === 'success' ? c.positive : toast.tone === 'error' ? c.negative : toast.tone === 'warning' ? c.action : c.accent
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6, alignItems: 'center' }]}>
      <Animated.View entering={still ? undefined : FadeInUp.duration(220)} exiting={still ? undefined : FadeOutUp.duration(180)}>
        <Pressable
          onPress={onDismiss}
          // With an undo inside, the toast is not one element, so a screen reader can still reach the button
          accessible={!toast.action}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { backgroundColor: c.raised, boxShadow: c.floatShadow }]}
        >
          <Icon name={icon} size={20} color={iconColor} />
          <View style={styles.words}>
            <Text weight="500" style={styles.title}>
              {toast.title}
            </Text>
            {toast.body && (
              <Text variant="sub" tone="ink2">
                {toast.body}
              </Text>
            )}
          </View>
          {toast.action && (
            <Pressable
              onPress={() => {
                onDismiss()
                toast.action?.onPress()
              }}
              accessibilityRole="button"
              hitSlop={10}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
            >
              <Text weight="600" tone="accentInk" style={styles.title}>
                {toast.action.label}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Animated.View>
    </View>
  )
}

export function useToast(): Show {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside ToastProvider')
  return show
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    maxWidth: 360,
    marginHorizontal: 16,
    paddingLeft: 13,
    paddingRight: 16,
    paddingVertical: 11,
    // It floats over the page: the only kind of thing that casts a shadow here
    borderRadius: 22
  },
  words: { flexShrink: 1 },
  title: { fontSize: 15, lineHeight: 20 },
  action: { marginLeft: 6, paddingVertical: 2 }
})
