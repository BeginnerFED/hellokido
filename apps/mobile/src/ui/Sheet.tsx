import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Alert, BackHandler, Keyboard, LayoutAnimation, Platform, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent, type ScrollViewInstance, type ViewInstance } from 'react-native'
import { router, Stack, useNavigation, usePreventRemove, type NativeStackNavigationOptions } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../providers/I18n'
import type { Colors } from '../theme/colors'
import { useColors } from '../theme/colors'
import { fontOf } from '../theme/fonts'
import { Button, IconButton } from './Button'
import { OfflineNotice } from './OfflineNotice'
import { Text } from './Text'

/**
 * Every task opens as the phone's own modal with a real navigation bar: the iPhone's page sheet and
 * a full page that slides up on Android. The bar is the same paper as the form, with no rule under it;
 * the form's fields sit on felt cards.
 */
export function sheetOptions(c: Colors): NativeStackNavigationOptions {
  return {
    presentation: 'modal',
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: c.sheet },
    // The close and back items take the ink; only the main action is blue
    headerTintColor: c.ink,
    headerTitleStyle: { fontSize: 17, color: c.ink, ...fontOf('600') },
    contentStyle: { backgroundColor: c.sheet },
    ...(Platform.OS === 'android' ? { animation: 'slide_from_bottom' as const, headerTitleAlign: 'center' as const } : null)
  }
}

type SheetValue = {
  /** Closes the sheet after a save: typed work is saved, so nothing is asked. */
  finish: () => void
}

const SheetContext = createContext<SheetValue | null>(null)

// The sheets on screen, newest last. A form that calls useSheet() in the same component that draws
// its SheetScreen sits above the provider; it still closes the sheet it is in instead of crashing.
const openSheets: RefObject<SheetValue>[] = []

const outsideSheet: SheetValue = {
  finish: () => {
    const top = openSheets[openSheets.length - 1]
    if (top) top.current.finish()
    else router.back()
  }
}

export function useSheet(): SheetValue {
  return useContext(SheetContext) ?? outsideSheet
}

/** The sheet for a form that draws SheetScreen itself, so its own buttons can still close it after a save. */
export function WithSheet({ children }: { children: (sheet: SheetValue) => ReactNode }) {
  return <>{children(useSheet())}</>
}

/**
 * How far the keyboard reaches over a view, in points; 0 while it is closed. Measured against the
 * view itself, because a sheet does not start at the top of the screen.
 */
function useKeyboardOverlap(ref: RefObject<ViewInstance | null>, enabled: boolean) {
  const [overlap, setOverlap] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const ios = Platform.OS === 'ios'
    const settle = (event: KeyboardEvent, next: number) => {
      // The iPhone moves the keyboard on its own curve; the sheet's foot rides along with it
      if (ios && event.duration > 0) LayoutAnimation.configureNext({ duration: event.duration, update: { type: LayoutAnimation.Types.keyboard } })
      setOverlap((current) => (Math.abs(current - next) < 1 ? current : next))
    }
    const shown = (event: KeyboardEvent) => {
      const { screenY, height } = event.endCoordinates
      const view = ref.current
      if (height === 0) return settle(event, 0)
      if (!view) return settle(event, height)
      const lifted = (y: number, viewHeight: number) => settle(event, viewHeight > 0 ? Math.max(0, Math.round(y + viewHeight - screenY)) : height)
      // Android places the screen natively, so only measure() sees where it really starts on screen
      if (ios) view.measureInWindow((_x, y, _width, viewHeight) => lifted(y, viewHeight))
      else view.measure((_x, _y, _width, viewHeight, _pageX, pageY) => lifted(pageY, viewHeight))
    }
    const hidden = (event: KeyboardEvent) => settle(event, 0)
    const subscriptions = ios
      ? [Keyboard.addListener('keyboardWillChangeFrame', shown), Keyboard.addListener('keyboardWillHide', hidden)]
      : [Keyboard.addListener('keyboardDidShow', shown), Keyboard.addListener('keyboardDidHide', hidden)]
    return () => subscriptions.forEach((subscription) => subscription.remove())
  }, [ref, enabled])
  return enabled ? overlap : 0
}

