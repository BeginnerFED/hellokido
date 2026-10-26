import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  carrySource,
  extendRegistration,
  previewExtension,
  registrationError,
  startsNewPeriod,
  updateExtension,
  type PaymentMethod,
  type Registration,
  type ResolvedExtension
} from '@hellokido/core/api'
import { MAX_EXTRA_LESSONS } from '@hellokido/core/rules/lessonUsage.js'
import { formatAmountForInput, isPositiveAmount, parseAmount } from '@hellokido/core/rules/money.js'
import { packageEndFor } from '@hellokido/core/rules/packagePeriod.js'
import { upperFirst } from '@hellokido/core/rules/text.js'
import { useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select } from '../../ui/Choice'
import { DateField } from '../../ui/DateField'
import { TextArea } from '../../ui/Field'
import { FormRule, Notice, type NoticeTone } from '../../ui/Notice'
import { SheetActions, SheetFooter } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { keepCaret } from '../../ui/caret'
import { PaymentFields } from '../money/PaymentFields'
import { usePackageOptions, usePackagePrice } from './packageOptions'
import { FREE, sameInstant } from './rules'

export type ExtendMode = 'renew' | 'instalment' | 'edit'

export type FormState = { dirty: boolean; busy: boolean }

type Props = {
  /** The row the person looked at; in edit mode the fresh row the history was read with. */
  registration: Registration
  mode: ExtendMode
  /** The last extension, resolved against the ledger (edit mode). */
  extension?: ResolvedExtension | null
  onDone: () => void
  onStateChange?: (state: FormState) => void
}

const dateOf = (value: string | null | undefined) => (value ? new Date(value) : null)

type Period = { type: string; start: Date; end: Date }

const periodOf = (row: Pick<Registration, 'package_type' | 'package_start_date' | 'package_end_date'>): Period => ({
  type: row.package_type,
  start: new Date(row.package_start_date),
  end: new Date(row.package_end_date)
})

/**
 * A payment that opens a new period, pays for the current one (instalment), or corrects the last
 * one. Every package payment goes through the database functions; the lessons carried over are read
 * again right before saving, never taken from the preview.
 */
export function ExtendForm({ registration, mode, extension, onDone, onStateChange }: Props) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const toast = useToast()
  const refresh = useRefresh()
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const initial = useMemo(() => {
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
        date: dateOf(extension.payment_date),
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
    // The form starts from what was on screen when it opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [packageType, setPackageType] = useState(initial.packageType)
  const [start, setStart] = useState<Date | null>(initial.start)
  const [startTouched, setStartTouched] = useState(false)
  const [status, setStatus] = useState(initial.status)
  const [method, setMethod] = useState<PaymentMethod | null>(initial.method)
  const [amount, setAmount] = useState(initial.amount)
  const [date, setDate] = useState<Date | null>(initial.date)
  const [note, setNote] = useState(initial.note)
  const [extra, setExtra] = useState(0)
  const [busy, setBusy] = useState(false)

  const source = useQuery({
    queryKey: ['carry', registration.id],
    queryFn: () => carrySource(registration.id),
    enabled: mode !== 'edit',
    staleTime: 0,
    gcTime: 0,
    retry: 0
  })
  const current = source.data?.registration ?? registration

  // An instalment pays for the period as the database has it now, not as the list showed it
  useEffect(() => {
    if (mode === 'instalment' && source.data && !startTouched) setStart(new Date(source.data.registration.package_start_date))
  }, [mode, source.data, startTouched])

  // The last day is never chosen. A payment that keeps its period (an instalment, a correction)
  // keeps the stored last day; any other follows the first day and the package.
  const kept = mode === 'edit' ? initial.period : periodOf(current)
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
  const preview = mode === 'edit' ? null : previewExtension(source.data ?? null, packageType, start, extra)

  let notice: { tone: NoticeTone; text: string } | null = null
  if (mode !== 'edit' && start && packageType) {
    const extraNote = preview && preview.extra > 0 ? fmt(t.children.extend.extraNote, { count: preview.extra }) : ''
    const numbers = { total: preview?.total ?? 0, remaining: preview?.remaining ?? 0, carried: preview?.carried ?? 0, extra: extraNote }
    if (source.data && !movesPeriod && packageType === 'tek-seferlik') notice = { tone: 'info', text: t.children.extend.singleSameDay }
    else if (preview?.samePackage) notice = { tone: 'info', text: fmt(movesPeriod ? t.children.extend.placeholder : t.children.extend.samePackage, numbers) }
    else if (preview && preview.carried > 0) notice = { tone: 'positive', text: fmt(t.children.extend.carried, numbers) }
    else if (preview && preview.extra > 0) notice = { tone: 'info', text: fmt(t.children.extend.extraOnly, numbers) }
  }

  const minDate = useMemo(() => {
    if (mode === 'edit' && extension) {
      const days = [extension.previous_start_date, extension.previous_end_date, extension.new_start_date]
        .filter(Boolean)
        .map((value) => new Date(value as string).getTime())
      return days.length ? new Date(Math.min(...days)) : null
    }
    return new Date(current.package_start_date)
  }, [mode, extension, current.package_start_date])

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

  useEffect(() => onStateChange?.({ dirty, busy }), [dirty, busy, onStateChange])

  const save = async () => {
    if (!valid || busy || !start || !packageType) return
    // A panel left open on another child must never write under this child's name
    if (mode === 'edit' && extension?.registration_id !== registration.id) return
    setBusy(true)
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
      if (mode === 'edit' && extension) {
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
      refresh.children(registration.id)
      onDone()
    } catch (error) {
      const kind = registrationError(error)
      if (kind === 'stale' || kind === 'not_found') {
        toast({ tone: 'warning', title: t.children.form.stale })
        refresh.children(registration.id)
        onDone()
        return
      }
      toast({
        tone: 'error',
        title:
          kind === 'pending_payment'
            ? t.children.extend.pendingBlocked
            : kind === 'free_registration'
              ? t.children.extend.freeBlocked
              : kind === 'invalid_period'
                ? t.children.form.invalidPeriod
                : t.children.extend.failed
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Select
        label={t.children.form.packageType}
        placeholder={t.children.form.packagePlaceholder}
        options={packageOptions}
        value={packageType}
        onChange={setPackageType}
      />
      <DateField
        label={t.children.form.start}
        value={start}
        onChange={(next) => {
          setStart(next)
          setStartTouched(true)
        }}
        minValue={minDate}
        description={start ? undefined : t.children.form.startHelp}
        shortcuts={mode === 'renew'}
      />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {mode !== 'edit' && (
        <Stepper
          label={t.children.extend.addExtra}
          value={extra}
          onChange={setExtra}
          max={MAX_EXTRA_LESSONS}
          decreaseLabel={t.children.form.extraDecrease}
          increaseLabel={t.children.form.extraIncrease}
        />
      )}
      <FormRule />
      <Segmented
        label={t.children.form.status}
        options={[
          { id: 'odendi', label: t.children.form.paid },
          { id: 'beklemede', label: t.children.form.pending }
        ]}
        value={status}
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
          <Button variant="primary" isDisabled={!valid || (mode === 'edit' && !dirty)} isPending={busy} onPress={save} className="max-md:flex-1">
            {mode === 'edit' ? t.common.save : t.children.extend.save}
          </Button>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}
