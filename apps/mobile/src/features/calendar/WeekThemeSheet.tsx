import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { saveThemes, themesBetween } from '@hellokido/core/api'
import { keys, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import type { FormState } from '../payment/fields'
import { weekRange } from './parts'

const MAX_LENGTH = 80
const IDLE: FormState = { dirty: false, busy: false }

/** The theme of one week (its Monday, 'yyyy-MM-dd'). An emptied theme is removed. */
export function WeekThemeSheet({ week }: { week: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const [state, setState] = useState(IDLE)
  const theme = useQuery({ queryKey: keys.themes(week, week), queryFn: () => themesBetween(week, week) })

  return (
    <SheetScreen title={t.calendar.theme.label} subtitle={weekRange(i18n, new Date(`${week}T00:00:00`))} dirty={state.dirty} busy={state.busy}>
      {theme.isError ? (
        <LoadError message={t.calendar.loadFailed} retryLabel={t.common.retry} onRetry={() => void theme.refetch()} />
      ) : !theme.data ? (
        <View style={styles.stack}>
          <Skeleton height={50} radius={13} />
          <Skeleton height={50} radius={14} />
        </View>
      ) : (
        <ThemeForm week={week} current={theme.data[week]?.trim() ?? ''} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

function ThemeForm({ week, current, onStateChange }: { week: string; current: string; onStateChange: (state: FormState) => void }) {
  const { t, fmt, date } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = draft.trim()
  const dirty = next !== current
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async (value: string) => {
    if (busy) return
    if (value === current) return sheet.finish()
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
      setBusy(false)
    }
  }

  return (
    <>
      <View>
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
        <Text variant="foot" tone="ink3" style={styles.hint}>
          {t.calendar.theme.hint}
        </Text>
      </View>
      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!dirty} busy={busy} onPress={() => void save(next)}>
          {t.common.save}
        </Button>
        {current !== '' && (
          <Button variant="danger" size="md" icon="delete" disabled={busy} onPress={() => void save('')}>
            {t.mobile.removeTheme}
          </Button>
        )}
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  hint: { marginTop: 8, paddingHorizontal: 2 }
})
