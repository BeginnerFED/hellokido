import { useMemo, useRef, useState } from 'react'
import { Alert, type TextInputInstance } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { startOfDay } from 'date-fns'
import { addWaitlistEntry, deleteWaitlistEntry, listWaitlist, updateWaitlistEntry, WAITLIST_PACKAGES, type WaitlistEntry, type WaitlistFields } from '@hellokido/core/api'
import { localDateKey } from '@hellokido/core/rules/dates.js'
import { isValidPhone, normalizePhone, phoneDigits } from '@hellokido/core/rules/phone.js'
import { capitalizeName, capitalizeWords, upperFirst } from '@hellokido/core/rules/text.js'
import { askedOn, CONTACTED, UNDECIDED, WAITING, type WaitStatus } from '@hellokido/core/view'
import { keys, useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { DateField, Segmented, SelectField, TextField } from '../../ui/Fields'
import { CardButton, FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'

/** A family who asked for a place: added when they call, changed when something new is heard. */
export function WaitlistSheet({ id }: { id?: string }) {
  const { t } = useI18n()
  const list = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist, enabled: Boolean(id) })
  const entry = id ? (list.data?.find((row) => row.id === id) ?? null) : null

  if (!id || entry) return <WaitlistForm entry={entry} />
  return (
    <SheetScreen title={t.waitlist.form.editTitle}>
      {list.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <EmptyState
          icon="info"
          title={list.isError ? t.common.loadFailed : t.waitlist.form.notFound}
          action={
            list.isError ? (
              <Button size="sm" icon="refresh" busy={list.isFetching} onPress={() => void list.refetch()}>
                {t.common.retry}
              </Button>
            ) : undefined
          }
        />
      )}
    </SheetScreen>
  )
}

function WaitlistForm({ entry }: { entry: WaitlistEntry | null }) {
  const { t, fmt } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()

  // A new entry starts on today and as waiting, the way families usually ask
  const [initial] = useState(() => ({
    child: entry?.student_name ?? '',
    age: entry?.student_age ?? '',
    parent: entry?.parent_name ?? '',
    phone: entry?.parent_phone ?? '',
    pkg: entry?.package_type ?? UNDECIDED,
    day: (entry && askedOn(entry)) ?? startOfDay(new Date()),
    status: (entry?.status === CONTACTED ? CONTACTED : WAITING) as WaitStatus,
    note: entry?.notes ?? ''
  }))

  const [child, setChild] = useState(initial.child)
  const [age, setAge] = useState(initial.age)
  const [parent, setParent] = useState(initial.parent)
  const [phone, setPhone] = useState(initial.phone)
  const [pkg, setPkg] = useState<string>(initial.pkg)
  const [day, setDay] = useState<Date | null>(initial.day)
  const [status, setStatus] = useState<WaitStatus>(initial.status)
  const [note, setNote] = useState(initial.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The number is checked once the person leaves the box, not at the first digit typed
  const [phoneLeft, setPhoneLeft] = useState(false)
  // "Next" on the keyboard goes on to the following box
  const ageRef = useRef<TextInputInstance>(null)
  const parentRef = useRef<TextInputInstance>(null)
  const phoneRef = useRef<TextInputInstance>(null)

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

  const packageOptions = useMemo(() => WAITLIST_PACKAGES.map((code) => ({ id: code, label: labels.packageName(code) })), [labels])

  const save = async () => {
    if (!valid || busy || !day) return
    if (entry && Object.keys(changes).length === 0) return sheet.finish()
    setBusy(true)
    setError(null)
    try {
      if (entry) {
        await updateWaitlistEntry(entry.id, changes)
        toast({ title: t.waitlist.form.updated })
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
        toast({ title: fmt(t.waitlist.form.saved, { name: child.trim() }) })
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      void refresh.waitlist()
      sheet.finish()
    } catch (caught) {
      if (String((caught as Error)?.message).includes('not_found')) {
        toast({ tone: 'warning', title: t.waitlist.form.notFound })
        void refresh.waitlist()
        sheet.finish()
        return
      }
      setError(t.waitlist.form.failed)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!entry) return
    Alert.alert(t.waitlist.form.deleteTitle, fmt(t.waitlist.form.deleteBody, { child: entry.student_name, parent: entry.parent_name }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          setError(null)
          try {
            const found = await deleteWaitlistEntry(entry.id)
            toast(found ? { title: t.waitlist.form.deleted } : { tone: 'warning', title: t.waitlist.form.alreadyDeleted })
            void refresh.waitlist()
            sheet.finish()
          } catch {
            setError(t.waitlist.form.deleteFailed)
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  // The child, the parent, what they asked about and a note: each a group, as a contact card is laid out
  return (
    <SheetScreen
      title={entry ? t.waitlist.form.editTitle : t.waitlist.form.newTitle}
      subtitle={entry?.student_name}
      dirty={dirty}
      busy={busy}
      // A new family is added, a known one saved, as the phone's own forms say it
      // A known family waits for a change before it can be saved
      action={{ label: entry ? t.waitlist.form.save : t.common.add, disabled: !valid || (entry !== null && !dirty), onPress: () => void save() }}
    >
      <FormGroup>
        <TextField
          label={t.waitlist.form.childName}
          value={child}
          onChangeText={(text) => setChild(capitalizeName(text) ?? '')}
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect={false}
          autoFocus={!entry}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => ageRef.current?.focus()}
        />
        <TextField
          ref={ageRef}
          label={t.waitlist.form.age}
          placeholder={t.waitlist.form.agePlaceholder}
          value={age}
          onChangeText={(text) => setAge(capitalizeWords(text) ?? '')}
          autoCapitalize="words"
          autoComplete="off"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => parentRef.current?.focus()}
        />
      </FormGroup>
      <FormGroup>
        <TextField
          ref={parentRef}
          label={t.waitlist.form.parentName}
          value={parent}
          onChangeText={(text) => setParent(capitalizeName(text) ?? '')}
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <TextField
          ref={phoneRef}
          label={t.waitlist.form.phone}
          value={phone}
          onChangeText={(text) => setPhone(phoneDigits(text))}
          onBlur={() => setPhoneLeft(true)}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phone && !phoneOk && phoneLeft ? t.waitlist.form.phoneHint : undefined}
        />
      </FormGroup>
      <FormGroup>
        <SelectField label={t.waitlist.form.package} placeholder={t.waitlist.form.package} options={packageOptions} value={pkg} onChange={setPkg} />
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
      </FormGroup>
      <FormGroup>
        <TextField
          label={t.waitlist.form.note}
          placeholder={t.waitlist.form.notePlaceholder}
          value={note}
          onChangeText={(text) => setNote(upperFirst(text) ?? '')}
          multiline
        />
      </FormGroup>
      <SheetActions error={error}>{entry && <CardButton label={t.waitlist.delete} destructive disabled={busy} onPress={remove} />}</SheetActions>
    </SheetScreen>
  )
}

