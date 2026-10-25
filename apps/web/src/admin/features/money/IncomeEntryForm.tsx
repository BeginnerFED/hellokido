import { useEffect, useMemo, useRef, useState } from 'react'
import { addIncomeEntry, updateIncomeEntry, type IncomeEntry, type PaymentMethod } from '@hellokido/core/api'
import { localDateKey } from '@hellokido/core/rules/dates.js'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { fromDateKey } from '@hellokido/core/view'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select } from '../../ui/Choice'
import { DateField } from '../../ui/DateField'
import { AmountField, TextArea, TextField } from '../../ui/Field'
import { FormRule } from '../../ui/Notice'
import { SheetActions, SheetFooter } from '../../ui/Sheet'
import { keepCaret } from '../../ui/caret'
import { amountError, PaymentFields } from './PaymentFields'

export type FormState = { dirty: boolean; busy: boolean }

type Props = {
  kind: 'child' | 'other'
  registrationId?: string | null
  entry?: IncomeEntry | null
  /** An expected entry that has now been paid: starts as received, the amount kept. */
  collect?: boolean
  onDone: () => void
  onStateChange?: (state: FormState) => void
}

/**
 * Income outside the package flow: a child's fee (materials, an event) or income of the workshop
 * (a party, a sale). An expected one keeps its amount and, if known, the day it is due.
 */
export function IncomeEntryForm({ kind, registrationId, entry, collect, onDone, onStateChange }: Props) {
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const descriptionRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const initial = useMemo(() => {
    const collecting = Boolean(collect && entry?.payment_status === 'beklemede')
    return {
      description: entry?.description ?? '',
      category: entry?.category ?? null,
      status: (entry?.payment_status === 'beklemede' && !collecting ? 'beklemede' : 'odendi') as 'odendi' | 'beklemede',
      method: entry && entry.payment_method !== 'belirlenmedi' ? (entry.payment_method as PaymentMethod) : null,
      amount: entry ? formatAmountForInput(entry.amount) : '',
      // Like every payment received, the day is picked (one tap for today): it decides the month the money counts in
      date: entry?.payment_date ? new Date(entry.payment_date) : null,
      due: fromDateKey(entry?.due_date),
      note: entry?.notes ?? ''
    }
  }, [entry, collect])

  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [status, setStatus] = useState(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [due, setDue] = useState<Date | null>(initial.due)
  const [note, setNote] = useState(initial.note)
  const [busy, setBusy] = useState(false)

  const categoryOptions = useMemo(
    () =>
      (catalog?.incomeCategories ?? [])
        .filter((row) => row.is_active || row.code === initial.category)
        .map((row) => ({ id: row.code, label: labels.incomeCategory(row.code) })),
    [catalog, initial.category, labels]
  )

  const changeStatus = (next: 'odendi' | 'beklemede') => {
    setStatus(next)
    setMethod(null)
    setDate(null)
  }

  const paid = status === 'odendi'
  const valid =
    isPositiveAmount(amount) && (kind === 'child' || Boolean(category)) && (!paid || Boolean(method && method !== 'belirlenmedi' && date))
  const dirty =
    description !== initial.description ||
    category !== initial.category ||
    status !== initial.status ||
    method !== initial.method ||
    amount !== initial.amount ||
    date?.getTime() !== initial.date?.getTime() ||
    due?.getTime() !== initial.due?.getTime() ||
    note !== initial.note
  useEffect(() => onStateChange?.({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy) return
    const value = parseAmount(amount) ?? 0
    const fields = {
      kind,
      registration_id: kind === 'child' ? (registrationId ?? entry?.registration_id ?? null) : null,
      category: kind === 'other' ? category : (entry?.category ?? null),
      description: description.trim() || null,
      amount: value,
      payment_status: status,
      payment_method: paid ? (method as PaymentMethod) : 'belirlenmedi',
      payment_date: paid && date ? date.toISOString() : null,
      due_date: paid ? (entry?.due_date ?? null) : due ? localDateKey(due) : null,
      notes: note.trim() || null
    }
    setBusy(true)
    try {
      if (entry) {
        await updateIncomeEntry(entry.id, fields)
        const nowPaid = entry.payment_status === 'beklemede' && paid
        toast({ title: nowPaid ? fmt(t.finance.entry.saved, { amount: money(value) }) : t.finance.entry.updated })
      } else {
        await addIncomeEntry(fields)
        toast({ title: fmt(paid ? t.finance.entry.saved : t.finance.entry.savedExpected, { amount: money(value) }) })
      }
      if (fields.registration_id) refresh.children(fields.registration_id)
      refresh.finance(fields.registration_id ?? undefined)
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.entry.notFound })
        refresh.finance(fields.registration_id ?? undefined)
        onDone()
        return
      }
      toast({ tone: 'error', title: t.finance.entry.failed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {kind === 'other' && (
        <Select
          label={t.finance.entry.category}
          placeholder={t.finance.entry.categoryPlaceholder}
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
      )}
      <TextField
        ref={descriptionRef}
        label={t.finance.entry.description}
        placeholder={kind === 'child' ? t.finance.entry.descriptionChild : t.finance.entry.descriptionOther}
        value={description}
        onChange={(text) => keepCaret(descriptionRef.current, text, (value) => upperFirst(value) ?? '', setDescription)}
        autoComplete="off"
      />
      <FormRule />
      <Segmented
        label={t.finance.entry.status}
        options={[
          { id: 'odendi', label: t.finance.entry.paid },
          { id: 'beklemede', label: t.finance.entry.expected }
        ]}
        value={status}
        onChange={changeStatus}
      />
      {paid ? (
        <PaymentFields method={method} onMethod={setMethod} amount={amount} onAmount={setAmount} date={date} onDate={setDate} />
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <AmountField
            label={t.finance.entry.expectedAmount}
            value={amount}
            onChange={setAmount}
            errorMessage={amountError(amount, t.common.amountInvalid)}
          />
          <DateField label={t.finance.entry.dueDate} value={due} onChange={setDue} description={t.finance.entry.dueHelp} />
        </div>
      )}
      <TextArea
        ref={noteRef}
        label={t.finance.entry.note}
        placeholder={t.finance.entry.notePlaceholder}
        value={note}
        onChange={(text) => keepCaret(noteRef.current, text, (value) => upperFirst(value) ?? '', setNote)}
        rows={2}
      />
      <SheetFooter>
        <SheetActions>
          <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={save} className="max-md:flex-1">
            {t.finance.entry.save}
          </Button>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}
