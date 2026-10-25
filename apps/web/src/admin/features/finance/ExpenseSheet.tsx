import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { startOfDay } from 'date-fns'
import { TrashIcon } from '@phosphor-icons/react'
import {
  addExpense,
  deleteExpense,
  deleteRecurring,
  saveRecurring,
  updateExpense,
  type Expense,
  type PaymentMethod,
  type RecurringExpense
} from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { cycleOf } from '@hellokido/core/view'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select, Switch } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DateField } from '../../ui/DateField'
import { AmountField, TextArea, TextField } from '../../ui/Field'
import { FormRule } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { keepCaret } from '../../ui/caret'
import { amountError, METHODS } from '../money/PaymentFields'
import { onDay } from './bits'
import type { VisibleRange } from './Moves'
import { periodParams } from './period'
import { visibleRange } from './visible'

export type ExpenseParams = {
  expense?: Expense
  /** A monthly expense whose amount changes: the form comes filled in except for the amount. */
  template?: RecurringExpense
  /** The day it is for (ISO), when it is not today. */
  day?: string
  /** The period the finance page shows, to say when a saved day is outside it. */
  visible?: VisibleRange
}

type FormState = { dirty: boolean; busy: boolean }

export function ExpenseSheet({ isOpen, onOpenChange, params }: { isOpen: boolean; onOpenChange: (open: boolean) => void; params: ExpenseParams }) {
  const { t } = useI18n()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={params.expense ? t.finance.expense.editTitle : t.finance.expense.newTitle}
      description={params.template ? `${t.finance.expense.fromMonthly}: ${params.template.title}` : undefined}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <ExpenseForm params={params} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}