/** The one main thing a form does ("Add", "Save"), at the right of the bar as in the phone's New Event. */
export type SheetAction = { label: string; onPress: () => void; disabled?: boolean }

/** What a form inside a sheet tells the sheet that draws its bar. */
export type FormState = {
  dirty: boolean
  busy: boolean
  /** Everything needed is filled in: the bar's main button can be pressed. */
  ready?: boolean
  /** Runs the form's save from the bar's main button (see useReportForm). */
  submit?: () => void
}

/**
 * Reports a form to the sheet that draws its bar: changed, saving, ready, and how to save it. The
 * save is looked up when the bar's button is pressed, so it never runs with an earlier render's values.
 */
export function useReportForm(onStateChange: (state: FormState) => void, { dirty, busy, ready }: { dirty: boolean; busy: boolean; ready: boolean }, save: () => void) {
  const latest = useRef(save)
  useEffect(() => {
    latest.current = save
  })
  const submit = useCallback(() => latest.current(), [])
  useEffect(() => onStateChange({ dirty, busy, ready, submit }), [dirty, busy, ready, submit, onStateChange])
}

/** The bar's main button for a form that reports through useReportForm; none until the form is there. */
export const formAction = (state: FormState, label: string): SheetAction | undefined =>
  state.submit ? { label, disabled: !state.ready, onPress: state.submit } : undefined

type Props = {
  title: string
  /** Who or what the sheet is about: the first line of the sheet, under the bar. */
  subtitle?: ReactNode
  children: ReactNode
  /** Something typed in and not saved: closing asks first. */
  dirty?: boolean
  /** Saving: the sheet stays until the answer is back, and its bar buttons wait. */
  busy?: boolean
  /** A step back inside the sheet (the payment's child and choice): the bar's left button goes back instead of closing. */
  onBack?: () => void
  backLabel?: string
  /** The form's main button in the bar. Messages about it stay in the form (SheetActions error). */
  action?: SheetAction
  /** The button of a long list to tick, kept under the list so it never scrolls away. */
  footer?: ReactNode
}

