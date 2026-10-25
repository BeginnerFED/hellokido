import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { startOfDay } from 'date-fns'
import { updateSetting } from '@hellokido/core/api'
import { cycleOf, parseStartDay } from '@hellokido/core/view'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { choosePeriod, periodName } from '../finance/period'
import type { FormState } from '../payment/fields'

const IDLE: FormState = { dirty: false, busy: false }

/** The day money periods start on ("10'undan 10'una"); Finance opens on the period that holds today. */
export function PeriodStartSheet() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const [state, setState] = useState(IDLE)
  const saved = catalog.data?.settings.moneyPeriodStartDay

  return (
    <SheetScreen title={t.settings.period.title} dirty={state.dirty} busy={state.busy}>
      {saved === undefined ? (
        catalog.isError ? (
          <EmptyState
            icon="info"
            title={t.common.loadFailed}
            action={
              <Button size="sm" icon="refresh" busy={catalog.isFetching} onPress={() => void catalog.refetch()}>
                {t.common.retry}
              </Button>
            }
          />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={50} radius={13} />
          </View>
        )
      ) : (
        <PeriodForm saved={saved} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

function PeriodForm({ saved, onStateChange }: { saved: number; onStateChange: (state: FormState) => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const [initial] = useState(() => String(saved))
  const [input, setInput] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const day = parseStartDay(input)
  const changed = day !== null && day !== saved
  const dirty = input !== initial
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!changed || busy || day === null) return
    setBusy(true)
    setError(null)
    try {
      await updateSetting('money_period_start_day', day)
      await refresh.catalog()
      // Finance moves to the period that holds today under the new start day
      choosePeriod(null)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.settings.period.saved })
      sheet.finish()
    } catch {
      void refresh.catalog()
      setError(t.settings.period.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Text variant="foot" tone="ink2" style={styles.lead}>
        {t.settings.period.body}
      </Text>
      <View>
        <TextField
          label={t.settings.period.day}
          value={input}
          onChangeText={(text) => setInput(text.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="off"
          // An empty box is a day being retyped, not a mistake yet; saving waits for it either way
          error={day === null && input !== '' ? t.settings.period.invalid : undefined}
        />
        <Text variant="foot" tone="ink3" style={styles.hint}>
          {t.settings.period.hint}
        </Text>
      </View>
      {day !== null && <Notice>{fmt(t.settings.period.example, { period: periodName(i18n, cycleOf(startOfDay(new Date()), day)) })}</Notice>}
      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!changed} busy={busy} onPress={() => void save()}>
          {t.common.save}
        </Button>
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  lead: { paddingHorizontal: 2, marginBottom: -6 },
  hint: { marginTop: 6, paddingHorizontal: 2 }
})
