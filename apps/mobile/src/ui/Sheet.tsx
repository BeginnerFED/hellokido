import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router, usePreventRemove } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../providers/I18n'
import type { Colors } from '../theme/colors'
import { useColors } from '../theme/colors'
import { IconButton } from './Button'
import { OfflineNotice } from './OfflineNotice'
import { Text } from './Text'

/** Every task opens as the phone's own sheet over the page it was started from. */
export function sheetOptions(c: Colors) {
  return {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: [1],
    sheetGrabberVisible: true,
    sheetCornerRadius: 22,
    contentStyle: { backgroundColor: c.ground }
  }
}

type SheetValue = {
  /** Closes the sheet after a save: typed work is saved, so nothing is asked. */
  finish: () => void
}

const SheetContext = createContext<SheetValue | null>(null)

export function useSheet(): SheetValue {
  const value = useContext(SheetContext)
  if (!value) throw new Error('useSheet must be used inside SheetScreen')
  return value
}

/** The sheet for a form that draws SheetScreen itself, so its own buttons can still close it after a save. */
export function WithSheet({ children }: { children: (sheet: SheetValue) => ReactNode }) {
  return <>{children(useSheet())}</>
}

type Props = {
  title: string
  /** Who or what the sheet is about, under the title. */
  subtitle?: ReactNode
  children: ReactNode
  /** Something typed in and not saved: closing asks first. */
  dirty?: boolean
  /** Saving: the sheet stays until the answer is back. */
  busy?: boolean
  /** A step back inside the sheet (the payment's child and choice). */
  onBack?: () => void
  backLabel?: string
  /** The button of a long list to tick, kept under the list so it never scrolls away. */
  footer?: ReactNode
}

/** A task sheet: title, close, and the form, which scrolls above the keyboard. */
export function SheetScreen({ title, subtitle, children, dirty, busy, onBack, backLabel, footer }: Props) {
  const c = useColors()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  // Set once the work is saved or thrown away: from then on the sheet closes without asking
  const [released, setReleased] = useState(false)

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

  return (
    <SheetContext.Provider value={value}>
      <View style={[styles.sheet, { backgroundColor: c.ground }]}>
        <View style={[styles.header, Platform.OS === 'android' && { paddingTop: 12 }]}>
          <View style={styles.side}>
            {onBack && <IconButton icon="chevronLeft" label={backLabel ?? t.common.back} variant="well" size={32} onPress={onBack} disabled={busy} />}
          </View>
          <View style={styles.titleBlock}>
            <Text variant="headline" align="center" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {subtitle !== undefined &&
              (typeof subtitle === 'string' ? (
                <Text variant="foot" tone="ink2" align="center" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : (
                subtitle
              ))}
          </View>
          <View style={[styles.side, styles.end]}>
            <IconButton icon="close" label={t.common.close} variant="well" size={32} onPress={close} disabled={busy} />
          </View>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.body, { paddingBottom: footer ? 24 : insets.bottom + 24 }]}
        >
          <OfflineNotice />
          {children}
        </ScrollView>
        {footer && <View style={[styles.footer, { borderTopColor: c.line, paddingBottom: insets.bottom + 12 }]}>{footer}</View>}
      </View>
    </SheetContext.Provider>
  )
}

/** The form's main button, last in the sheet: in reach of the thumb, above the keyboard when it is open. */
export function SheetActions({ children, error }: { children: ReactNode; error?: string | null }) {
  const c = useColors()
  return (
    <View style={styles.actions}>
      {error ? (
        <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.negativeWash }]}>
          <Text variant="foot" style={{ color: c.negativeInk }}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 10 },
  side: { width: 44, alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  titleBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 6, gap: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { gap: 12, marginTop: 4 },
  error: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }
})
