import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useLocation, useNavigate } from 'react-router'
import { ArrowsClockwiseIcon, CoinsIcon, HandCoinsIcon, ReceiptIcon } from '@phosphor-icons/react'
import type { Registration, ResolvedExtension } from '@hellokido/core/api'
import { useActiveUsage, useChildEntries, useLabels, useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Skeleton } from '../../ui/Bits'
import { ChoiceList, type ChoiceItem } from '../../ui/ChoiceList'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { SearchField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { Sheet } from '../../ui/Sheet'
import { Peg } from '../../ui/signature'
import { IncomeEntryForm } from '../money/IncomeEntryForm'
import { UsageLine } from './ChildBits'
import { CollectForm } from './CollectForm'
import { ExtendForm, type FormState } from './ExtendForm'
import { RegistrationForm, type RegistrationPrefill } from './RegistrationForm'
import { byName, isFree, matchesChild } from './rules'

const IDLE: FormState = { dirty: false, busy: false }

type SheetProps = { isOpen: boolean; onOpenChange: (open: boolean) => void }

type RegistrationSheetProps = SheetProps & {
  registrationId?: string | null
  /** Starting values of a new registration, with a line saying where they came from. */
  prefill?: { values: RegistrationPrefill; source: string }
  onCreated?: (saved: Registration) => void
}

export function RegistrationSheet({ isOpen, onOpenChange, registrationId, prefill, onCreated }: RegistrationSheetProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const registrations = useRegistrations().data
  const row = registrationId ? registrations?.find((item) => item.id === registrationId) : null
  const [state, setState] = useState(IDLE)
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={registrationId ? t.children.form.editTitle : t.children.form.createTitle}
      description={row?.student_name ?? prefill?.source}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      {registrationId && !row ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : (
        <RegistrationForm
          registration={row}
          prefill={registrationId ? undefined : prefill?.values}
          onStateChange={setState}
          onDone={(saved) => {
            onOpenChange(false)
            if (registrationId || !saved?.id) return
            onCreated?.(saved)
            // A child registered from the children screen opens right away
            if (pathname.startsWith('/children')) navigate(`/children/${saved.id}`)
          }}
        />
      )}
    </Sheet>
  )
}

export type PaymentChoice = 'renew' | 'instalment' | 'collect' | 'fee'
export type PaymentParams = { registrationId?: string; choice?: PaymentChoice; entryId?: string }

/**
 * "Take a payment": pick the child, say what the money is for, fill in one short form. All four
 * paths live in one sheet so going back to change the choice never closes it.
 */
