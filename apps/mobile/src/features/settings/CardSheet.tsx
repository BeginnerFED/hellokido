import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { updateSetting } from '@hellokido/core/api'
import { arrivalOf, parseDays, parseRate, rateText } from '@hellokido/core/view'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'

// A round amount, so the example shows whole liras for any rate with two decimals
const EXAMPLE_AMOUNT = 10_000

type Saved = { cardSettlementDays: number; cardCommissionRate: number }

/** How long card money takes to reach the bank and what the bank keeps; Finance's "on its way" uses both. */
export function CardSheet() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const saved = catalog.data?.settings

  if (saved) return <CardForm saved={saved} />
  return (
    <SheetScreen title={t.settings.card.title}>
      {catalog.isError ? (
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
        <ListSkeleton rows={2} />
      )}
    </SheetScreen>
  )
}

function CardForm({ saved }: { saved: Saved }) {
  const { t, fmt, money, date, locale } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const copy = t.settings.card

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

  const save = async () => {
    if (!changed || busy || days === null || rate === null) return
    setBusy(true)
    setError(null)
    try {
      if (days !== saved.cardSettlementDays) await updateSetting('card_settlement_days', days)
      if (rate !== saved.cardCommissionRate) await updateSetting('card_commission_rate', rate)
      await refresh.catalog()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: copy.saved })
      sheet.finish()
    } catch {
      void refresh.catalog()
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // What the two numbers mean for a payment taken today, worked out the way Finance does it
  const example =
    days !== null && rate !== null
      ? fmt(copy.example, {
          amount: money(EXAMPLE_AMOUNT),
          date: date(arrivalOf(new Date().toISOString(), days), { day: 'numeric', month: 'long' }),
          net: money((EXAMPLE_AMOUNT / 100) * (100 - rate))
        })
      : null

  return (
    <SheetScreen title={copy.title} dirty={dirty} busy={busy} action={{ label: t.common.save, disabled: !changed, onPress: () => void save() }}>
      <FormGroup
        footer={
          // What the settings are for, then what they mean for a payment taken today
          <View style={styles.footer}>
            <Text variant="foot" tone="ink3">
              {copy.body}
            </Text>
            {example && (
              <Text variant="foot" tone="ink2">
                {example}
              </Text>
            )}
          </View>
        }
      >
        <TextField
          label={copy.days}
          value={daysInput}
          onChangeText={(text) => setDaysInput(text.replace(/\D/g, '').slice(0, 3))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="off"
          suffix={copy.daysUnit}
          // An empty box is a number being retyped, not a mistake yet; saving waits for it either way
          error={days === null && daysInput !== '' ? copy.daysInvalid : undefined}
        />
        <TextField
          label={copy.commission}
          value={rateInput}
          onChangeText={(text) => setRateInput(text.replace(/[^\d.,]/g, '').slice(0, 5))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoComplete="off"
          placeholder={copy.commissionPlaceholder}
          suffix="%"
          hint={copy.commissionHint}
          error={rate === null ? copy.commissionInvalid : undefined}
        />
      </FormGroup>
      <SheetActions error={error} />
    </SheetScreen>
  )
}

const styles = StyleSheet.create({
  footer: { gap: 6 }
})