/** A task sheet: the title and close in the bar, and the form, which scrolls under the bar and above the keyboard. */
export function SheetScreen({ title, subtitle, children, dirty, busy, onBack, backLabel, action, footer }: Props) {
  const c = useColors()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const root = useRef<ViewInstance | null>(null)
  // Set once the work is saved or thrown away: from then on the sheet closes without asking
  const [released, setReleased] = useState(false)
  // The iPhone keeps a scrolling form above the keyboard itself. A foot outside the scroll, and
  // every sheet on Android (whose page never moves), lift by hand instead.
  const lift = Platform.OS === 'android' || footer !== undefined
  const keyboard = useKeyboardOverlap(root, lift)
  const scroller = useRef<ScrollViewInstance | null>(null)
  const scrolled = useRef(0)
  const footHeight = useRef(0)

  // Android scrolls the focused field only until it touches the keyboard; this leaves it some air
  useEffect(() => {
    if (Platform.OS !== 'android' || keyboard === 0) return
    const timer = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput()
      const sheet = root.current
      if (!input || !sheet) return
      sheet.measure((_x, _y, _width, sheetHeight, _pageX, sheetY) => {
        const visibleBottom = sheetY + sheetHeight - keyboard - footHeight.current
        input.measure((_ix, _iy, _iwidth, inputHeight, _ipageX, inputY) => {
          const short = inputY + inputHeight + 24 - visibleBottom
          if (short > 0) scroller.current?.scrollTo({ y: scrolled.current + short, animated: true })
        })
      })
    }, 80)
    return () => clearTimeout(timer)
  }, [keyboard])

  // Swiping the sheet down, Android's back or the close button never drop typed work without asking
  const disablePrevention = usePreventRemove(Boolean(dirty || busy) && !released, ({ repeat }) => {
    if (busy) return
    Alert.alert(t.common.unsavedChanges, undefined, [
      { text: t.common.keepEditing, style: 'cancel' },
      {
        text: t.common.discard,
        style: 'destructive',
        onPress: () => {
          setReleased(true)
          repeat()
        }
      }
    ])
  })

  const close = useCallback(() => router.back(), [])

  // Android's back key takes the same step back as the bar's back button (picker → form) instead of
  // offering to close the whole sheet
  const navigation = useNavigation()
  useEffect(() => {
    if (Platform.OS !== 'android' || !onBack) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false
      if (!busy) onBack()
      return true
    })
    return () => subscription.remove()
  }, [onBack, busy, navigation])
  const value = useMemo<SheetValue>(
    () => ({
      finish: () => {
        setReleased(true)
        disablePrevention()
        router.back()
      }
    }),
    [disablePrevention]
  )

  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])
  useEffect(() => {
    openSheets.push(latest)
    return () => {
      const index = openSheets.lastIndexOf(latest)
      if (index >= 0) openSheets.splice(index, 1)
    }
  }, [])

  const leave = onBack ?? close
  const leaveLabel = onBack ? (backLabel ?? t.common.back) : t.common.close
  // Every key is set each time, so a step of the sheet never keeps the buttons of the step before
  const options = useMemo<NativeStackNavigationOptions>(
    () =>
      Platform.OS === 'ios'
        ? {
            title,
            unstable_headerLeftItems: () => [
              { type: 'button', label: leaveLabel, icon: { type: 'sfSymbol', name: onBack ? 'chevron.left' : 'xmark' }, onPress: leave, disabled: busy }
            ],
            // iOS 26 draws the prominent item as a capsule in the tint with white words, like the
            // checkmark of New Event; the solid blue keeps those words readable in both themes
            unstable_headerRightItems: action
              ? () => [{ type: 'button', label: action.label, variant: 'prominent', tintColor: c.fill, onPress: action.onPress, disabled: Boolean(action.disabled || busy) }]
              : undefined
          }
        : {
            title,
            headerLeft: () => <IconButton icon={onBack ? 'chevronLeft' : 'close'} label={leaveLabel} variant="felt" size={40} color={c.ink} onPress={leave} disabled={busy} />,
            headerRight: action
              ? () => (
                  <Button variant="primary" size="sm" onPress={action.onPress} disabled={action.disabled} busy={busy}>
                    {action.label}
                  </Button>
                )
              : undefined
          },
    [title, leaveLabel, onBack, leave, busy, action, c]
  )

  // While the keyboard is up it covers the home indicator, so that space is not added twice
  const bottom = keyboard > 0 ? 0 : insets.bottom

  return (
    <SheetContext.Provider value={value}>
      <Stack.Screen options={options} />
      <View ref={root} style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: keyboard }]}>
        <ScrollView
          ref={scroller}
          style={styles.scroll}
          // The form starts under the bar and scrolls beneath it, where the system blurs its edge
          contentInsetAdjustmentBehavior="automatic"
          onScroll={(event) => {
            scrolled.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={!lift}
          contentContainerStyle={[styles.body, { paddingBottom: footer ? 24 : bottom + 24 }]}
        >
          <OfflineNotice />
          {subtitle !== undefined &&
            (typeof subtitle === 'string' ? (
              <Text variant="sub" tone="ink2" align="center" numberOfLines={2} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            ))}
          {children}
        </ScrollView>
        {footer && (
          <View
            onLayout={(event) => {
              footHeight.current = event.nativeEvent.layout.height
            }}
            style={[styles.footer, { borderTopColor: c.line, backgroundColor: c.sheet, paddingBottom: bottom + 12 }]}
          >
            {footer}
          </View>
        )}
      </View>
    </SheetContext.Provider>
  )
}

/** The form's messages and, for forms whose action is not in the bar, its main button, last in the sheet. */
export function SheetActions({ children, error }: { children?: ReactNode; error?: string | null }) {
  const c = useColors()
  if (!children && !error) return null
  return (
    <View style={styles.actions}>
      {error ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: c.felt }]}>
          <View style={[styles.errorDot, { backgroundColor: c.negative }]} />
          <Text variant="sub" style={{ color: c.negativeInk, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  subtitle: { marginBottom: -8, paddingHorizontal: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { gap: 12, marginTop: 4 },
  error: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 }
})
