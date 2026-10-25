import { useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { deleteRecurring, listRecurring, saveRecurring, type PaymentMethod, type RecurringExpense } from '@hellokido/core/api'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { keys, useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { AmountField, Segmented, SelectField, Stepper, SwitchField, TextField } from '../../ui/Fields'
import { CardButton, FormGroup, Row } from '../../ui/Screen'
import { formAction, SheetActions, SheetScreen, useReportForm, useSheet, type FormState } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { amountError, METHODS } from '../payment/fields'

const IDLE: FormState = { dirty: false, busy: false }

/** A monthly expense (rent, a salary, a bill): set once, then recorded with one tap each month. */
export function RecurringSheet({ id }: { id?: string }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  // Read fresh when the sheet opens: the form starts from the template as it is now
  const templates = useQuery({ queryKey: [...keys.finance('recurring'), 'form', id ?? ''], queryFn: listRecurring, enabled: Boolean(id), gcTime: 0, staleTime: Infinity })
  const template = id ? (templates.data?.find((row) => row.id === id) ?? null) : null
  const waiting = Boolean(id) && templates.isPending
  const missing = Boolean(id) && !waiting && !template

  return (
    <SheetScreen
      title={id ? t.finance.template.editTitle : t.finance.template.newTitle}
      dirty={state.dirty}
      busy={state.busy}
      action={formAction(state, t.common.save)}
    >
      {waiting ? (
        <View style={styles.stack}>
          <Skeleton height={88} radius={26} />
          <Skeleton height={130} radius={26} />
          <Skeleton height={44} radius={26} />
        </View>
      ) : missing ? (
        <EmptyState
          icon="info"
          title={templates.isError ? t.common.loadFailed : t.finance.template.notFound}
          action={
            templates.isError ? (
              <Button size="sm" busy={templates.isFetching} onPress={() => void templates.refetch()}>
                {t.common.retry}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RecurringForm template={template} onStateChange={setState} />
      )}
    </SheetScreen>
  )
}

function RecurringForm({ template, onStateChange }: { template: RecurringExpense | null; onStateChange: (state: FormState) => void }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()

  const [initial] = useState(() => ({
    title: template?.title ?? '',
    category: template?.expense_type ?? null,
    amount: template?.amount != null ? formatAmountForInput(template.amount) : '',
    method: (template?.payment_method ?? null) as PaymentMethod | null,
    day: template?.day_of_month ?? new Date().getDate(),
    active: template?.is_active ?? true
  }))
  const [title, setTitle] = useState(initial.title)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [day, setDay] = useState(initial.day)
  const [active, setActive] = useState(initial.active)
  // Which button is at work, so only that one spins
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  // A second tap before the button turns busy would save twice; state comes too late to stop it
  const working = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(
    () => (catalog?.expenseCategories ?? []).filter((row) => row.is_active || row.code === initial.category).map((row) => ({ id: row.code, label: labels.expenseCategory(row.code) })),
    [catalog, initial.category, labels]
  )

  // The amount may stay empty (a bill that changes); anything typed must be a real amount
  const valid = Boolean(title.trim() && category && method) && (!amount.trim() || isPositiveAmount(amount))
  const dirty =
    title !== initial.title || category !== initial.category || amount !== initial.amount || method !== initial.method || day !== initial.day || active !== initial.active
  // A monthly expense being edited is saved once something changed; a new one as soon as it is filled in
  useReportForm(onStateChange, { dirty, busy: busy !== null, ready: valid && (template === null || dirty) }, () => void save())

  const fail = (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    setError(message)
  }

  const save = async () => {
    if (!valid || working.current || !category || !method) return
    working.current = true
    setBusy('save')
    setError(null)
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: t.finance.template.saved })
      refresh.finance()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.template.notFound })
        refresh.finance()
        sheet.finish()
        return
      }
      fail(t.finance.template.failed)
    } finally {
      working.current = false
      setBusy(null)
    }
  }

  const remove = () => {
    if (!template) return
    Alert.alert(t.finance.monthly.deleteTitle, t.finance.monthly.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          if (working.current) return
          working.current = true
          setBusy('delete')
          setError(null)
          try {
            await deleteRecurring(template.id)
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            toast({ title: t.finance.monthly.deleted })
            refresh.finance()
            sheet.finish()
          } catch {
            fail(t.finance.monthly.deleteFailed)
          } finally {
            working.current = false
            setBusy(null)
          }
        }
      }
    ])
  }

  return (
    <>
      <FormGroup>
        <TextField
          label={t.finance.template.name}
          placeholder={t.finance.template.namePlaceholder}
          value={title}
          onChangeText={(text) => setTitle(upperFirst(text) ?? '')}
          autoComplete="off"
          // The type is picked from a list next, not typed, so the key closes the keyboard
          returnKeyType="done"
        />
        {catalog ? (
          <SelectField label={t.finance.expense.category} placeholder={t.finance.expense.categoryPlaceholder} options={categories} value={category} onChange={setCategory} />
        ) : (
          // Until the types are here an open list would be empty
          <Row title={t.finance.expense.category} value={<Skeleton height={14} width={90} radius={7} />} />
        )}
      </FormGroup>
      <FormGroup footer={t.finance.template.amountHint}>
        <AmountField label={t.finance.template.amount} value={amount} onChange={setAmount} error={amountError(amount, t.common.amountInvalid)} />
        <Segmented<PaymentMethod>
          label={t.finance.expense.method}
          options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
          value={method}
          onChange={setMethod}
        />
      </FormGroup>
      <FormGroup footer={day >= 29 ? t.finance.template.dayHint : undefined}>
        <Stepper label={t.finance.template.day} value={day} onChange={setDay} min={1} max={31} decreaseLabel={t.finance.template.earlier} increaseLabel={t.finance.template.later} />
      </FormGroup>
      {template && (
        <FormGroup footer={t.finance.template.activeHint}>
          <SwitchField label={t.finance.template.active} value={active} onChange={setActive} />
        </FormGroup>
      )}
      <SheetActions error={error} />
      {template && <CardButton label={t.finance.template.delete} destructive busy={busy === 'delete'} disabled={busy === 'save'} onPress={remove} />}
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 24 }
})
