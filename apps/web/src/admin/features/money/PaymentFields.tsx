import { Button as AriaButton } from 'react-aria-components'
import type { PaymentMethod } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount } from '@hellokido/core/rules/money.js'
import { useI18n } from '../../providers/I18n'
import { Segmented } from '../../ui/Choice'
import { DateField } from '../../ui/DateField'
import { AmountField } from '../../ui/Field'

export const METHODS: Exclude<PaymentMethod, 'belirlenmedi'>[] = ['banka', 'nakit', 'kart']

/** Amount text that is either empty or a positive amount; anything else gets a message. */
export function amountError(amount: string, message: string) {
  return amount.trim() && !isPositiveAmount(amount) ? message : undefined
}

type Props = {
  method: PaymentMethod | null
  onMethod: (method: PaymentMethod) => void
  amount: string
  onAmount: (amount: string) => void
  date: Date | null
  onDate: (date: Date | null) => void
  amountLabel?: string
  dateLabel?: string
  /** The package's usual price, offered while the amount is empty (never filled in silently). */
  suggestion?: number | null
  isDisabled?: boolean
}

/** How a received payment was made: method, amount and day. */
export function PaymentFields({ method, onMethod, amount, onAmount, date, onDate, amountLabel, dateLabel, suggestion, isDisabled }: Props) {
  const { t, fmt, money } = useI18n()
  const showSuggestion = suggestion != null && suggestion > 0 && !amount.trim()
  return (
    <div className="flex flex-col gap-4">
      <Segmented<PaymentMethod>
        label={t.finance.entry.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method === 'belirlenmedi' ? null : method}
        onChange={onMethod}
        isDisabled={isDisabled}
      />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <AmountField
            label={amountLabel ?? t.finance.entry.amount}
            value={amount}
            onChange={onAmount}
            isDisabled={isDisabled}
            errorMessage={amountError(amount, t.common.amountInvalid)}
          />
          {showSuggestion && (
            <AriaButton
              onPress={() => onAmount(formatAmountForInput(suggestion))}
              className="self-start rounded-full bg-well px-2.5 py-1 text-[0.8125rem] font-medium text-ink-2 outline-none transition-colors duration-150 data-hovered:bg-accent-wash data-hovered:text-accent-ink data-focus-visible:ring-2 data-focus-visible:ring-focus"
            >
              {fmt(t.children.form.suggestedPrice, { amount: money(suggestion) })}
            </AriaButton>
          )}
        </div>
        <DateField label={dateLabel ?? t.finance.entry.paymentDate} value={date} onChange={onDate} shortcuts isDisabled={isDisabled} />
      </div>
    </div>
  )
}