function ExpenseForm({ params, onDone, onStateChange }: { params: ExpenseParams; onDone: () => void; onStateChange: (state: FormState) => void }) {
  const { expense, template } = params
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const startDay = catalog?.settings.moneyPeriodStartDay
  const toast = useToast()
  const refresh = useRefresh()
  const navigate = useNavigate()
  const titleRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // A new expense starts on today each time the form opens: a tab left open overnight offered yesterday
  const initial = useMemo(() => {
    const base = expense?.expense_date ? new Date(expense.expense_date) : params.day ? new Date(params.day) : new Date()
    return {
      base,
      title: expense?.description ?? template?.title ?? '',
      category: expense?.expense_type ?? template?.expense_type ?? null,
      amount: expense ? formatAmountForInput(expense.amount) : template?.amount != null ? formatAmountForInput(template.amount) : '',
      method: (expense?.payment_method ?? template?.payment_method ?? null) as PaymentMethod | null,
      day: startOfDay(base),
      note: expense?.notes ?? ''
    }
  }, [expense, template, params.day])

  const [title, setTitle] = useState(initial.title)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [day, setDay] = useState<Date | null>(initial.day)
  const [note, setNote] = useState(initial.note)
  const [repeat, setRepeat] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const categoryOptions = useMemo(
    () =>
      (catalog?.expenseCategories ?? [])
        .filter((row) => row.is_active || row.code === initial.category)
        .map((row) => ({ id: row.code, label: labels.expenseCategory(row.code) })),
    [catalog, initial.category, labels]
  )

  const valid = Boolean(title.trim() && category && method && day) && isPositiveAmount(amount)
  const dirty =
    title !== initial.title ||
    category !== initial.category ||
    amount !== initial.amount ||
    method !== initial.method ||
    day?.getTime() !== initial.day.getTime() ||
    note !== initial.note ||
    repeat
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  // Users who did not see a saved expense in the list entered it twice, so the message says where it went
  const tellSaved = (when: Date, value: number, edited: boolean) => {
    const visible = params.visible ?? visibleRange()
    const outside = visible ? when < new Date(visible.from) || when > new Date(visible.to) : false
    const range = periodParams(cycleOf(when, startDay ?? 1))
    toast({
      tone: 'success',
      title: edited ? t.finance.expense.updated : t.finance.expense.saved,
      body: outside
        ? fmt(t.finance.expense.outside, { date: date(when, { day: 'numeric', month: 'long', year: 'numeric' }) })
        : fmt(t.finance.expense.savedBody, { date: date(when, { day: 'numeric', month: 'long' }), amount: money(value) }),
      action: outside ? { label: t.finance.expense.showMonth, onAction: () => navigate(`/finance?from=${range.from}&to=${range.to}`) } : undefined
    })
  }

  const save = async () => {
    if (!valid || busy || !category || !method || !day) return
    const value = parseAmount(amount) ?? 0
    const when = onDay(day, initial.base)
    const fields = {
      description: title.trim(),
      expense_type: category,
      amount: value,
      payment_method: method,
      notes: note.trim() || null,
      expense_date: when.toISOString()
    }
    setBusy(true)
    let createdTemplate: string | null = null
    try {
      if (expense) {
        // A full overwrite; the database keeps updated_at itself, writing it too costs nothing
        await updateExpense(expense.id, { ...fields, updated_at: new Date().toISOString() })
        tellSaved(when, value, true)
      } else {
        let repeatFailed = false
        if (repeat && !template) {
          try {
            createdTemplate = await saveRecurring(null, {
              title: fields.description,
              expense_type: category,
              amount: value,
              payment_method: method,
              day_of_month: when.getDate(),
              notes: null,
              is_active: true
            })
          } catch {
            repeatFailed = true
          }
        }
        await addExpense({ ...fields, recurring_expense_id: template?.id ?? createdTemplate })
        if (repeatFailed) toast({ tone: 'warning', title: t.finance.expense.repeatFailed })
        else tellSaved(when, value, false)
      }
      refresh.finance()
      onDone()
    } catch (error) {
      // Nothing half-made stays behind: a new monthly entry goes again if its first expense failed
      if (createdTemplate) void deleteRecurring(createdTemplate).catch(() => undefined)
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.expense.notFound })
        refresh.finance()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.finance.expense.failed })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!expense) return
    setBusy(true)
    try {
      const found = await deleteExpense(expense.id)
      setConfirming(false)
      toast(found ? { tone: 'success', title: t.finance.expense.deleted } : { tone: 'warning', title: t.finance.expense.notFound })
      refresh.finance()
      onDone()
    } catch {
      toast({ tone: 'error', title: t.finance.expense.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField
        ref={titleRef}
        label={t.finance.expense.what}
        placeholder={t.finance.expense.whatPlaceholder}
        value={title}
        onChange={(text) => keepCaret(titleRef.current, text, (value) => upperFirst(value) ?? '', setTitle)}
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
        <AmountField label={t.finance.expense.amount} value={amount} onChange={setAmount} errorMessage={amountError(amount, t.common.amountInvalid)} />
      </div>
      <Segmented<PaymentMethod>
        label={t.finance.expense.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method}
        onChange={setMethod}
      />
      <DateField label={t.finance.expense.date} value={day} onChange={setDay} shortcuts />
      <TextArea
        ref={noteRef}
        label={t.finance.expense.note}
        placeholder={t.finance.expense.notePlaceholder}
        value={note}
        onChange={(text) => keepCaret(noteRef.current, text, (value) => upperFirst(value) ?? '', setNote)}
        rows={2}
      />
      {!expense && !template && (
        <>
          <FormRule />
          <div className="flex flex-col gap-1">
            <Switch isSelected={repeat} onChange={setRepeat}>
              {t.finance.expense.repeat}
            </Switch>
            {repeat && day && <p className="text-[0.8125rem] text-ink-3 text-pretty">{fmt(t.finance.expense.repeatHint, { day: day.getDate() })}</p>}
          </div>
        </>
      )}
      <SheetFooter>
        <SheetActions
          start={
            expense && (
              <Button variant="danger-soft" icon={<TrashIcon aria-hidden className="size-4" />} onPress={() => setConfirming(true)} isDisabled={busy}>
                {t.finance.expense.delete}
              </Button>
            )
          }
        >
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.finance.expense.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t.finance.expense.deleteTitle}
        body={expense && fmt(t.finance.expense.deleteBody, { title: expense.description || labels.expenseCategory(expense.expense_type), amount: money(expense.amount) })}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
