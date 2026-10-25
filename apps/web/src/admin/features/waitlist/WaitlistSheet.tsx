import { useEffect, useMemo, useRef, useState } from 'react'
import { startOfDay } from 'date-fns'
import { TrashIcon } from '@phosphor-icons/react'
import {
  addWaitlistEntry,
  deleteWaitlistEntry,
  updateWaitlistEntry,
  WAITLIST_PACKAGES,
  type WaitlistEntry,
  type WaitlistFields
} from '@hellokido/core/api'
import { localDateKey } from '@hellokido/core/rules/dates.js'
import { isValidPhone, normalizePhone, phoneDigits } from '@hellokido/core/rules/phone.js'
import { capitalizeName, capitalizeWords, upperFirst } from '@hellokido/core/rules/text.js'
import { useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Button } from '../../ui/Button'
import { Segmented, Select } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DateField } from '../../ui/DateField'
import { TextArea, TextField } from '../../ui/Field'
import { FormRule } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { keepCaret } from '../../ui/caret'
import { askedOn, CONTACTED, UNDECIDED, WAITING, type WaitStatus } from './rules'

export type WaitlistParams = { entry?: WaitlistEntry }

type FormState = { dirty: boolean; busy: boolean }

export function WaitlistSheet({ isOpen, onOpenChange, params }: { isOpen: boolean; onOpenChange: (open: boolean) => void; params: WaitlistParams }) {
  const { t } = useI18n()
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={params.entry ? t.waitlist.form.editTitle : t.waitlist.form.newTitle}
      description={params.entry?.student_name}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <WaitlistForm entry={params.entry} onDone={() => onOpenChange(false)} onStateChange={setState} />
    </Sheet>
  )
}

