import { useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { startOfDay } from 'date-fns'
import {
  addExpense,
  deleteExpense,
  deleteRecurring,
  getExpense,
  listRecurring,
  saveRecurring,
  updateExpense,
  type Expense,
  type PaymentMethod,
  type RecurringExpense
} from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { keys, useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { AmountField, Chip, DateField, FieldLabel, Segmented, SwitchField, TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { amountError, METHODS, type FormState } from '../payment/fields'

export type ExpenseParams = {
  /** An expense to correct. */
  id?: string
  /** A monthly expense whose amount changes: the form comes filled in except for the amount. */
  templateId?: string
  /** The day it is for (ISO), when it is not today. */
  day?: string
}

const IDLE: FormState = { dirty: false, busy: false }

export function ExpenseSheet({ params }: { params: ExpenseParams }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  const expense = useQuery({ queryKey: keys.finance('expense', params.id ?? ''), queryFn: () => getExpense(params.id!), enabled: Boolean(params.id), gcTime: 0 })
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring, enabled: Boolean(params.templateId) })
  const template = params.templateId ? (templates.data?.find((row) => row.id === params.templateId) ?? null) : null
  const waiting = (Boolean(params.id) && expense.isPending) || (Boolean(params.templateId) && templates.isPending)
  const missing = Boolean(params.id) && !waiting && !expense.data

  return (
    <SheetScreen
      title={params.id ? t.finance.expense.editTitle : t.finance.expense.newTitle}
      subtitle={template ? `${t.finance.expense.fromMonthly}: ${template.title}` : undefined}
      dirty={state.dirty}
      busy={state.busy}
    >
      {waiting ? (
        <View style={styles.stack}>
          <Skeleton height={50} radius={13} />
          <Skeleton height={96} radius={13} />
          <Skeleton height={50} radius={13} />
        </View>
      ) : missing ? (
        <EmptyState icon="info" title={t.finance.expense.notFound} />
      ) : (
        <ExpenseForm expense={expense.data ?? null} template={template} day={params.day} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

type FormProps = { expense: Expense | null; template: RecurringExpense | null; day?: string; onStateChange: (state: FormState) => void }

function ExpenseForm({ expense, template, day: dayParam, onStateChange }: FormProps) {
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()

  // A new expense starts on today each time the sheet opens; the time of day is kept for the order of the list
  const [initial] = useState(() => {
    const base = expense?.expense_date ? new Date(expense.expense_date) : dayParam ? new Date(dayParam) : new Date()
    return {
      base,
      title: expense?.description ?? template?.title ?? '',
      category: expense?.expense_type ?? template?.expense_type ?? null,
      amount: expense ? formatAmountForInput(expense.amount) : template?.amount != null ? formatAmountForInput(template.amount) : '',
      method: (expense?.payment_method ?? template?.payment_method ?? null) as PaymentMethod | null,
      day: startOfDay(base),
      note: expense?.notes ?? ''
    }
  })

  const [title, setTitle] = useState(initial.title)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [day, setDay] = useState<Date | null>(initial.day)
  const [note, setNote] = useState(initial.note)
  const [repeat, setRepeat] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(
    () => (catalog?.expenseCategories ?? []).filter((row) => row.is_active || row.code === initial.category).map((row) => ({ id: row.code, label: labels.expenseCategory(row.code) })),
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

  const save = async () => {
    if (!valid || busy || !category || !method || !day) return
    const value = parseAmount(amount) ?? 0
    const when = new Date(day)
    when.setHours(initial.base.getHours(), initial.base.getMinutes(), initial.base.getSeconds(), initial.base.getMilliseconds())
    const fields = {
      description: title.trim(),
      expense_type: category,
      amount: value,
      payment_method: method,
      notes: note.trim() || null,
      expense_date: when.toISOString()
    }
    // Users who did not see a saved expense in the list entered it twice, so the message says where it went
    const body = fmt(t.finance.expense.savedBody, { date: date(when, { day: 'numeric', month: 'long' }), amount: money(value) })
    setBusy(true)
    setError(null)
    let createdTemplate: string | null = null
    try {
      if (expense) {
        await updateExpense(expense.id, { ...fields, updated_at: new Date().toISOString() })
        toast({ title: t.finance.expense.updated, body })
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
        toast(repeatFailed ? { tone: 'warning', title: t.finance.expense.repeatFailed } : { title: t.finance.expense.saved, body })
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refresh.finance()
      sheet.finish()
    } catch (caught) {
      // Nothing half-made stays behind: a new monthly entry goes again if its first expense failed
      if (createdTemplate) void deleteRecurring(createdTemplate).catch(() => undefined)
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.expense.notFound })
        refresh.finance()
        sheet.finish()
        return
      }
      setError(t.finance.expense.failed)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!expense) return
    Alert.alert(
      t.finance.expense.deleteTitle,
      fmt(t.finance.expense.deleteBody, { title: expense.description || labels.expenseCategory(expense.expense_type), amount: money(expense.amount) }),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            setError(null)
            try {
              const found = await deleteExpense(expense.id)
              toast(found ? { title: t.finance.expense.deleted } : { tone: 'warning', title: t.finance.expense.notFound })
              refresh.finance()
              sheet.finish()
            } catch {
              setError(t.finance.expense.deleteFailed)
            } finally {
              setBusy(false)
            }
          }
        }
      ]
    )
  }

  return (
    <>
      <TextField
        label={t.finance.expense.what}
        placeholder={t.finance.expense.whatPlaceholder}
        value={title}
        onChangeText={(text) => setTitle(upperFirst(text) ?? '')}
        autoComplete="off"
        returnKeyType="next"
      />
      <View>
        <FieldLabel>{t.finance.expense.category}</FieldLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.finance.expense.category} style={styles.chips}>
          {categories.length === 0
            ? [0, 1, 2, 3, 4].map((key) => <Skeleton key={key} width={84} height={38} radius={19} />)
            : categories.map((option) => (
                <Chip key={option.id} label={option.label} selected={category === option.id} onPress={() => setCategory(option.id)} />
              ))}
        </View>
      </View>
      <AmountField label={t.finance.expense.amount} value={amount} onChange={setAmount} error={amountError(amount, t.common.amountInvalid)} />
      <Segmented<PaymentMethod>
        label={t.finance.expense.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method}
        onChange={setMethod}
      />
      <DateField label={t.finance.expense.date} value={day} onChange={setDay} shortcuts />
      <TextField label={t.finance.expense.note} placeholder={t.finance.expense.notePlaceholder} value={note} onChangeText={(text) => setNote(upperFirst(text) ?? '')} multiline />
      {!expense && !template && (
        <SwitchField
          label={t.finance.expense.repeat}
          hint={repeat && day ? fmt(t.finance.expense.repeatHint, { day: day.getDate() }) : undefined}
          value={repeat}
          onChange={setRepeat}
        />
      )}
      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!valid} busy={busy} onPress={() => void save()}>
          {t.finance.expense.save}
        </Button>
        {expense && (
          <Button variant="danger" size="md" icon="delete" disabled={busy} onPress={remove}>
            {t.finance.expense.delete}
          </Button>
        )}
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
})
