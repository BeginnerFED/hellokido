import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import {
  addIncomeEntry,
  carrySource,
  extendRegistration,
  previewExtension,
  registrationError,
  startsNewPeriod,
  updateExtension,
  updateIncomeEntry,
  updateRegistration,
  type IncomeEntry,
  type PaymentMethod,
  type Registration,
  type ResolvedExtension
} from '@hellokido/core/api'
import { localDateKey } from '@hellokido/core/rules/dates.js'
import { MAX_EXTRA_LESSONS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { packageEndFor } from '@hellokido/core/rules/packagePeriod.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { FREE, fromDateKey, sameInstant } from '@hellokido/core/view'
import { useCatalog, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Skeleton } from '../../ui/Bits'
import { AmountField, DateField, SelectField, Segmented, Stepper, TextField } from '../../ui/Fields'
import { FormGroup, Row } from '../../ui/Screen'
import { SheetActions, useReportForm, useSheet, type FormState } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'
import { amountError, groupNotes, usePackageOptions, usePackagePrice, usePaymentRows, type Note } from './fields'

const saved = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
const failed = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

/**
 * Money is never written twice: `busy` reaches the button only after a render, so a second tap in
 * the same moment is stopped here.
 */
function useSaveOnce() {
  const saving = useRef(false)
  return async (work: () => Promise<void>) => {
    if (saving.current) return
    saving.current = true
    try {
      await work()
    } finally {
      saving.current = false
    }
  }
}

type CollectProps = {
  registration: Registration
  /** A pending fee of this child; without one the current period's payment is collected. */
  entry?: IncomeEntry | null
  onStateChange: (state: FormState) => void
}

/** Marks a due payment as received: the period's own payment, or an expected fee. */
export function CollectForm({ registration, entry, onStateChange }: CollectProps) {
  const { t, fmt, money } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const price = usePackagePrice(entry ? null : registration.package_type)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [amount, setAmount] = useState(entry ? formatAmountForInput(entry.amount) : '')
  const [date, setDate] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = Boolean(method && isPositiveAmount(amount) && date)
  const dirty = method !== null || date !== null || amount !== (entry ? formatAmountForInput(entry.amount) : '')

  const once = useSaveOnce()
  const write = async () => {
    if (!valid || busy || !method || !date) return
    const value = parseAmount(amount) ?? 0
    setBusy(true)
    setError(null)
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
      saved()
      toast({ title: fmt(t.children.collect.saved, { amount: money(value) }) })
      refresh.children(registration.id)
      sheet.finish()
    } catch (caught) {
      const kind = entry ? (String((caught as Error)?.message).includes('not_found') ? 'stale' : 'other') : registrationError(caught)
      if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: entry ? t.finance.entry.notFound : t.children.form.stale })
        refresh.children(registration.id)
        sheet.finish()
        return
      }
      failed()
      setError(t.children.form.updateFailed)
    } finally {
      setBusy(false)
    }
  }
  const save = () => once(write)
  // The sheet puts the save in its bar
  useReportForm(onStateChange, { dirty, busy, ready: valid }, () => void save())
  const paymentRows = usePaymentRows({ method, onMethod: setMethod, amount, onAmount: setAmount, date, onDate: setDate, suggestion: price })

  return (
    <>
      <FormGroup>{paymentRows}</FormGroup>
      <SheetActions error={error} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------

type ExtendProps = {
  /** The row the person looked at; when correcting, the fresh row the history was read with. */
  registration: Registration
  mode: 'renew' | 'instalment' | 'edit'
  /** The latest extension, resolved against the ledger (edit mode). */
  extension?: ResolvedExtension | null
  onStateChange: (state: FormState) => void
}

type Period = { type: string; start: Date; end: Date }

const periodOf = (row: Pick<Registration, 'package_type' | 'package_start_date' | 'package_end_date'>): Period => ({
  type: row.package_type,
  start: new Date(row.package_start_date),
  end: new Date(row.package_end_date)
})

const dateOf = (value: string | null | undefined) => (value ? new Date(value) : null)

/**
 * A payment that opens a new period, pays for the current one (instalment), or corrects the last
 * one. Every package payment goes through the database functions; the lessons carried over are
 * read again right before saving, never taken from the preview.
 */
export function ExtendForm({ registration, mode, extension, onStateChange }: ExtendProps) {
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const editing = mode === 'edit' && Boolean(extension)

  // The form starts from what was on screen when it opened; a refetch never moves that baseline
  const [initial] = useState(() => {
    if (mode === 'edit' && extension) {
      const pending = extension.payment_status === 'beklemede'
      const start = dateOf(extension.new_start_date) ?? dateOf(extension.previous_end_date)
      const end = dateOf(extension.new_end_date)
      return {
        packageType: extension.new_package_type as string | null,
        start,
        period: start && end ? ({ type: extension.new_package_type, start, end } as Period) : null,
        status: (pending ? 'beklemede' : 'odendi') as 'odendi' | 'beklemede',
        method: pending ? null : (extension.payment_method as PaymentMethod),
        amount: pending ? '' : formatAmountForInput(extension.payment_amount),
        date: pending ? null : dateOf(extension.payment_date),
        note: extension.notes ?? ''
      }
    }
    return {
      packageType: registration.package_type === FREE ? null : registration.package_type,
      start: mode === 'instalment' ? new Date(registration.package_start_date) : null,
      period: null as Period | null,
      status: 'odendi' as 'odendi' | 'beklemede',
      method: null as PaymentMethod | null,
      amount: '',
      date: null as Date | null,
      note: ''
    }
  })
  const [packageType, setPackageType] = useState<string | null>(initial.packageType)
  const [start, setStart] = useState<Date | null>(initial.start)
  const [startTouched, setStartTouched] = useState(false)
  const [status, setStatus] = useState<'odendi' | 'beklemede'>(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [note, setNote] = useState(initial.note)
  const [extra, setExtra] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const source = useQuery({ queryKey: ['carry', registration.id], queryFn: () => carrySource(registration.id), enabled: !editing, staleTime: 0, gcTime: 0 })
  const current = source.data?.registration ?? registration

  // An instalment pays for the period as the database has it now, not as the list showed it
  useEffect(() => {
    if (mode === 'instalment' && source.data && !startTouched) setStart(new Date(source.data.registration.package_start_date))
  }, [mode, source.data, startTouched])

  // The last day is never chosen. A payment that keeps its period (an instalment, a correction)
  // keeps the stored last day; any other follows the first day and the package.
  const kept = editing ? initial.period : periodOf(current)
  const endFor = (type: string, first: Date) =>
    kept && kept.type === type && sameInstant(first, kept.start) ? kept.end : packageEndFor(type, first)

  const packageOptions = usePackageOptions({ includeFree: false, current: initial.packageType })
  const price = usePackagePrice(packageType)

  const changeStatus = (next: 'odendi' | 'beklemede') => {
    setStatus(next)
    // A due payment carries no details; "received" asks for the method and day again (never today by itself)
    setMethod(null)
    setDate(null)
    if (next === 'beklemede') setAmount('')
  }

  const movesPeriod = startsNewPeriod(current.package_start_date, start)
  const preview = editing ? null : previewExtension(source.data ?? null, packageType, start, extra)

  let notice: Note | null = null
  if (!editing && start && packageType) {
    const extraNote = preview && preview.extra > 0 ? fmt(t.children.extend.extraNote, { count: preview.extra }) : ''
    const numbers = { total: preview?.total ?? 0, remaining: preview?.remaining ?? 0, carried: preview?.carried ?? 0, extra: extraNote }
    if (source.data && !movesPeriod && packageType === 'tek-seferlik') notice = { tone: 'info', text: t.children.extend.singleSameDay }
    else if (preview?.samePackage) notice = { tone: 'info', text: fmt(movesPeriod ? t.children.extend.placeholder : t.children.extend.samePackage, numbers) }
    else if (preview && preview.carried > 0) notice = { tone: 'positive', text: fmt(t.children.extend.carried, numbers) }
    else if (preview && preview.extra > 0) notice = { tone: 'info', text: fmt(t.children.extend.extraOnly, numbers) }
  }

  // A correction may move the period back as far as the one it closed
  const minDate = useMemo(() => {
    if (editing && extension) {
      const days = [extension.previous_start_date, extension.previous_end_date, extension.new_start_date]
        .filter(Boolean)
        .map((value) => new Date(value as string).getTime())
      return days.length ? new Date(Math.min(...days)) : null
    }
    return new Date(current.package_start_date)
  }, [editing, extension, current.package_start_date])

  const paidComplete = status === 'beklemede' || Boolean(method && method !== 'belirlenmedi' && isPositiveAmount(amount) && date)
  const valid = Boolean(packageType && start && paidComplete)
  const dirty =
    packageType !== initial.packageType ||
    !sameInstant(start, initial.start) ||
    status !== initial.status ||
    method !== initial.method ||
    amount !== initial.amount ||
    !sameInstant(date, initial.date) ||
    note !== initial.note ||
    extra !== 0

  const once = useSaveOnce()
  const write = async () => {
    if (!valid || busy || !start || !packageType) return
    // A sheet left open on another child must never write under this child's name
    if (editing && extension?.registration_id !== registration.id) return
    setBusy(true)
    setError(null)
    const payment = {
      packageType,
      startDate: start,
      endDate: endFor(packageType, start),
      paymentStatus: status,
      paymentMethod: (method ?? 'belirlenmedi') as PaymentMethod,
      paymentAmount: parseAmount(amount) ?? 0,
      paymentDate: date,
      notes: note
    }
    try {
      if (editing && extension) {
        await updateExtension({ ...payment, extensionId: extension.id, expectedUpdatedAt: registration.updated_at as string })
        toast({ title: t.children.extend.edited })
      } else {
        await extendRegistration({
          ...payment,
          registrationId: registration.id,
          expectedExtensionCount: registration.extension_count ?? 0,
          extraLessons: extra
        })
        toast({ title: fmt(t.children.extend.saved, { name: registration.student_name }) })
      }
      saved()
      refresh.children(registration.id)
      sheet.finish()
    } catch (caught) {
      const kind = registrationError(caught)
      if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: t.children.form.stale })
        refresh.children(registration.id)
        sheet.finish()
        return
      }
      failed()
      setError(
        kind === 'pending_payment'
          ? t.children.extend.pendingBlocked
          : kind === 'free_registration'
            ? t.children.extend.freeBlocked
            : kind === 'invalid_period'
              ? t.children.form.invalidPeriod
              : t.children.extend.failed
      )
    } finally {
      setBusy(false)
    }
  }
  const save = () => once(write)
  // A correction waits for a change before "Save" can be pressed
  useReportForm(onStateChange, { dirty, busy, ready: valid && (!editing || dirty) }, () => void save())
  const paymentRows = usePaymentRows({ method, onMethod: setMethod, amount, onAmount: setAmount, date, onDate: setDate, suggestion: price })

  return (
    <>
      {/* What the package will do, under its card */}
      <FormGroup footer={groupNotes([notice])}>
        <SelectField label={t.children.form.packageType} placeholder={t.children.form.packagePlaceholder} options={packageOptions} value={packageType} onChange={setPackageType} />
        <DateField
          label={t.children.form.start}
          value={start}
          onChange={(next) => {
            setStart(next)
            setStartTouched(true)
          }}
          minimumDate={minDate}
          hint={start ? undefined : t.children.form.startHelp}
          shortcuts={mode === 'renew'}
        />
        {!editing && (
          <Stepper
            label={t.children.extend.addExtra}
            value={extra}
            onChange={setExtra}
            max={MAX_EXTRA_LESSONS}
            decreaseLabel={t.children.form.extraDecrease}
            increaseLabel={t.children.form.extraIncrease}
          />
        )}
      </FormGroup>
      <FormGroup>
        <Segmented
          label={t.children.form.status}
          options={[
            { id: 'odendi', label: t.children.form.paid },
            { id: 'beklemede', label: t.children.form.pending }
          ]}
          value={status}
          onChange={changeStatus}
        />
        {status === 'odendi' && paymentRows}
      </FormGroup>
      <FormGroup title={t.children.form.note}>
        <TextField label={t.children.form.note} placeholder={t.children.form.notePlaceholder} value={note} onChangeText={(text) => setNote(upperFirst(text) ?? '')} multiline />
      </FormGroup>
      <SheetActions error={error} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------

type IncomeProps = {
  kind: 'child' | 'other'
  registrationId?: string | null
  /** An entry to correct; without one a new entry is made. */
  entry?: IncomeEntry | null
  /** An expected entry that has now been paid: starts as received, the amount kept. */
  collect?: boolean
  onStateChange: (state: FormState) => void
}

/**
 * Income outside the package flow: a child's fee (materials, an event) or income of the workshop
 * (a party, a sale). An expected one keeps its amount and, if known, the day it is due.
 */
export function IncomeForm({ kind, registrationId, entry, collect, onStateChange }: IncomeProps) {
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog().data
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()

  // Like every payment received, the day is picked (one tap for today): it decides the month the money counts in
  const [initial] = useState(() => ({
    description: entry?.description ?? '',
    category: entry?.category ?? null,
    status: (entry?.payment_status === 'beklemede' && !collect ? 'beklemede' : 'odendi') as 'odendi' | 'beklemede',
    method: entry && entry.payment_method !== 'belirlenmedi' ? (entry.payment_method as PaymentMethod) : null,
    amount: entry ? formatAmountForInput(entry.amount) : '',
    date: entry?.payment_date ? new Date(entry.payment_date) : null,
    due: fromDateKey(entry?.due_date),
    note: entry?.notes ?? ''
  }))
  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<string | null>(initial.category)
  const [status, setStatus] = useState<'odendi' | 'beklemede'>(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [due, setDue] = useState<Date | null>(initial.due)
  const [note, setNote] = useState(initial.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const valid = isPositiveAmount(amount) && (kind === 'child' || Boolean(category)) && (!paid || Boolean(method && method !== 'belirlenmedi' && date))
  const dirty =
    description !== initial.description ||
    category !== initial.category ||
    status !== initial.status ||
    method !== initial.method ||
    amount !== initial.amount ||
    !sameInstant(date, initial.date) ||
    !sameInstant(due, initial.due) ||
    note !== initial.note

  const once = useSaveOnce()
  const write = async () => {
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
    setError(null)
    try {
      if (entry) {
        await updateIncomeEntry(entry.id, fields)
        const nowPaid = entry.payment_status === 'beklemede' && paid
        toast({ title: nowPaid ? fmt(t.finance.entry.saved, { amount: money(value) }) : t.finance.entry.updated })
      } else {
        await addIncomeEntry(fields)
        toast({ title: fmt(paid ? t.finance.entry.saved : t.finance.entry.savedExpected, { amount: money(value) }) })
      }
      saved()
      if (fields.registration_id) refresh.children(fields.registration_id)
      refresh.finance(fields.registration_id ?? undefined)
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.finance.entry.notFound })
        refresh.finance(fields.registration_id ?? undefined)
        sheet.finish()
        return
      }
      failed()
      setError(t.finance.entry.failed)
    } finally {
      setBusy(false)
    }
  }
  const save = () => once(write)
  // An entry being corrected waits for a change before "Save" can be pressed
  useReportForm(onStateChange, { dirty, busy, ready: valid && (!entry || dirty) }, () => void save())
  const paymentRows = usePaymentRows({ method, onMethod: setMethod, amount, onAmount: setAmount, date, onDate: setDate })

  return (
    <>
      {/* The same groups as the expense sheet: what and which kind, then the money, then a note */}
      <FormGroup>
        <TextField
          label={t.finance.entry.description}
          // Short, so the words fit beside the label on a small phone
          placeholder={kind === 'child' ? t.children.phone.feePlaceholder : t.children.phone.otherPlaceholder}
          value={description}
          onChangeText={(text) => setDescription(upperFirst(text) ?? '')}
          autoComplete="off"
        />
        {kind === 'other' &&
          (catalog ? (
            <SelectField label={t.finance.entry.category} placeholder={t.finance.entry.categoryPlaceholder} options={categoryOptions} value={category} onChange={setCategory} />
          ) : (
            // Until the categories are here an open list would be empty
            <Row title={t.finance.entry.category} value={<Skeleton height={14} width={90} />} />
          ))}
      </FormGroup>
      <FormGroup>
        <Segmented
          label={t.finance.entry.status}
          options={[
            { id: 'odendi', label: t.finance.entry.paid },
            { id: 'beklemede', label: t.finance.entry.expected }
          ]}
          value={status}
          onChange={changeStatus}
        />
        {paid
          ? paymentRows
          : [
              <AmountField key="expected" label={t.finance.entry.expectedAmount} value={amount} onChange={setAmount} error={amountError(amount, t.common.amountInvalid)} />,
              <DateField key="due" label={t.finance.entry.dueDate} value={due} onChange={setDue} hint={t.finance.entry.dueHelp} />
            ]}
      </FormGroup>
      <FormGroup title={t.finance.entry.note}>
        <TextField label={t.finance.entry.note} placeholder={t.finance.entry.notePlaceholder} value={note} onChangeText={(text) => setNote(upperFirst(text) ?? '')} multiline />
      </FormGroup>
      <SheetActions error={error} />
    </>
  )
}