function WaitlistForm({ entry, onDone, onStateChange }: { entry?: WaitlistEntry; onDone: () => void; onStateChange: (state: FormState) => void }) {
  const { t, fmt } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const childRef = useRef<HTMLInputElement>(null)
  const ageRef = useRef<HTMLInputElement>(null)
  const parentRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // A new entry starts on today and as waiting, the way families usually ask
  const initial = useMemo(
    () => ({
      child: entry?.student_name ?? '',
      age: entry?.student_age ?? '',
      parent: entry?.parent_name ?? '',
      phone: entry?.parent_phone ?? '',
      pkg: entry?.package_type ?? UNDECIDED,
      day: (entry && askedOn(entry)) ?? startOfDay(new Date()),
      status: (entry?.status === CONTACTED ? CONTACTED : WAITING) as WaitStatus,
      note: entry?.notes ?? ''
    }),
    [entry]
  )

  const [child, setChild] = useState(initial.child)
  const [age, setAge] = useState(initial.age)
  const [parent, setParent] = useState(initial.parent)
  const [phone, setPhone] = useState(initial.phone)
  const [pkg, setPkg] = useState<string>(initial.pkg)
  const [day, setDay] = useState<Date | null>(initial.day)
  const [status, setStatus] = useState<WaitStatus>(initial.status)
  const [note, setNote] = useState(initial.note)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // An old number that is too short does not block other edits; only a changed one is checked
  const phoneEdited = !entry || phoneDigits(phone) !== phoneDigits(entry.parent_phone)
  const phoneOk = phoneEdited ? isValidPhone(phone) : phone.trim() !== ''

  // Only what changed is sent, so another admin's edit of the other fields is kept
  const changes = useMemo<Partial<WaitlistFields>>(() => {
    if (!entry) return {}
    const diff: Partial<WaitlistFields> = {}
    if (child.trim() !== entry.student_name) diff.student_name = child.trim()
    if (age.trim() !== entry.student_age) diff.student_age = age.trim()
    if (parent.trim() !== entry.parent_name) diff.parent_name = parent.trim()
    if (phoneEdited) diff.parent_phone = normalizePhone(phone)
    if (pkg !== entry.package_type) diff.package_type = pkg
    if (day && localDateKey(day) !== entry.contact_date) diff.contact_date = localDateKey(day)
    if (status !== entry.status) diff.status = status
    if (note.trim() !== (entry.notes ?? '').trim()) diff.notes = note.trim() || null
    return diff
  }, [entry, child, age, parent, phone, phoneEdited, pkg, day, status, note])

  const valid = Boolean(child.trim() && age.trim() && parent.trim() && phoneOk && pkg && day)
  const dirty = entry
    ? Object.keys(changes).length > 0
    : Boolean(child || age || parent || phone || note) || pkg !== initial.pkg || status !== initial.status || day?.getTime() !== initial.day.getTime()
  useEffect(() => onStateChange({ dirty, busy }), [dirty, busy, onStateChange])

  const packageOptions = useMemo(() => WAITLIST_PACKAGES.map((code) => ({ id: code, label: labels.packageName(code) })), [labels])

  const save = async () => {
    if (!valid || busy || !day) return
    if (entry && Object.keys(changes).length === 0) return onDone()
    setBusy(true)
    try {
      if (entry) {
        await updateWaitlistEntry(entry.id, changes)
        toast({ tone: 'success', title: t.waitlist.form.updated })
      } else {
        await addWaitlistEntry({
          student_name: child.trim(),
          student_age: age.trim(),
          parent_name: parent.trim(),
          parent_phone: normalizePhone(phone),
          package_type: pkg,
          contact_date: localDateKey(day),
          status,
          notes: note.trim() || null
        })
        toast({ tone: 'success', title: fmt(t.waitlist.form.saved, { name: child.trim() }) })
      }
      void refresh.waitlist()
      onDone()
    } catch (error) {
      if (String((error as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.waitlist.form.notFound })
        void refresh.waitlist()
        onDone()
        return
      }
      toast({ tone: 'error', title: t.waitlist.form.failed })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!entry) return
    setBusy(true)
    try {
      const found = await deleteWaitlistEntry(entry.id)
      setConfirming(false)
      toast(found ? { tone: 'success', title: t.waitlist.form.deleted } : { tone: 'warning', title: t.waitlist.form.alreadyDeleted })
      void refresh.waitlist()
      onDone()
    } catch {
      toast({ tone: 'error', title: t.waitlist.form.deleteFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <TextField
          ref={childRef}
          label={t.waitlist.form.childName}
          value={child}
          onChange={(text) => keepCaret(childRef.current, text, (value) => capitalizeName(value) ?? '', setChild)}
          autoComplete="off"
          autoFocus={!entry}
        />
        <TextField
          ref={ageRef}
          label={t.waitlist.form.age}
          placeholder={t.waitlist.form.agePlaceholder}
          value={age}
          onChange={(text) => keepCaret(ageRef.current, text, (value) => capitalizeWords(value) ?? '', setAge)}
          autoComplete="off"
        />
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          ref={parentRef}
          label={t.waitlist.form.parentName}
          value={parent}
          onChange={(text) => keepCaret(parentRef.current, text, (value) => capitalizeName(value) ?? '', setParent)}
          autoComplete="off"
        />
        <TextField
          ref={phoneRef}
          label={t.waitlist.form.phone}
          value={phone}
          onChange={(text) => keepCaret(phoneRef.current, text, (value) => phoneDigits(value), setPhone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          errorMessage={phone && !phoneOk ? t.waitlist.form.phoneHint : undefined}
        />
      </div>

      <FormRule />

      <Select label={t.waitlist.form.package} options={packageOptions} value={pkg} onChange={setPkg} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <DateField label={t.waitlist.form.contactDate} value={day} onChange={setDay} shortcuts />
        <Segmented<WaitStatus>
          label={t.waitlist.form.status}
          options={[
            { id: WAITING, label: t.waitlist.form.statusWaiting },
            { id: CONTACTED, label: t.waitlist.form.statusContacted }
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>
      <TextArea
        ref={noteRef}
        label={t.waitlist.form.note}
        placeholder={t.waitlist.form.notePlaceholder}
        value={note}
        onChange={(text) => keepCaret(noteRef.current, text, (value) => upperFirst(value) ?? '', setNote)}
        rows={2}
      />

      <SheetFooter>
        <SheetActions
          start={
            entry && (
              <Button variant="danger-soft" icon={<TrashIcon aria-hidden className="size-4" />} onPress={() => setConfirming(true)} isDisabled={busy}>
                {t.waitlist.delete}
              </Button>
            )
          }
        >
          <Button variant="primary" isDisabled={!valid || (Boolean(entry) && !dirty)} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
            {t.waitlist.form.save}
          </Button>
        </SheetActions>
      </SheetFooter>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t.waitlist.form.deleteTitle}
        body={entry && fmt(t.waitlist.form.deleteBody, { child: entry.student_name, parent: entry.parent_name })}
        confirmLabel={t.common.delete}
        tone="danger"
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
