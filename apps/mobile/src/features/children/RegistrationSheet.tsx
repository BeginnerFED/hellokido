import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import {
  createRegistration,
  listWaitlist,
  registrationError,
  updateRegistration,
  type PaymentMethod,
  type PaymentStatus,
  type Registration,
  type RegistrationChanges,
  type WaitlistEntry
} from '@hellokido/core/api'
import { MAX_EXTRA_LESSONS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { isMissingPeriodEnd } from '@hellokido/core/rules/packagePeriod.js'
import { isValidPhone, normalizePhone, phoneDigits } from '@hellokido/core/rules/phone.js'
import { findRegistrationByPhone } from '@hellokido/core/rules/registrationLookup.js'
import { capitalizeName, capitalizeWords, upperFirst } from '@hellokido/core/rules/text.js'
import { FREE, periodHint, sameInstant, UNDECIDED } from '@hellokido/core/view'
import { keys, useLabels, useRefresh, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Notice, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { PeriodField, Segmented, SelectField, Stepper, TextField } from '../../ui/Fields'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { PaymentFields, usePackageOptions, usePackagePrice, type FormState } from '../payment/fields'
import { useTakeOffWaitlist } from '../waitlist/handoff'

const IDLE: FormState = { dirty: false, busy: false }

/** What a new registration starts with, e.g. a family taken from the waitlist. */
type Prefill = { studentName: string; age: string; parentName: string; phone: string; packageType: string | null; note: string }

const prefillFrom = (entry: WaitlistEntry): Prefill => ({
  studentName: entry.student_name,
  age: entry.student_age,
  parentName: entry.parent_name,
  phone: entry.parent_phone,
  packageType: entry.package_type === UNDECIDED ? null : entry.package_type,
  note: entry.notes ?? ''
})

/** A new child (from scratch or from the waitlist) or the details of one. */
export function RegistrationSheet({ id, waitlistId }: { id?: string; waitlistId?: string }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  const registrations = useRegistrations()
  const waitlist = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist, enabled: Boolean(waitlistId) })
  const row = id ? registrations.data?.find((item) => item.id === id) : null
  const entry = waitlistId ? waitlist.data?.find((item) => item.id === waitlistId) : undefined
  const waiting = (Boolean(id) && !registrations.data) || (Boolean(waitlistId) && !waitlist.data)

  return (
    <SheetScreen
      title={id ? t.children.form.editTitle : t.children.form.createTitle}
      subtitle={row?.student_name ?? (entry ? t.waitlist.fromWaitlist : undefined)}
      dirty={state.dirty}
      busy={state.busy}
    >
      {waiting ? (
        <View style={styles.stack}>
          <Skeleton height={50} radius={13} />
          <Skeleton height={50} radius={13} />
          <Skeleton height={50} radius={13} />
        </View>
      ) : id && !row ? (
        <EmptyState icon="info" title={t.children.detail.notFound} />
      ) : (
        <RegistrationForm registration={row ?? null} fromWaitlist={entry} onStateChange={setState} />
      )}
    </SheetScreen>
  )
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

type FormProps = { registration: Registration | null; fromWaitlist?: WaitlistEntry; onStateChange: (state: FormState) => void }

function RegistrationForm({ registration: row, fromWaitlist, onStateChange }: FormProps) {
  const { t, fmt, money, date: formatDate } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const sheet = useSheet()
  const takeOffWaitlist = useTakeOffWaitlist()
  const editing = Boolean(row)

  // The form starts from the row as it was when the sheet opened
  const [initial] = useState(() => {
    const prefill = !row && fromWaitlist ? prefillFrom(fromWaitlist) : null
    return {
      studentName: row?.student_name ?? prefill?.studentName ?? '',
      age: row?.student_age ?? prefill?.age ?? '',
      parentName: row?.parent_name ?? prefill?.parentName ?? '',
      phone: row?.parent_phone ?? prefill?.phone ?? '',
      packageType: row?.package_type ?? prefill?.packageType ?? null,
      start: row ? new Date(row.package_start_date) : null,
      end: row ? new Date(row.package_end_date) : null,
      status: (row?.payment_status as PaymentStatus | undefined) ?? null,
      method: row?.payment_status === 'odendi' ? (row.payment_method as PaymentMethod) : null,
      amount: row?.payment_status === 'odendi' ? formatAmountForInput(row.payment_amount) : '',
      date: row?.payment_date ? new Date(row.payment_date) : null,
      extra: row?.extra_lessons ?? 0,
      note: row?.notes ?? prefill?.note ?? ''
    }
  })

  const [studentName, setStudentName] = useState(initial.studentName)
  const [age, setAge] = useState(initial.age)
  const [parentName, setParentName] = useState(initial.parentName)
  const [phone, setPhone] = useState(initial.phone)
  const [packageType, setPackageType] = useState<string | null>(initial.packageType)
  const [start, setStart] = useState<Date | null>(initial.start)
  const [end, setEnd] = useState<Date | null>(initial.end)
  const [status, setStatus] = useState<PaymentStatus | null>(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [extra, setExtra] = useState(initial.extra)
  const [note, setNote] = useState(initial.note)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const packageOptions = usePackageOptions({ includeFree: true, current: initial.packageType })
  const price = usePackagePrice(packageType)
  const free = packageType === FREE
  const range = start && end ? { start, end } : null

  const changePackage = (next: string) => {
    const wasFree = packageType === FREE
    setPackageType(next)
    if (next === FREE) {
      // Free participation has no period and no payment
      if (!editing) {
        setStart(null)
        setEnd(null)
      }
      setStatus('ucretsiz')
      setMethod(null)
      setAmount('')
      setDate(null)
    } else if (wasFree) {
      // Back to a paid package: the payment is chosen again, and a new child needs a real period
      if (!editing) {
        setStart(null)
        setEnd(null)
      }
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
      if (end && !sameInstant(end, row.package_end_date)) diff.package_end_date = end.toISOString()
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
  }, [row, studentName, parentName, age, note, phone, packageType, start, end, status, method, amount, date, extra])

  const packageChanged = 'package_type' in changes || 'package_start_date' in changes || 'package_end_date' in changes
  const paymentChanged = ['payment_status', 'payment_method', 'payment_amount', 'payment_date'].some((key) => key in changes)

  // ---- checks
  const phoneEdited = !row || phone !== row.parent_phone
  const phoneOk = phoneEdited ? isValidPhone(phone) : phone.trim() !== ''
  const checkPeriod = !free && (!row || packageChanged)
  const missingEnd = Boolean(checkPeriod && range && packageType && isMissingPeriodEnd(packageType, range.start, range.end))
  const hint = !free && !missingEnd ? periodHint(packageType, range) : null
  const paidComplete = Boolean(method && method !== 'belirlenmedi' && isPositiveAmount(amount) && date)
  const paymentOk = free || status === 'beklemede' || (status === 'odendi' && paidComplete)
  const valid = Boolean(
    studentName.trim() &&
      parentName.trim() &&
      age.trim() &&
      phoneOk &&
      packageType &&
      (free || (range && !missingEnd)) &&
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
      Boolean(start || end || status || amount || extra)
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const describePayment = (values: { status: string | null; amount: number | null; method: string | null; date: Date | string | null }) =>
    values.status !== 'odendi'
      ? t.children.form.pendingWord
      : [money(values.amount), labels.method(values.method), values.date ? formatDate(values.date) : ''].filter(Boolean).join(' · ')

  const showOwner = async (normalized: string) => {
    const found = await findRegistrationByPhone(normalized)
    setOwner(found ? { id: found.id, student_name: found.student_name, is_active: found.is_active } : 'unknown')
  }

  const save = async (confirmed = false) => {
    if (!valid || busy || !packageType) return
    if (row) {
      if (Object.keys(changes).length === 0) return sheet.finish()
      // Changing a payment that was already collected rewrites it: say so before it happens
      const replacesCollected = !free && row.package_type !== FREE && row.payment_status === 'odendi' && paymentChanged
      if (replacesCollected && !confirmed) {
        const before = describePayment({ status: row.payment_status, amount: row.payment_amount, method: row.payment_method, date: row.payment_date })
        const after = describePayment({
          status,
          amount: status === 'odendi' ? parseAmount(amount) : 0,
          method: status === 'odendi' ? method : null,
          date: status === 'odendi' ? date : null
        })
        Alert.alert(t.children.form.replaceTitle, `${before} → ${after}\n\n${t.children.form.replaceBody}`, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.children.form.replaceConfirm, onPress: () => void save(true) }
        ])
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      if (row) {
        await updateRegistration(row.id, row.updated_at as string, changes)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast({ title: t.children.form.updated })
        refresh.children(row.id)
        sheet.finish()
      } else {
        const period = free ? freeDay() : range!
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
        })) as unknown as Registration | null
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast({ title: fmt(t.children.form.created, { name: studentName.trim() }) })
        refresh.children(created?.id)
        sheet.finish()
        if (fromWaitlist) void takeOffWaitlist(fromWaitlist)
        // The new child opens right away, on the children tab
        if (created?.id) router.navigate(`/(tabs)/(children)/child/${created.id}` as Href)
      }
    } catch (caught) {
      const kind = registrationError(caught)
      if (kind === 'duplicate_phone') {
        await showOwner(row ? (changes.parent_phone ?? row.parent_phone) : normalizePhone(phone))
      } else if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: t.children.form.stale })
        refresh.children(row?.id)
        sheet.finish()
      } else {
        setError(kind === 'invalid_period' ? t.children.form.invalidPeriod : row ? t.children.form.updateFailed : t.children.form.createFailed)
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

  const openOwner = (id: string) => {
    sheet.finish()
    router.navigate(`/(tabs)/(children)/child/${id}` as Href)
  }

  return (
    <>
      <TextField
        label={t.children.form.studentName}
        value={studentName}
        onChangeText={(text) => setStudentName(capitalizeName(text) ?? '')}
        autoCapitalize="words"
        autoComplete="off"
        autoCorrect={false}
        autoFocus={!editing && !fromWaitlist}
        returnKeyType="next"
      />
      <TextField
        label={t.children.form.studentAge}
        placeholder={t.children.form.agePlaceholder}
        value={age}
        onChangeText={(text) => setAge(capitalizeWords(text) ?? '')}
        autoCapitalize="words"
        autoComplete="off"
        returnKeyType="next"
      />

      <View style={styles.break} />
      <TextField
        label={t.children.form.parentName}
        value={parentName}
        onChangeText={(text) => setParentName(capitalizeName(text) ?? '')}
        autoCapitalize="words"
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="next"
      />
      <View style={styles.phone}>
        <TextField
          label={t.children.form.parentPhone}
          value={phone}
          onChangeText={(text) => {
            setOwner(null)
            setPhone(phoneDigits(text))
          }}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneMessage}
        />
        {owner && owner !== 'unknown' && (
          <Pressable onPress={() => openOwner(owner.id)} accessibilityRole="link" hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
            <Text variant="foot" weight="600" tone="accentInk">
              {t.children.form.openOwner}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.break} />
      <SelectField label={t.children.form.packageType} placeholder={t.children.form.packagePlaceholder} options={packageOptions} value={packageType} onChange={changePackage} />
      {free ? (
        <Notice>{t.children.form.freeNote}</Notice>
      ) : (
        <>
          <PeriodField
            label={t.children.form.period}
            hint={range ? undefined : t.children.form.periodHelp}
            startLabel={t.mobile.periodStart}
            endLabel={t.mobile.periodEnd}
            start={start}
            end={end}
            onStart={(next) => {
              setStart(next)
              if (end && end < next) setEnd(null)
            }}
            onEnd={setEnd}
          />
          {missingEnd && <Notice tone="negative">{row ? t.children.form.missingEndEdit : t.children.form.missingEnd}</Notice>}
          {hint && <Notice tone="action">{fmt(t.children.form[hint.key], { days: hint.days })}</Notice>}
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
          <View style={styles.break} />
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
            <PaymentFields method={method} onMethod={setMethod} amount={amount} onAmount={setAmount} date={date} onDate={setDate} suggestion={price} />
          )}
        </>
      )}

      <TextField label={t.children.form.note} placeholder={t.children.form.notePlaceholder} value={note} onChangeText={(text) => setNote(upperFirst(text) ?? '')} multiline />

      <SheetActions error={error}>
        <Button variant="primary" size="lg" disabled={!valid} busy={busy} onPress={() => void save()}>
          {row ? t.children.form.save : t.children.form.create}
        </Button>
      </SheetActions>
    </>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  // The extra space between the child, the parent, the package and the payment
  break: { height: 6 },
  phone: { gap: 8 },
  link: { alignSelf: 'flex-start', paddingHorizontal: 2 }
})
