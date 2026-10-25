import { useEffect, useMemo, useState } from 'react'
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
import { AmountField, Chip, FieldLabel, Segmented, Stepper, SwitchField, TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { amountError, METHODS, type FormState } from '../payment/fields'

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
    <SheetScreen title={id ? t.finance.template.editTitle : t.finance.template.newTitle} dirty={state.dirty} busy={state.busy}>
      {waiting ? (
        <View style={styles.stack}>
          <Skeleton height={50} radius={13} />
          <Skeleton height={96} radius={13} />
          <Skeleton height={50} radius={13} />
        </View>
      ) : missing ? (
        <EmptyState icon="info" title={templates.isError ? t.common.loadFailed : t.finance.template.notFound} />
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(
    () => (catalog?.expenseCategories ?? []).filter((row) => row.is_active || row.code === initial.category).map((row) => ({ id: row.code, label: labels.expenseCategory(row.code) })),
    [catalog, initial.category, labels]
  )

  // The amount may stay empty (a bill that changes); anything typed must be a real amount
  const valid = Boolean(title.trim() && category && method) && (!amount.trim() || isPositiveAmount(amount))
  const dirty =
    title !== initial.title || category !== initial.category || amount !== initial.amount || method !== initial.method || day !== initial.day || active !== initial.active
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy || !category || !method) return
    setBusy(true)
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
      setError(t.finance.template.failed)
    } finally {
      setBusy(false)
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
          setBusy(true)
          setError(null)
          try {
            await deleteRecurring(template.id)
            toast({ title: t.finance.monthly.deleted })
            refresh.finance()
            sheet.finish()
          } catch {
            setError(t.finance.monthly.deleteFailed)
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  return (
    <>
      <TextField
        label={t.finance.template.name}
        placeholder={t.finance.template.namePlaceholder}
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
            : categories.map((option) => <Chip key={option.id} label={option.label} selected={category === option.id} onPress={() => setCategory(option.id)} />)}
        </View>
      </View>
      <View>
        <AmountField label={t.finance.template.amount} value={amount} onChange={setAmount} error={amountError(amount, t.common.amountInvalid)} />
        <Text variant="foot" tone="ink3" style={styles.hint}>
          {t.finance.template.amountHint}
        </Text>
      </View>
      <Segmented<PaymentMethod>
        label={t.finance.expense.method}
        options={METHODS.map((id) => ({ id, label: t.finance.methodShort[id] ?? id }))}
        value={method}
        onChange={setMethod}
      />
      <View>
        <Stepper label={t.finance.template.day} value={day} onChange={setDay} min={1} max={31} decreaseLabel={t.finance.template.earlier} increaseLabel={t.finance.template.later} />
        {day >= 29 && (
          <Text variant="foot" tone="ink3" style={styles.hint}>
            {t.finance.template.dayHint}
          </Text>
        )}
      </View>
      {template && <SwitchField label={t.finance.template.active} hint={t.finance.template.activeHint} value={active} onChange={setActive} />}
      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!valid} busy={busy} onPress={() => void save()}>
          {t.common.save}
        </Button>
        {template && (
          <Button variant="danger" size="md" icon="delete" disabled={busy} onPress={remove}>
            {t.finance.template.delete}
          </Button>
        )}
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { marginTop: 6, paddingHorizontal: 2 }
})
