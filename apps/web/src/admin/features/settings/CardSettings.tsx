import { useState } from 'react'
import { updateSetting } from '@hellokido/core/api'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { arrivalOf } from '../finance/OnTheWay'
import { parseDays, parseRate, rateText } from './rules'

// A round amount, so the example shows whole liras for any rate with two decimals
const EXAMPLE_AMOUNT = 10_000

/** How long card money takes to reach the bank and what the bank keeps; Finance's "on its way" uses both. */
export function CardSettings() {
  const { t, fmt, money, date, locale } = useI18n()
  const catalog = useCatalog()
  const refresh = useRefresh()
  const toast = useToast()
  // null: the field shows the saved value; typing makes a draft until it is saved
  const [daysDraft, setDaysDraft] = useState<string | null>(null)
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const saved = catalog.data?.settings
  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!saved) return <Skeleton className="h-[7.5rem]" />

  const daysInput = daysDraft ?? String(saved.cardSettlementDays)
  const rateInput = rateDraft ?? rateText(saved.cardCommissionRate, locale)
  const days = parseDays(daysInput)
  const rate = parseRate(rateInput)
  const changed = days !== null && rate !== null && (days !== saved.cardSettlementDays || rate !== saved.cardCommissionRate)

  const save = async () => {
    if (!changed || busy || days === null || rate === null) return
    setBusy(true)
    try {
      if (days !== saved.cardSettlementDays) await updateSetting('card_settlement_days', days)
      if (rate !== saved.cardCommissionRate) await updateSetting('card_commission_rate', rate)
      await refresh.catalog()
      setDaysDraft(null)
      setRateDraft(null)
      toast({ tone: 'success', title: t.settings.card.saved })
    } catch {
      void refresh.catalog()
      toast({ tone: 'error', title: t.settings.card.failed })
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
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          label={t.settings.card.days}
          value={daysInput}
          onChange={(text) => setDaysDraft(text.replace(/\D/g, '').slice(0, 3))}
          inputMode="numeric"
          autoComplete="off"
          suffix={t.settings.card.daysUnit}
          inputClassName="tabular"
          errorMessage={daysDraft !== null && days === null ? t.settings.card.daysInvalid : undefined}
        />
        <TextField
          label={t.settings.card.commission}
          value={rateInput}
          onChange={(text) => setRateDraft(text.replace(/[^\d.,]/g, '').slice(0, 5))}
          inputMode="decimal"
          autoComplete="off"
          placeholder={t.settings.card.commissionPlaceholder}
          suffix="%"
          inputClassName="tabular"
          description={t.settings.card.commissionHint}
          errorMessage={rateDraft !== null && rate === null ? t.settings.card.commissionInvalid : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {example && <p className="min-w-0 flex-1 basis-[18rem] text-sm text-ink-2 text-pretty">{example}</p>}
        {/* Turns blue once there is something to save */}
        <Button variant={changed ? 'primary' : 'secondary'} isDisabled={!changed} isPending={busy} onPress={() => void save()}>
          {t.common.save}
        </Button>
      </div>
    </div>
  )
}
