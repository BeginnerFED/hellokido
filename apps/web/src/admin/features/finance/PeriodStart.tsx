import { useMemo, useState } from 'react'
import { startOfDay } from 'date-fns'
import { updateSetting } from '@hellokido/core/api'
import { cycleOf, parseStartDay } from '@hellokido/core/view'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Sheet, SheetActions } from '../../ui/Sheet'
import { periodLabel } from './period'

/** The day money periods start on (Settings › Money period); undefined until the settings are read. */
export const useStartDay = () => useCatalog().data?.settings.moneyPeriodStartDay

/** The start day as typed, what it gives today, and saving it; shared by Settings and Finance. */
function usePeriodStart(saved: number, onSaved?: (day: number) => void) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const refresh = useRefresh()
  const toast = useToast()
  // null: the field shows the saved value; typing makes a draft until it is saved
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = draft ?? String(saved)
  const day = parseStartDay(input)
  const changed = day !== null && day !== saved

  const today = useMemo(() => startOfDay(new Date()), [])
  const example = day !== null ? fmt(t.settings.period.example, { period: periodLabel(i18n, cycleOf(today, day)) }) : null

  const save = async () => {
    if (!changed || busy || day === null) return
    setBusy(true)
    try {
      await updateSetting('money_period_start_day', day)
      await refresh.catalog()
      setDraft(null)
      toast({ tone: 'success', title: t.settings.period.saved })
      onSaved?.(day)
    } catch {
      void refresh.catalog()
      toast({ tone: 'error', title: t.settings.period.failed })
    } finally {
      setBusy(false)
    }
  }

  const field = (
    <TextField
      label={t.settings.period.day}
      value={input}
      onChange={(text) => setDraft(text.replace(/\D/g, '').slice(0, 2))}
      inputMode="numeric"
      autoComplete="off"
      inputClassName="tabular"
      description={t.settings.period.hint}
      errorMessage={draft !== null && day === null ? t.settings.period.invalid : undefined}
      className="sm:max-w-[18rem]"
    />
  )
  return { field, example, changed, busy, save }
}

/** Settings › Money period. */
export function PeriodStartSettings() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const saved = catalog.data?.settings.moneyPeriodStartDay
  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (saved === undefined) return <Skeleton className="h-[6.5rem]" />
  return <InlineForm saved={saved} />
}

function InlineForm({ saved }: { saved: number }) {
  const { t } = useI18n()
  const form = usePeriodStart(saved)
  return (
    <div className="flex flex-col gap-4">
      {form.field}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {form.example && <p className="min-w-0 flex-1 basis-[18rem] text-sm text-ink-2 text-pretty first-letter:uppercase">{form.example}</p>}
        {/* Turns blue once there is something to save */}
        <Button variant={form.changed ? 'primary' : 'secondary'} isDisabled={!form.changed} isPending={form.busy} onPress={() => void form.save()}>
          {t.common.save}
        </Button>
      </div>
    </div>
  )
}

/** The same setting, opened from Finance's period menu; once saved, Finance moves to the period that holds today. */
export function PeriodStartSheet({
  isOpen,
  onOpenChange,
  saved,
  onSaved
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  saved: number
  onSaved: (day: number) => void
}) {
  const { t } = useI18n()
  const form = usePeriodStart(saved, (day) => {
    onSaved(day)
    onOpenChange(false)
  })
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t.settings.period.title}
      footer={
        <SheetActions>
          <Button variant="secondary" onPress={() => onOpenChange(false)} className="max-md:flex-1">
            {t.common.cancel}
          </Button>
          <Button variant="primary" isDisabled={!form.changed} isPending={form.busy} onPress={() => void form.save()} className="max-md:flex-1">
            {t.common.save}
          </Button>
        </SheetActions>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2 text-pretty">{t.settings.period.body}</p>
        {form.field}
        {form.example && <p className="text-sm text-ink-2">{form.example}</p>}
      </div>
    </Sheet>
  )
}
