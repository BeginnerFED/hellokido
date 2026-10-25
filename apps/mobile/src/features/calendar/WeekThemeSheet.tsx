import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { saveThemes, themesBetween } from '@hellokido/core/api'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { TextField } from '../../ui/Fields'
import { ActionRow, Card, FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { weekRange } from './parts'

const MAX_LENGTH = 80

/** The theme of one week (its Monday, 'yyyy-MM-dd'). An emptied theme is removed. */
export function WeekThemeSheet({ week }: { week: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const theme = useQuery({ queryKey: keys.themes(week, week), queryFn: () => themesBetween(week, week) })
  const subtitle = weekRange(i18n, new Date(`${week}T00:00:00`))

  if (!theme.data) {
    return (
      <SheetScreen title={t.calendar.theme.label} subtitle={subtitle}>
        {theme.isError ? (
          <LoadError message={t.calendar.loadFailed} retryLabel={t.common.retry} onRetry={() => void theme.refetch()} />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={44} radius={26} />
            <Skeleton height={44} radius={26} />
          </View>
        )}
      </SheetScreen>
    )
  }
  return <ThemeForm week={week} subtitle={subtitle} current={theme.data[week]?.trim() ?? ''} />
}

function ThemeForm({ week, subtitle, current }: { week: string; subtitle: string; current: string }) {
  const { t, fmt, date } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const next = draft.trim()
  const dirty = next !== current

  const save = async (value: string) => {
    if (busy || sending.current) return
    if (value === current) return sheet.finish()
    // The return key and the bar's button can both fire before the next render
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      await saveThemes(value ? [{ week_start: week, theme: value }] : [], value ? [] : [week])
      void refresh.themes()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: value ? t.calendar.theme.saved : t.calendar.theme.removed })
      sheet.finish()
    } catch {
      setError(t.calendar.theme.saveFailed)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <SheetScreen
      title={t.calendar.theme.label}
      subtitle={subtitle}
      dirty={dirty}
      busy={busy}
      action={{ label: t.common.save, disabled: !dirty, onPress: () => void save(next) }}
    >
      <FormGroup footer={t.calendar.theme.hint}>
        <TextField
          accessibilityLabel={fmt(t.calendar.theme.editWeek, { date: date(new Date(`${week}T00:00:00`), { day: 'numeric', month: 'long' }) })}
          placeholder={t.calendar.theme.placeholder}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_LENGTH}
          autoFocus
          autoCapitalize="sentences"
          autoComplete="off"
          returnKeyType="done"
          editable={!busy}
          onSubmitEditing={() => void save(next)}
        />
      </FormGroup>
      {/* Last and on its own, as the phone's own "Delete Event" */}
      {current !== '' && (
        <Card>
          <ActionRow icon="delete" label={t.mobile.removeTheme} destructive disabled={busy} onPress={() => void save('')} />
        </Card>
      )}
      <SheetActions error={error} />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 24 }
})