export function PaymentSheet({ isOpen, onOpenChange, params }: SheetProps & { params: PaymentParams }) {
  const { t, fmt, money, date } = useI18n()
  const labels = useLabels()
  const registrations = useRegistrations().data
  const usage = useActiveUsage().data
  const [childId, setChildId] = useState<string | null>(params.registrationId ?? null)
  const [choice, setChoice] = useState<PaymentChoice | null>(params.choice ?? null)
  const [entryId, setEntryId] = useState<string | null>(params.entryId ?? null)
  const [state, setState] = useState(IDLE)
  const [query, setQuery] = useState('')
  const [askBack, setAskBack] = useState<null | 'choice' | 'child'>(null)

  const row = registrations?.find((item) => item.id === childId) ?? null
  const entries = useChildEntries(childId ?? undefined).data
  const pendingEntries = (entries ?? []).filter((entry) => entry.payment_status === 'beklemede')
  const entry = pendingEntries.find((item) => item.id === entryId) ?? null
  const free = row ? isFree(row) : false
  const periodDue = Boolean(row && !free && row.payment_status === 'beklemede')

  // A choice that no longer fits (paid meanwhile, free child) falls back to the list of choices
  const usable =
    choice === 'fee' ||
    (choice === 'collect' && (entry || (periodDue && !entryId))) ||
    ((choice === 'renew' || choice === 'instalment') && row && !free && !periodDue)
  const waiting = (Boolean(params.registrationId) && !registrations) || (Boolean(entryId) && entries === undefined)
  const step: 'wait' | 'child' | 'choice' | 'form' = waiting ? 'wait' : !row ? 'child' : choice && usable ? 'form' : 'choice'

  const close = () => onOpenChange(false)
  const goBack = (to: 'choice' | 'child') => {
    setAskBack(null)
    setState(IDLE)
    setChoice(null)
    setEntryId(null)
    if (to === 'child') setChildId(null)
  }
  const requestBack = (to: 'choice' | 'child') => (state.dirty ? setAskBack(to) : goBack(to))

  const active = useMemo(
    () => (registrations ?? []).filter((item) => item.is_active === true && matchesChild(item, query)).sort(byName),
    [registrations, query]
  )

  const title =
    step !== 'form'
      ? t.children.payment.title
      : choice === 'renew'
        ? t.children.extend.renewTitle
        : choice === 'instalment'
          ? t.children.extend.instalmentTitle
          : choice === 'collect'
            ? t.children.collect.title
            : t.finance.entry.feeTitle

  const description = row ? (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span>{row.student_name}</span>
      {(step === 'form' || !params.registrationId) && (
        <AriaButton
          onPress={() => requestBack(step === 'form' ? 'choice' : 'child')}
          className="rounded-[0.375rem] text-[0.8125rem] font-semibold text-accent-ink underline-offset-2 outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-focus"
        >
          {t.children.payment.change}
        </AriaButton>
      )}
    </span>
  ) : undefined

  const choices: ChoiceItem<string>[] = []
  if (row) {
    if (periodDue) {
      choices.push({
        id: 'collect',
        title: t.children.payment.collect,
        hint: `${labels.packageName(row.package_type)} · ${t.children.payment.collectHint}`,
        icon: <HandCoinsIcon aria-hidden className="size-5" />,
        tone: 'action'
      })
    }
    for (const item of pendingEntries) {
      const due = item.due_date ? ` · ${fmt(t.children.detail.dueOn, { date: date(`${item.due_date}T00:00:00`, { day: 'numeric', month: 'long' }) })}` : ''
      choices.push({
        id: `entry:${item.id}`,
        title: item.description || t.children.detail.fee,
        hint: fmt(t.children.payment.collectEntryHint, { amount: money(item.amount) }) + due,
        icon: <HandCoinsIcon aria-hidden className="size-5" />,
        tone: 'action'
      })
    }
    if (!free && !periodDue) {
      choices.push(
        { id: 'renew', title: t.children.payment.renew, hint: t.children.payment.renewHint, icon: <ArrowsClockwiseIcon aria-hidden className="size-5" /> },
        { id: 'instalment', title: t.children.payment.instalment, hint: t.children.payment.instalmentHint, icon: <CoinsIcon aria-hidden className="size-5" /> }
      )
    }
    choices.push({ id: 'fee', title: t.children.payment.fee, hint: t.children.payment.feeHint, icon: <ReceiptIcon aria-hidden className="size-5" /> })
  }

  const choose = (id: string) => {
    setState(IDLE)
    if (id.startsWith('entry:')) {
      setEntryId(id.slice(6))
      setChoice('collect')
    } else {
      setEntryId(null)
      setChoice(id as PaymentChoice)
    }
  }

  return (
    <>
      <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={title} description={description} isDirty={state.dirty} isBusy={state.busy}>
        {step === 'wait' && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {step === 'child' && (
          <div className="flex flex-col gap-3">
            <SearchField value={query} onChange={setQuery} placeholder={t.children.payment.searchChild} label={t.children.payment.who} autoFocus />
            {!registrations ? (
              <div className="flex flex-col gap-2 pt-1">
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-12" />
                ))}
              </div>
            ) : active.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-ink-2">{t.children.payment.noChildren}</p>
            ) : (
              <ul aria-label={t.children.payment.who} className="-mx-2 flex flex-col">
                {active.map((item) => (
                  <li key={item.id}>
                    <AriaButton
                      onPress={() => setChildId(item.id)}
                      className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left outline-none data-hovered:bg-well data-pressed:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus"
                    >
                      <Peg seat={{ id: item.id, name: item.student_name, status: 'scheduled' }} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium text-ink">{item.student_name}</span>
                        <span className="block truncate text-[0.8125rem] text-ink-3">
                          {labels.packageName(item.package_type)} · {item.parent_name}
                        </span>
                      </span>
                    </AriaButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 'choice' && row && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-panel bg-surface-2 px-3 py-3">
              <Peg seat={{ id: row.id, name: row.student_name, status: 'scheduled' }} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] text-ink-2">{labels.packageName(row.package_type)}</p>
                <UsageLine usage={usage?.[row.id]} className="mt-1" />
              </div>
            </div>
            {free && <Notice>{t.children.payment.freeOnly}</Notice>}
            <ChoiceList aria-label={t.children.payment.whatFor} items={choices} onChoose={choose} />
            {periodDue && <p className="text-[0.8125rem] text-ink-3 text-pretty">{t.children.extend.pendingBlocked}</p>}
          </div>
        )}

        {step === 'form' && row && (choice === 'renew' || choice === 'instalment') && (
          <ExtendForm key={choice} registration={row} mode={choice} onDone={close} onStateChange={setState} />
        )}
        {step === 'form' && row && choice === 'collect' && (
          <CollectForm key={entry?.id ?? 'period'} registration={row} entry={entry} onDone={close} onStateChange={setState} />
        )}
        {step === 'form' && row && choice === 'fee' && <IncomeEntryForm kind="child" registrationId={row.id} onDone={close} onStateChange={setState} />}
      </Sheet>
      <ConfirmDialog
        isOpen={askBack !== null}
        onOpenChange={(open) => !open && setAskBack(null)}
        title={t.common.unsavedChanges}
        confirmLabel={t.common.discard}
        cancelLabel={t.common.keepEditing}
        tone="danger"
        onConfirm={() => askBack && goBack(askBack)}
      />
    </>
  )
}

export function ExtensionEditSheet({
  isOpen,
  onOpenChange,
  registration,
  extension
}: SheetProps & { registration: Registration; extension: ResolvedExtension }) {
  const { t } = useI18n()
  const [state, setState] = useState(IDLE)
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t.children.extend.editTitle}
      description={registration.student_name}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <ExtendForm registration={registration} mode="edit" extension={extension} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}
