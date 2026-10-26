import { useEffect, useMemo, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useNavigate } from 'react-router'
import {
  createRegistration,
  registrationError,
  updateRegistration,
  type PaymentMethod,
  type PaymentStatus,
  type Registration,
  type RegistrationChanges
} from '@hellokido/core/api'
import { MAX_EXTRA_LESSONS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { packageEndFor } from '@hellokido/core/rules/packagePeriod.js'
import { isValidPhone, normalizePhone, phoneDigits } from '@hellokido/core/rules/phone.js'
import { findRegistrationByPhone } from '@hellokido/core/rules/registrationLookup.js'
import { capitalizeName, capitalizeWords, upperFirst } from '@hellokido/core/rules/text.js'
import { useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DateField } from '../../ui/DateField'
import { TextArea, TextField } from '../../ui/Field'
import { FormRule, Notice } from '../../ui/Notice'
import { SheetActions, SheetFooter } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { keepCaret } from '../../ui/caret'
import { PaymentFields } from '../money/PaymentFields'
import type { FormState } from './ExtendForm'
import { usePackageOptions, usePackagePrice } from './packageOptions'
import { FREE, sameInstant } from './rules'

/** What a new registration starts with, e.g. a family taken from the waitlist. */
export type RegistrationPrefill = {
  studentName: string
  age: string
  parentName: string
  phone: string
  packageType: string | null
  note: string
}

type Props = {
  /** The row to edit; without one a new child is registered. */
  registration?: Registration | null
  prefill?: RegistrationPrefill
  onDone: (saved?: Registration) => void
  onStateChange?: (state: FormState) => void
}

type Owner = { id: string; student_name: string; is_active: boolean | null } | 'unknown'

/** Free participation runs for the day it was registered: 00:00 to 23:59:59.999 local time. */
function freeDay() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function RegistrationForm({ registration: row, prefill, onDone, onStateChange }: Props) {
  const { t, fmt, money, date: formatDate } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const navigate = useNavigate()
  const editing = Boolean(row)

  const studentRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const parentRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const initial = useMemo(
    () => ({
      studentName: row?.student_name ?? prefill?.studentName ?? '',
      age: row?.student_age ?? prefill?.age ?? '',
      parentName: row?.parent_name ?? prefill?.parentName ?? '',
      phone: row?.parent_phone ?? prefill?.phone ?? '',
      packageType: row?.package_type ?? prefill?.packageType ?? null,
      start: row ? new Date(row.package_start_date) : null,
      status: (row?.payment_status as PaymentStatus | undefined) ?? null,
      method: row?.payment_status === 'odendi' ? (row.payment_method as PaymentMethod) : null,
      amount: row?.payment_status === 'odendi' ? formatAmountForInput(row.payment_amount) : '',
      date: row?.payment_date ? new Date(row.payment_date) : null,
      extra: row?.extra_lessons ?? 0,
      note: row?.notes ?? prefill?.note ?? ''
    }),
    // The form starts from the row as it was when the sheet opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [studentName, setStudentName] = useState(initial.studentName)
  const [age, setAge] = useState(initial.age)
  const [parentName, setParentName] = useState(initial.parentName)
  const [phone, setPhone] = useState(initial.phone)
  const [packageType, setPackageType] = useState<string | null>(initial.packageType)
  const [start, setStart] = useState<Date | null>(initial.start)
  const [status, setStatus] = useState<PaymentStatus | null>(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [extra, setExtra] = useState(initial.extra)
  const [note, setNote] = useState(initial.note)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const packageOptions = usePackageOptions({ includeFree: true, current: initial.packageType })
  const price = usePackagePrice(packageType)
  const free = packageType === FREE

  const changePackage = (next: string) => {
    const wasFree = packageType === FREE
    setPackageType(next)
    if (next === FREE) {
      // Free participation has no period and no payment
      if (!editing) setStart(null)
      setStatus('ucretsiz')
      setMethod(null)
      setAmount('')
      setDate(null)
    } else if (wasFree) {
      // Back to a paid package: the payment is chosen again, and a new child needs a real first day
      if (!editing) setStart(null)
      setStatus(null)
      setMethod(null)
      setAmount('')
      setDate(null)
    }
  }

  const changeStatus = (next: 'odendi' | 'beklemede') => {
    setStatus(next)
    setMethod(null)
    setDate(null)
    if (next === 'beklemede') setAmount('')
  }

  // ---- what would be saved
  const changes = useMemo<RegistrationChanges>(() => {
    if (!row) return {}
    const diff: RegistrationChanges = {}
    if (studentName.trim() !== (row.student_name ?? '')) diff.student_name = studentName.trim()
    if (parentName.trim() !== (row.parent_name ?? '')) diff.parent_name = parentName.trim()
    if (age.trim() !== (row.student_age ?? '')) diff.student_age = age.trim()
    if (note.trim() !== (row.notes ?? '')) diff.notes = note.trim()
    if (phone !== row.parent_phone) {
      const normalized = normalizePhone(phone)
      if (normalized !== row.parent_phone) diff.parent_phone = normalized
    }
    if (packageType && packageType !== row.package_type) diff.package_type = packageType
    if (packageType && packageType !== FREE) {
      if (start && !sameInstant(start, row.package_start_date)) diff.package_start_date = start.toISOString()
      // The last day is never chosen: it follows the first day and the package
      if (start && ('package_start_date' in diff || 'package_type' in diff)) {
        const end = packageEndFor(packageType, start)
        if (!sameInstant(end, row.package_end_date)) diff.package_end_date = end.toISOString()
      }
      if (status && status !== row.payment_status) diff.payment_status = status
      const pending = status === 'beklemede'
      const nextMethod = pending ? 'belirlenmedi' : method
      if (nextMethod && nextMethod !== row.payment_method) diff.payment_method = nextMethod
      const nextAmount = pending ? 0 : parseAmount(amount)
      if (nextAmount !== null && nextAmount !== Number(row.payment_amount)) diff.payment_amount = nextAmount
      const nextDate = pending ? null : date
      if (!sameInstant(nextDate, row.payment_date)) diff.payment_date = nextDate ? nextDate.toISOString() : (null as unknown as string)
      if (extra !== (row.extra_lessons || 0)) diff.extra_lessons = extra
    }
    return diff
  }, [row, studentName, parentName, age, note, phone, packageType, start, status, method, amount, date, extra])

  const paymentChanged = ['payment_status', 'payment_method', 'payment_amount', 'payment_date'].some((key) => key in changes)

  // ---- checks
  const phoneEdited = !row || phone !== row.parent_phone
  const phoneOk = phoneEdited ? isValidPhone(phone) : phone.trim() !== ''
  const paidComplete = Boolean(method && method !== 'belirlenmedi' && isPositiveAmount(amount) && date)
  const paymentOk = free || status === 'beklemede' || (status === 'odendi' && paidComplete)
  const valid = Boolean(
    studentName.trim() &&
      parentName.trim() &&
      age.trim() &&
      phoneOk &&
      packageType &&
      (free || start) &&
      paymentOk &&
      (free || status === 'odendi' || status === 'beklemede')
  )

  // A prefilled form only counts as changed once something differs from what it started with
  const dirty = row
    ? Object.keys(changes).length > 0
    : studentName !== initial.studentName ||
      age !== initial.age ||
      parentName !== initial.parentName ||
      phone !== initial.phone ||
      packageType !== initial.packageType ||
      note !== initial.note ||
      Boolean(start || status || amount || extra)
  useEffect(() => onStateChange?.({ dirty, busy }), [dirty, busy, onStateChange])

  const describePayment = (values: { status: string | null; amount: number | null; method: string | null; date: Date | string | null }) =>
    values.status !== 'odendi'
      ? t.children.form.pendingWord
      : [money(values.amount), labels.method(values.method), values.date ? formatDate(values.date) : ''].filter(Boolean).join(' · ')

  // ---- save
  const showOwner = async (normalized: string) => {
    const found = await findRegistrationByPhone(normalized)
    setOwner(found ? { id: found.id, student_name: found.student_name, is_active: found.is_active } : 'unknown')
  }

  const save = async (confirmed = false) => {
    if (!valid || busy || !packageType) return
    if (row) {
      if (Object.keys(changes).length === 0) return onDone()
      const replacesCollected = !free && row.package_type !== FREE && row.payment_status === 'odendi' && paymentChanged
      if (replacesCollected && !confirmed) return setConfirming(true)
    }
    setConfirming(false)
    setBusy(true)
    try {
      if (row) {
        const saved = (await updateRegistration(row.id, row.updated_at as string, changes)) as unknown as Registration
        toast({ title: t.children.form.updated })
        refresh.children(row.id)
        onDone(saved)
      } else {
        const period = free ? freeDay() : { start: start!, end: packageEndFor(packageType, start!) }
        const pending = free || status === 'beklemede'
        const created = (await createRegistration({
          student_name: studentName.trim(),
          student_age: age.trim(),
          parent_name: parentName.trim(),
          parent_phone: normalizePhone(phone),
          package_type: packageType,
          package_start_date: period.start.toISOString(),
          package_end_date: period.end.toISOString(),
          payment_status: free ? 'ucretsiz' : (status as PaymentStatus),
          payment_method: pending ? 'belirlenmedi' : (method as PaymentMethod),
          payment_amount: pending ? 0 : (parseAmount(amount) ?? 0),
          payment_date: pending || !date ? null : date.toISOString(),
          notes: note.trim() || null,
          extra_lessons: free ? 0 : extra
        })) as unknown as Registration
        toast({ title: fmt(t.children.form.created, { name: studentName.trim() }) })
        refresh.children(created?.id)
        onDone(created)
      }
    } catch (error) {
      const kind = registrationError(error)
      if (kind === 'duplicate_phone') {
        await showOwner(row ? (changes.parent_phone ?? row.parent_phone) : normalizePhone(phone))
      } else if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: t.children.form.stale })
        refresh.children(row?.id)
        onDone()
      } else if (kind === 'invalid_period') {
        toast({ tone: 'error', title: t.children.form.invalidPeriod })
      } else {
        toast({ tone: 'error', title: row ? t.children.form.updateFailed : t.children.form.createFailed })
      }
    } finally {
      setBusy(false)
    }
  }

  const phoneMessage =
    owner === 'unknown'
      ? t.children.form.phoneUsedUnknown
      : owner
        ? fmt(owner.is_active === false ? t.children.form.phoneUsedArchived : t.children.form.phoneUsed, { name: owner.student_name })
        : phone && phoneEdited && !isValidPhone(phone)
          ? t.children.form.phoneHint
          : undefined

  const newPayment = {
    status,
    amount: status === 'odendi' ? parseAmount(amount) : 0,
    method: status === 'odendi' ? method : null,
    date: status === 'odendi' ? date : null
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <TextField
          ref={studentRef}
          label={t.children.form.studentName}
          value={studentName}
          onChange={(text) => keepCaret(studentRef.current, text, (value) => capitalizeName(value) ?? '', setStudentName)}
          autoComplete="off"
          autoFocus={!editing}
        />
        <TextField
          ref={ageRef}
          label={t.children.form.studentAge}
          placeholder={t.children.form.agePlaceholder}
          value={age}
          onChange={(text) => keepCaret(ageRef.current, text, (value) => capitalizeWords(value) ?? '', setAge)}
          autoComplete="off"
        />
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TextField
          ref={parentRef}
          label={t.children.form.parentName}
          value={parentName}
          onChange={(text) => keepCaret(parentRef.current, text, (value) => capitalizeName(value) ?? '', setParentName)}
          autoComplete="off"
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            ref={phoneRef}
            label={t.children.form.parentPhone}
            value={phone}
            onChange={(text) => {
              setOwner(null)
              keepCaret(phoneRef.current, text, (value) => phoneDigits(value), setPhone)
            }}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            errorMessage={phoneMessage}
          />
          {owner && owner !== 'unknown' && (
            <AriaButton
              onPress={() => {
                onDone()
                navigate(`/children/${owner.id}`)
              }}
              className="self-start rounded-[0.375rem] px-0.5 text-[0.8125rem] font-semibold text-accent-ink underline-offset-2 outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-focus"
            >
              {t.children.form.openOwner}
            </AriaButton>
          )}
        </div>
      </div>

      <FormRule />

      <Select
        label={t.children.form.packageType}
        placeholder={t.children.form.packagePlaceholder}
        options={packageOptions}
        value={packageType}
        onChange={changePackage}
      />
      {free ? (
        <Notice>{t.children.form.freeNote}</Notice>
      ) : (
        <>
          <DateField label={t.children.form.start} value={start} onChange={setStart} description={start ? undefined : t.children.form.startHelp} shortcuts />
          <Stepper
            label={t.children.form.extraLessons}
            value={extra}
            onChange={setExtra}
            max={MAX_EXTRA_LESSONS}
            decreaseLabel={t.children.form.extraDecrease}
            increaseLabel={t.children.form.extraIncrease}
          />
        </>
      )}

      {!free && (
        <>
          <FormRule />
          <Segmented<'odendi' | 'beklemede'>
            label={t.children.form.status}
            options={[
              { id: 'odendi', label: t.children.form.paid },
              { id: 'beklemede', label: t.children.form.pending }
            ]}
            value={status === 'odendi' || status === 'beklemede' ? status : null}
            onChange={changeStatus}
          />
          {status === 'odendi' && (
            <PaymentFields
              method={method}
              onMethod={setMethod}
              amount={amount}
              onAmount={setAmount}
              date={date}
              onDate={setDate}
              suggestion={price}
            />
          )}
        </>
      )}

      <TextArea
        ref={noteRef}
        label={t.children.form.note}
        placeholder={t.children.form.notePlaceholder}
        value={note}
        onChange={(text) => keepCaret(noteRef.current, text, (value) => upperFirst(value) ?? '', setNote)}
        rows={2}
      />

      <SheetFooter>
        <SheetActions>
          <Button variant="primary" isDisabled={!valid || (editing && !dirty)} isPending={busy} onPress={() => save()} className="max-md:flex-1">
            {row ? t.children.form.save : t.children.form.create}
          </Button>
        </SheetActions>
      </SheetFooter>

      {row && (
        <ConfirmDialog
          isOpen={confirming}
          onOpenChange={setConfirming}
          title={t.children.form.replaceTitle}
          body={
            <>
              <span className="block font-medium text-ink tabular">
                {describePayment({ status: row.payment_status, amount: row.payment_amount, method: row.payment_method, date: row.payment_date })}
                {' → '}
                {describePayment(newPayment)}
              </span>
              <span className="mt-2 block">{t.children.form.replaceBody}</span>
            </>
          }
          confirmLabel={t.children.form.replaceConfirm}
          isPending={busy}
          onConfirm={() => save(true)}
        />
      )}
    </div>
  )
}
