import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { updateSetting } from '@hellokido/core/api'
import { arrivalOf, parseDays, parseRate, rateText } from '@hellokido/core/view'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import type { FormState } from '../payment/fields'

const IDLE: FormState = { dirty: false, busy: false }
// A round amount, so the example shows whole liras for any rate with two decimals
const EXAMPLE_AMOUNT = 10_000

type Saved = { cardSettlementDays: number; cardCommissionRate: number }

/** How long card money takes to reach the bank and what the bank keeps; Finance's "on its way" uses both. */
export function CardSheet() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const [state, setState] = useState(IDLE)
  const saved = catalog.data?.settings

  return (
    <SheetScreen title={t.settings.card.title} dirty={state.dirty} busy={state.busy}>
      {!saved ? (
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
            <Skeleton height={50} radius={13} />
          </View>
        )
      ) : (
        <CardForm saved={saved} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

function CardForm({ saved, onStateChange }: { saved: Saved; onStateChange: (state: FormState) => void }) {
  const { t, fmt, money, date, locale } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()

  const [initial] = useState(() => ({ days: String(saved.cardSettlementDays), rate: rateText(saved.cardCommissionRate, locale) }))
  const [daysInput, setDaysInput] = useState(initial.days)
  const [rateInput, setRateInput] = useState(initial.rate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The saved values are always valid, so a value that does not read was typed in
  const days = parseDays(daysInput)
  const rate = parseRate(rateInput)
  const changed = days !== null && rate !== null && (days !== saved.cardSettlementDays || rate !== saved.cardCommissionRate)
  const dirty = daysInput !== initial.days || rateInput !== initial.rate
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!changed || busy || days === null || rate === null) return
    setBusy(true)
    setError(null)
    try {
      if (days !== saved.cardSettlementDays) await updateSetting('card_settlement_days', days)
      if (rate !== saved.cardCommissionRate) await updateSetting('card_commission_rate', rate)
      await refresh.catalog()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.settings.card.saved })
      sheet.finish()
    } catch {
      void refresh.catalog()
      setError(t.settings.card.failed)
    } finally {
      setBusy(false)
    }
  }

  // What the two numbers mean for a payment taken today, worked out the way Finance does it
  const example =
    days !== null && rate !== null
      ? fmt(t.settings.card.example, {
          amount: money(EXAMPLE_AMOUNT),
          date: date(arrivalOf(new Date().toISOString(), days), { day: 'numeric', month: 'long' }),
          net: money((EXAMPLE_AMOUNT / 100) * (100 - rate))
        })
      : null

  return (
    <>
      <Text variant="foot" tone="ink2" style={styles.lead}>
        {t.settings.card.body}
      </Text>
      <TextField
        label={t.settings.card.days}
        value={daysInput}
        onChangeText={(text) => setDaysInput(text.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="off"
        suffix={t.settings.card.daysUnit}
        // An empty box is a number being retyped, not a mistake yet; saving waits for it either way
        error={days === null && daysInput !== '' ? t.settings.card.daysInvalid : undefined}
      />
      <View>
        <TextField
          label={t.settings.card.commission}
          value={rateInput}
          onChangeText={(text) => setRateInput(text.replace(/[^\d.,]/g, '').slice(0, 5))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t.settings.card.commissionPlaceholder}
          suffix="%"
          error={rate === null ? t.settings.card.commissionInvalid : undefined}
        />
        <Text variant="foot" tone="ink3" style={styles.hint}>
          {t.settings.card.commissionHint}
        </Text>
      </View>
      {example && <Notice>{example}</Notice>}
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
