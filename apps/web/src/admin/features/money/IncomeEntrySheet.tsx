import { useState } from 'react'
import type { IncomeEntry } from '@hellokido/core/api'
import { useRegistrations } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { Sheet } from '../../ui/Sheet'
import { IncomeEntryForm, type FormState } from './IncomeEntryForm'

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  kind: 'child' | 'other'
  registrationId?: string | null
  entry?: IncomeEntry | null
  /** An expected entry that has now been paid: the form starts as received. */
  collect?: boolean
}

/** A fee of a child or other income of the workshop, new or corrected. */
export function IncomeEntrySheet({ isOpen, onOpenChange, kind, registrationId, entry, collect }: Props) {
  const { t } = useI18n()
  const registrations = useRegistrations(kind === 'child').data
  const childId = registrationId ?? entry?.registration_id ?? null
  const child = childId ? registrations?.find((row) => row.id === childId) : null
  const [state, setState] = useState<FormState>({ dirty: false, busy: false })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={
        entry && collect && entry.payment_status === 'beklemede'
          ? t.finance.entry.collectTitle
          : entry
            ? t.finance.entry.editTitle
            : kind === 'child'
              ? t.finance.entry.feeTitle
              : t.finance.entry.otherTitle
      }
      description={child?.student_name ?? (collect ? entry?.description : undefined)}
      isDirty={state.dirty}
      isBusy={state.busy}
    >
      <IncomeEntryForm
        kind={kind}
        registrationId={childId}
        entry={entry}
        collect={collect}
        onDone={() => onOpenChange(false)}
        onStateChange={setState}
      />
    </Sheet>
  )
}
