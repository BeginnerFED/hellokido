import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, startOfDay } from 'date-fns'
import { childrenOfWeek, copyWeek, type Registration } from '@hellokido/core/api'
import { weeksBetween } from '@hellokido/core/rules/dates.js'
import { useRefresh, useUsageOf } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Button } from '../../ui/Button'
import { RadioList } from '../../ui/Choice'
import { DateField } from '../../ui/DateField'
import { fieldLabelClass } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { Sheet, SheetActions } from '../../ui/Sheet'
import { cx } from '../../ui/cx'
import { shortDate } from '../children/ChildBits'
import { byName, isFree } from '../children/rules'
import { dateRange } from './labels'

type Target = 'next' | 'two' | 'custom'

const NONE: Registration[] = []
const FIRST_ROWS = 5
const SLOTS_LISTED = 6

/**
 * Copies every lesson of one week, with its children, to another week in one go: either all of it
 * is written or nothing is. Before that it shows what will be copied, which times are already
 * taken, and which children have no lessons left, so they can be left out or renewed first.
 */
export function CopyWeekSheet({
  isOpen,
  onOpenChange,
  source,
  onGoToWeek
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Monday 00:00 of the week to copy. */
  source: Date
  onGoToWeek: (monday: Date) => void
}) {
  const i18n = useI18n()
  const { t, fmt, plural, date } = i18n
  const toast = useToast()
  const refresh = useRefresh()
  const { startTask } = useActions()
  const [target, setTarget] = useState<Target>('next')
  const [customDay, setCustomDay] = useState<Date | null>(() => addDays(source, 7))
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [unfolded, setUnfolded] = useState(false)
  const [copying, setCopying] = useState(false)

  const weeks = target === 'next' ? 1 : target === 'two' ? 2 : weeksBetween(source, customDay)
  const valid = weeks !== null && weeks !== 0
  const targetStart = valid ? addDays(source, weeks * 7) : null
  const sourceIso = source.toISOString()

  const preview = useQuery({
    queryKey: ['lessons', 'copy-preview', sourceIso, weeks],
    queryFn: () => copyWeek(source, weeks!, [], true),
    enabled: isOpen && valid,
    staleTime: 0,
    retry: false
  })

  const children = useQuery({
    queryKey: ['lessons', 'copy-children', sourceIso],
    queryFn: () => childrenOfWeek(source),
    enabled: isOpen
  })
  const usage = useUsageOf(children.data ?? NONE)
  const checking = children.isPending || (Boolean(children.data?.length) && !usage)

  const { exhausted, archived } = useMemo(() => {
    const rows = children.data ?? NONE
    return {
      exhausted: rows
        .filter((row) => row.is_active === true && !isFree(row) && (usage?.[row.id]?.remaining ?? 1) <= 0)
        .sort((a, b) => (a.package_end_date ?? '').localeCompare(b.package_end_date ?? '') || byName(a, b)),
      archived: rows.filter((row) => row.is_active !== true).sort(byName)
    }
  }, [children.data, usage])
  const shownRows = unfolded || exhausted.length <= FIRST_ROWS + 1 ? exhausted : exhausted.slice(0, FIRST_ROWS)
  const leftOut = exhausted.filter((row) => excluded.has(row.id)).length

  const toggle = (row: Registration) =>
    setExcluded((set) => {
      const next = new Set(set)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })

  const weekRange = (monday: Date) => dateRange(i18n, monday, addDays(monday, 6), { day: 'numeric', month: 'long' })

  const copy = async () => {
    if (!valid || !targetStart) return
    setCopying(true)
    try {
      const result = await copyWeek(source, weeks, [...excluded], false)
      refresh.lessons()
      const range = { from: date(targetStart, { day: 'numeric', month: 'long' }), to: date(addDays(targetStart, 6), { day: 'numeric', month: 'long' }) }
      if (result.copied > 0) {
        const slots = result.skipped_slots.slice(0, SLOTS_LISTED).map((slot) => date(slot, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
        const extra = result.skipped_slots.length - slots.length
        const skippedLine = result.skipped
          ? ` ${fmt(t.calendar.copy.skippedSlots, { slots: [...slots, ...(extra > 0 ? [fmt(t.calendar.copy.moreSlots, { count: extra })] : [])].join(', ') })}`
          : ''
        toast({
          tone: result.skipped ? 'warning' : 'success',
          title: result.skipped ? fmt(t.calendar.copy.doneSkipped, { copied: result.copied, skipped: result.skipped }) : plural(t.calendar.copy.done, result.copied),
          body: fmt(t.calendar.copy.doneBody, range) + skippedLine,
          action: { label: t.calendar.copy.goToWeek, onAction: () => onGoToWeek(targetStart) },
          sticky: result.skipped > 0
        })
      } else if (result.skipped > 0) {
        toast({ tone: 'warning', title: t.calendar.copy.nothingAdded })
      } else {
        toast({ tone: 'error', title: t.calendar.copy.nothingToCopy })
      }
      onOpenChange(false)
    } catch (error) {
      const failure = error as { code?: string; message?: string }
      toast({
        tone: 'error',
        title:
          failure.code === '42501'
            ? t.calendar.copy.needsAdmin
            : String(failure.message ?? '').includes('invalid_target_week')
              ? t.calendar.copy.invalidTarget
              : t.calendar.copy.failed
      })
    } finally {
      setCopying(false)
    }
  }

  const result = preview.data
  const nothingToCopy = result ? result.copied === 0 : false

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isBusy={copying}
      title={t.calendar.copy.title}
      description={`${t.calendar.copy.source}: ${weekRange(source)}`}
      footer={
        <SheetActions
          start={
            <Button variant="quiet" onPress={() => onOpenChange(false)} isDisabled={copying}>
              {t.common.cancel}
            </Button>
          }
        >
          <Button variant="primary" onPress={() => void copy()} isPending={copying} isDisabled={!valid || nothingToCopy || checking} className="max-md:flex-1">
            {t.calendar.copy.action}
          </Button>
        </SheetActions>
      }
    >
      <div className="flex flex-col gap-6 pt-1">
        <div className="flex flex-col gap-3">
          <RadioList<Target>
            label={t.calendar.copy.target}
            options={[
              { id: 'next', label: t.calendar.copy.nextWeek, description: weekRange(addDays(source, 7)) },
              { id: 'two', label: t.calendar.copy.inTwoWeeks, description: weekRange(addDays(source, 14)) },
              { id: 'custom', label: t.calendar.copy.custom }
            ]}
            value={target}
            onChange={setTarget}
            isDisabled={copying}
          />
          {target === 'custom' && (
            <DateField
              label={t.calendar.copy.customDate}
              value={customDay}
              onChange={(day) => day && setCustomDay(day)}
              minValue={startOfDay(new Date())}
              errorMessage={weeks === 0 ? t.calendar.copy.sameWeek : undefined}
              description={targetStart ? fmt(t.calendar.copy.customHint, { date: weekRange(targetStart) }) : undefined}
              isDisabled={copying}
            />
          )}
        </div>

        {valid && result && (
          <Notice tone={result.skipped > 0 ? 'action' : 'info'}>
            {result.source === 0
              ? t.calendar.copy.previewNone
              : result.copied === 0
                ? t.calendar.copy.previewAllTaken
                : result.skipped > 0
                  ? fmt(t.calendar.copy.previewSome, { skipped: result.skipped, copied: result.copied })
                  : plural(t.calendar.copy.preview, result.copied)}
          </Notice>
        )}

        <section aria-labelledby="copy-check" className="flex flex-col gap-2.5">
          <h3 id="copy-check" className={fieldLabelClass}>
            {checking || children.isError || exhausted.length === 0 ? t.calendar.lesson.children : plural(t.calendar.copy.exhausted, exhausted.length)}
          </h3>
          {children.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-ink-2">{t.calendar.copy.checkFailed}</p>
              <Button size="sm" variant="ghost" onPress={() => void children.refetch()}>
                {t.common.retry}
              </Button>
            </div>
          ) : checking ? (
            <p aria-live="polite" className="text-sm text-ink-2">
              {t.calendar.copy.checking}
            </p>
          ) : exhausted.length === 0 ? (
            <p className="text-sm text-ink-2">{t.calendar.copy.includedSummary}</p>
          ) : (
            <>
              <ul className="on-felt rounded-[1.25rem] bg-felt">
                {shownRows.map((row) => {
                  const out = excluded.has(row.id)
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3.5 py-3 first:border-t-0">
                      {/* The buttons drop under the name before the text gets squeezed */}
                      <div className="min-w-0 flex-1 basis-56">
                        <p className={cx('truncate text-[0.9375rem] font-medium', out && 'text-ink-3 line-through')}>{row.student_name}</p>
                        <p className="text-[0.8125rem] text-ink-3">
                          {out ? t.calendar.copy.excluded : fmt(t.calendar.copy.exhaustedRow, { date: row.package_end_date ? shortDate(i18n, row.package_end_date) : '–' })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant={out ? 'ghost' : 'secondary'}
                          onPress={() => toggle(row)}
                          isDisabled={copying}
                          aria-label={out ? undefined : fmt(t.calendar.copy.excludeLabel, { name: row.student_name })}
                        >
                          {out ? t.calendar.copy.include : t.calendar.copy.exclude}
                        </Button>
                        {!out && (
                          <Button size="sm" variant="ghost" onPress={() => startTask('payment', { registrationId: row.id, choice: 'renew' })} isDisabled={copying}>
                            {t.calendar.copy.renew}
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {exhausted.length > FIRST_ROWS + 1 && (
                <Button size="sm" variant="ghost" onPress={() => setUnfolded((on) => !on)} className="self-start">
                  {unfolded ? t.calendar.copy.showLess : plural(t.calendar.copy.showMore, exhausted.length - shownRows.length)}
                </Button>
              )}
              <p className="text-sm text-ink-2">{leftOut > 0 ? plural(t.calendar.copy.excludedSummary, leftOut) : t.calendar.copy.includedSummary}</p>
            </>
          )}
          {archived.length > 0 && (
            <Notice>
              <span className="font-medium">{plural(t.calendar.copy.archived, archived.length)}</span>
              <span className="mt-0.5 block text-pretty">{archived.map((row) => row.student_name).join(', ')}</span>
            </Notice>
          )}
        </section>

        <p className="text-[0.84375rem] text-ink-3">{t.calendar.copy.themesNote}</p>
      </div>
    </Sheet>
  )
}
