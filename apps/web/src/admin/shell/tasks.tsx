import { useEffect, useMemo, useState } from 'react'
import type { IncomeEntry, WaitlistEntry } from '@hellokido/core/api'
import { useRegistrations } from '../data/queries'
import { LessonSheet, type LessonParams } from '../features/calendar/LessonSheet'
import { PaymentSheet, RegistrationSheet, type PaymentParams } from '../features/children/sheets'
import { ExpenseSheet, type ExpenseParams } from '../features/finance/ExpenseSheet'
import { IncomeEntrySheet } from '../features/money/IncomeEntrySheet'
import { NoteSheet, type NoteParams } from '../features/notes/NoteSheet'
import { useTakeOffWaitlist } from '../features/waitlist/handoff'
import { prefillFrom } from '../features/waitlist/rules'
import { WaitlistSheet, type WaitlistParams } from '../features/waitlist/WaitlistSheet'
import { useI18n } from '../providers/I18n'
import type { TaskRequest } from './Actions'

/** Children for the command palette: name first, parent and phone so either one finds them. */
export function usePaletteChildren(enabled: boolean) {
  const { data } = useRegistrations(enabled)
  return useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.student_name,
        detail: [row.parent_name, row.parent_phone, row.is_active === false ? '·' : ''].filter(Boolean).join(' · ')
      })),
    [data]
  )
}

/**
 * Renders the sheet of the task that was started from quick add, the palette or a page button. The
 * last task stays rendered while its sheet slides out; a new request gets a fresh form.
 */
export function TaskHost({ task, onDone }: { task: TaskRequest | null; onDone: () => void }) {
  const { t } = useI18n()
  const takeOffWaitlist = useTakeOffWaitlist()
  const [shown, setShown] = useState<TaskRequest | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!task) return
    setShown(task)
    setOpen(true)
  }, [task])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) onDone()
  }

  if (!shown) return null
  const params = shown.params ?? {}
  switch (shown.kind) {
    case 'registration': {
      // A family from the waitlist: the form starts from what they told us, and the entry goes once registered
      const fromWaitlist = params.fromWaitlist as WaitlistEntry | undefined
      return (
        <RegistrationSheet
          key={shown.id}
          isOpen={open}
          onOpenChange={onOpenChange}
          registrationId={params.registrationId as string | undefined}
          prefill={fromWaitlist && { values: prefillFrom(fromWaitlist), source: t.waitlist.fromWaitlist }}
          onCreated={fromWaitlist && (() => void takeOffWaitlist(fromWaitlist))}
        />
      )
    }
    case 'payment':
      return <PaymentSheet key={shown.id} isOpen={open} onOpenChange={onOpenChange} params={params as PaymentParams} />
    case 'income':
      return (
        <IncomeEntrySheet
          key={shown.id}
          isOpen={open}
          onOpenChange={onOpenChange}
          kind={params.kind === 'child' ? 'child' : 'other'}
          registrationId={params.registrationId as string | undefined}
          entry={params.entry as IncomeEntry | undefined}
          collect={params.collect === true}
        />
      )
    case 'expense':
      return <ExpenseSheet key={shown.id} isOpen={open} onOpenChange={onOpenChange} params={params as ExpenseParams} />
    case 'lesson':
      return <LessonSheet key={shown.id} isOpen={open} onOpenChange={onOpenChange} params={params as LessonParams} />
    case 'waitlist':
      return <WaitlistSheet key={shown.id} isOpen={open} onOpenChange={onOpenChange} params={params as WaitlistParams} />
    case 'note':
      return <NoteSheet key={shown.id} isOpen={open} onOpenChange={onOpenChange} params={params as NoteParams} />
    default:
      return null
  }
}
