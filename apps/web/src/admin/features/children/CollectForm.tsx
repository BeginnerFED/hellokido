import { useEffect, useState } from 'react'
import {
  registrationError,
  updateIncomeEntry,
  updateRegistration,
  type IncomeEntry,
  type PaymentMethod,
  type Registration
} from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { SheetActions, SheetFooter } from '../../ui/Sheet'
import { PaymentFields } from '../money/PaymentFields'
import type { FormState } from './ExtendForm'
import { usePackagePrice } from './packageOptions'

type Props = {
  registration: Registration
  /** A pending fee of this child; without one the current period's payment is collected. */
  entry?: IncomeEntry | null
  onDone: () => void
  onStateChange?: (state: FormState) => void
}

/** Marks a due payment as received: the period's own payment, or an expected fee. */
export function CollectForm({ registration, entry, onDone, onStateChange }: Props) {
  const { t, fmt, money } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const price = usePackagePrice(entry ? null : registration.package_type)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [amount, setAmount] = useState(entry ? formatAmountForInput(entry.amount) : '')
  const [date, setDate] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = Boolean(method && isPositiveAmount(amount) && date)
  const dirty = method !== null || date !== null || amount !== (entry ? formatAmountForInput(entry.amount) : '')
  useEffect(() => onStateChange?.({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy || !method || !date) return
    const value = parseAmount(amount) ?? 0
    setBusy(true)
    try {
      if (entry) {
        await updateIncomeEntry(entry.id, { payment_status: 'odendi', payment_method: method, payment_date: date.toISOString(), amount: value })
      } else {
        await updateRegistration(registration.id, registration.updated_at as string, {
          payment_status: 'odendi',
          payment_method: method,
          payment_amount: value,
          payment_date: date.toISOString()
        })
      }
      toast({ title: fmt(t.children.collect.saved, { amount: money(value) }) })
      refresh.children(registration.id)
      onDone()
    } catch (error) {
      const kind = entry ? (String((error as Error)?.message).includes('not_found') ? 'stale' : 'other') : registrationError(error)
      if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: entry ? t.finance.entry.notFound : t.children.form.stale })
        refresh.children(registration.id)
        onDone()
        return
      }
      toast({ tone: 'error', title: t.children.form.updateFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PaymentFields
        method={method}
        onMethod={setMethod}
        amount={amount}
        onAmount={setAmount}
        date={date}
        onDate={setDate}
        suggestion={price}
      />
      <SheetFooter>
        <SheetActions>
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={save} className="max-md:flex-1">
            {t.children.collect.save}
          </Button>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}
