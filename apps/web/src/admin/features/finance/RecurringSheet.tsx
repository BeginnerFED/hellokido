import { useEffect, useMemo, useRef, useState } from 'react'
import { TrashIcon } from '@phosphor-icons/react'
import { deleteRecurring, saveRecurring, type PaymentMethod, type RecurringExpense } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select, Switch } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { AmountField, TextField } from '../../ui/Field'
import { FormRule } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { keepCaret } from '../../ui/caret'
import { amountError, METHODS } from '../money/PaymentFields'

type FormState = { dirty: boolean; busy: boolean }

/** A monthly expense (rent, a salary, a bill): set once, then recorded with one tap each month. */
export function RecurringSheet({ isOpen, onOpenChange, template }: { isOpen: boolean; onOpenChange: (open: boolean) => void; template: RecurringExpense | null }) {
  const { t } = useI18n()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={template ? t.finance.template.editTitle : t.finance.template.newTitle}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <RecurringForm template={template} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}

function RecurringForm({ template, onDone, onStateChange }: { template: RecurringExpense | null; onDone: () => void; onStateChange: (state: FormState) => void }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const nameRef = useRef<HTMLInputElement>(null)

  const initial = useMemo(
    () => ({
      title: template?.title ?? '',
      category: template?.expense_type ?? null,
      amount: template?.amount != null ? formatAmountForInput(template.amount) : '',
      method: (template?.payment_method ?? null) as PaymentMethod | null,
      day: template?.day_of_month ?? new Date().getDate(),
      active: template?.is_active ?? true
    }),
    [template]
  )
  const [title, setTitle] = useState(initial.title)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [day, setDay] = useState(initial.day)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const categoryOptions = useMemo(
    () =>
      (catalog?.expenseCategories ?? [])
        .filter((row) => row.is_active || row.code === initial.category)
        .map((row) => ({ id: row.code, label: labels.expenseCategory(row.code) })),
    [catalog, initial.category, labels]
  )

  // The amount may stay empty (a bill that changes); anything typed must be a real amount
  const valid = Boolean(title.trim() && category && method) && (!amount.trim() || isPositiveAmount(amount))
  const dirty =
    title !== initial.title ||
    category !== initial.category ||
    amount !== initial.amount ||
    method !== initial.method ||
    day !== initial.day ||
    active !== initial.active
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy || !category || !method || (template && !dirty)) return
    setBusy(true)
    try {
      await saveRecurring(template?.id ?? null, {
        title: title.trim(),
        expense_type: category,
        amount: amount.trim() ? parseAmount(amount) : null,
        payment_method: method,
        day_of_month: day,
        notes: template?.notes ?? null,
        is_active: active
      })
      toast({ tone: 'success', title: t.finance.template.saved })
      refresh.finance()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.template.notFound })
        refresh.finance()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.finance.template.failed })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!template) return
    setBusy(true)
    try {
      await deleteRecurring(template.id)
      setConfirming(false)
      toast({ tone: 'success', title: t.finance.monthly.deleted })
      refresh.finance()
      onDone()
    } catch {
      toast({ tone: 'error', title: t.finance.monthly.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        ref={nameRef}
        label={t.finance.template.name}
        placeholder={t.finance.template.namePlaceholder}
        value={title}
        onChange={(text) => keepCaret(nameRef.current, text, (value) => upperFirst(value) ?? '', setTitle)}
        autoComplete="off"
      />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Select
          label={t.finance.expense.category}
          placeholder={t.finance.expense.categoryPlaceholder}
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
        <AmountField
          label={t.finance.template.amount}
          value={amount}
          onChange={setAmount}
          description={t.finance.template.amountHint}
          errorMessage={amountError(amount, t.common.amountInvalid)}
        />
      </div>
      <Segmented<PaymentMethod>
        label={t.finance.expense.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method}
        onChange={setMethod}
      />
      <Stepper
        label={t.finance.template.day}
        value={day}
        onChange={setDay}
        min={1}
        max={31}
        decreaseLabel={t.finance.template.earlier}
        increaseLabel={t.finance.template.later}
        description={day >= 29 ? t.finance.template.dayHint : undefined}
      />
      {template && (
        <>
          <FormRule />
          <div className="flex flex-col gap-1">
            <Switch isSelected={active} onChange={setActive}>
              {t.finance.template.active}
            </Switch>
            <p className="text-[0.8125rem] text-ink-3">{t.finance.template.activeHint}</p>
          </div>
        </>
      )}
      <SheetFooter>
        <SheetActions
          start={
            template && (
              <Button variant="danger-soft" icon={<TrashIcon aria-hidden className="size-4" />} onPress={() => setConfirming(true)} isDisabled={busy}>
                {t.finance.template.delete}
              </Button>
            )
          }
        >
          {/* An edit has nothing to save until something changed */}
          <Button variant="primary" isDisabled={!valid || (template !== null && !dirty)} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.common.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t.finance.monthly.deleteTitle}
        body={t.finance.monthly.deleteBody}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
