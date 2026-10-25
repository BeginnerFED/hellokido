import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { useQuery } from '@tanstack/react-query'
import { set, startOfDay } from 'date-fns'
import { CheckIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import {
  copyLesson,
  createLesson,
  deleteLesson,
  loadLesson,
  saveLesson,
  LESSON_ROW_LIMIT,
  LessonError,
  SEATS_SHOWN,
  type AttendanceStatus,
  type LessonDetail,
  type LessonType,
  type Registration
} from '@hellokido/core/api'
import { AGE_GROUPS } from '@hellokido/core/rules/ageGroups.js'
import { holdsSeat, isRecordedAttendance } from '@hellokido/core/rules/attendance.js'
import { useLabels, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { Avatar, LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Select, Switch, type Option } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DateField } from '../../ui/DateField'
import { TextField, fieldLabelClass } from '../../ui/Field'
import { FormRule, Notice } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter, useCloseSheet } from '../../ui/Sheet'
import { LessonShape, SeatDots, typeClass } from '../../ui/signature'
import { cx } from '../../ui/cx'
import type { FormState } from '../children/ExtendForm'
import { StatusMenu } from '../lessons/StatusMenu'
import { ChildPicker } from './ChildPicker'
import { LESSON_HOURS, LESSON_MINUTE_STEPS, nextCopyDate } from './model'

/** What opens the lesson sheet: an existing lesson, or a start for a new one (with or without a time). */
export type LessonParams = { lessonId?: string; start?: string; withTime?: boolean }

const IDLE: FormState = { dirty: false, busy: false }
const STATUSES: AttendanceStatus[] = ['scheduled', 'attended', 'no_show', 'postponed', 'makeup']
const TYPES: LessonType[] = ['ingilizce', 'duyusal', 'ozel']

export function LessonSheet({ isOpen, onOpenChange, params }: { isOpen: boolean; onOpenChange: (open: boolean) => void; params: LessonParams }) {
  const { t, fmt, date } = useI18n()
  const [state, setState] = useState(IDLE)
  const [copying, setCopying] = useState(false)
  const lessonId = params.lessonId
  // Read fresh on every opening; the form then works on that reading (its snapshot)
  const detail = useQuery({
    queryKey: ['lesson-detail', lessonId ?? ''],
    queryFn: () => loadLesson(lessonId!),
    enabled: Boolean(lessonId),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof LessonError) && count < 1
  })
  const lesson = detail.data?.lesson
  const title = !lessonId ? t.calendar.lesson.createTitle : copying ? t.calendar.lesson.copyTitle : t.calendar.lesson.editTitle
  // A new lesson says where on the calendar it was opened from
  const description = lesson
    ? `${date(lesson.event_date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}`
    : !lessonId && params.start
      ? params.withTime
        ? fmt(t.calendar.lesson.fromSlot, {
            date: date(params.start, { weekday: 'long', day: 'numeric', month: 'long' }),
            time: date(params.start, { hour: '2-digit', minute: '2-digit' })
          })
        : fmt(t.calendar.lesson.fromDay, { date: date(params.start, { weekday: 'long', day: 'numeric', month: 'long' }) })
      : undefined

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={title} description={description} isDirty={state.dirty} isBusy={state.busy}>
      {lessonId && detail.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12" />
          ))}
          <Skeleton className="mt-3 h-11" />
        </div>
      ) : lessonId && detail.isError ? (
        detail.error instanceof LessonError ? (
          <Notice tone="negative">{t.calendar.lesson.notFound}</Notice>
        ) : (
          <LoadError message={t.calendar.lesson.loadFailed} retryLabel={t.common.retry} onRetry={() => void detail.refetch()} />
        )
      ) : (
        <LessonForm
          detail={detail.data}
          start={params.start ? new Date(params.start) : undefined}
          withTime={params.withTime ?? false}
          onDone={() => onOpenChange(false)}
          onStateChange={setState}
          onCopyMode={setCopying}
        />
      )}
    </Sheet>
  )
}

type Row = { id: string; name: string; detail: string; isActive: boolean; status: AttendanceStatus }

const describe = (child: { student_age?: string | null; parent_name?: string | null }) =>
  [child.student_age, child.parent_name].filter(Boolean).join(' · ')

const sameMinute = (a: Date, b: Date) => Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000)

function LessonForm({
  detail,
  start,
  withTime,
  onDone,
  onStateChange,
  onCopyMode
}: {
  detail?: LessonDetail
  start?: Date
  withTime: boolean
  onDone: () => void
  onStateChange: (state: FormState) => void
  onCopyMode: (on: boolean) => void
}) {
  const { t, fmt, plural } = useI18n()
  const labels = useLabels()
  const toast = useToast()
  const refresh = useRefresh()
  const closeSheet = useCloseSheet()
  const lesson = detail?.lesson
  const editing = Boolean(lesson)

  // Everything the form compares against is taken once, when the sheet opened
  const [opened] = useState(() => {
    const at = lesson ? new Date(lesson.event_date) : (start ?? new Date())
    const timed = editing || withTime
    const seats = detail?.seats ?? []
    return {
      day: startOfDay(at),
      hour: timed ? at.getHours() : null,
      minute: timed ? at.getMinutes() : null,
      ageGroup: lesson?.age_group ?? null,
      type: (lesson?.event_type as LessonType | undefined) ?? null,
      description: lesson?.custom_description ?? '',
      rows: seats
        .map<Row>((seat) => ({
          id: seat.registration_id,
          name: seat.child.student_name,
          detail: describe(seat.child),
          isActive: seat.child.is_active === true,
          status: seat.status
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      snapshot: new Map(seats.map((seat) => [seat.registration_id, { participantId: seat.id, status: seat.status, name: seat.child.student_name }])),
      recorded: seats.filter((seat) => isRecordedAttendance(seat.status)).length,
      copyDay: lesson ? nextCopyDate(at, new Date()) : null
    }
  })

  const [day, setDay] = useState<Date | null>(opened.day)
  const [hour, setHour] = useState<number | null>(opened.hour)
  const [minute, setMinute] = useState<number | null>(opened.minute)
  const [ageGroup, setAgeGroup] = useState<string | null>(opened.ageGroup)
  const [type, setType] = useState<LessonType | null>(opened.type)
  const [description, setDescription] = useState(opened.description)
  const [rows, setRows] = useState<Row[]>(opened.rows)
  const [picking, setPicking] = useState(false)
  const [copyMode, setCopyMode] = useState(false)
  const [copyDay, setCopyDay] = useState<Date | null>(opened.copyDay)
  const [confirmNames, setConfirmNames] = useState<string[] | null>(null)
  const [timeTaken, setTimeTaken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startAt = day && hour !== null && minute !== null ? set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 }) : null
  const maxCapacity = lesson?.max_capacity ?? LESSON_ROW_LIMIT
  const selected = useMemo(() => new Set(rows.map((row) => row.id)), [rows])
  const holders = rows.filter((row) => holdsSeat(row.status)).length
  const going = copyMode ? rows.filter((row) => row.isActive) : rows
  const overLimit = going.length > maxCapacity
  const dayPassed = lesson ? new Date(lesson.event_date) < startOfDay(new Date()) : false
  const unmarked = dayPassed && !copyMode ? rows.filter((row) => row.status === 'scheduled').length : 0
  const descriptionMissing = !editing && type === 'ozel' && !description.trim()

  const valid = copyMode
    ? Boolean(copyDay && hour !== null && minute !== null && ageGroup && type && !overLimit)
    : Boolean(startAt && ageGroup && type && !descriptionMissing && !overLimit && (editing || rows.length > 0))

  const rowsChanged =
    rows.length !== opened.rows.length || rows.some((row) => opened.rows.find((before) => before.id === row.id)?.status !== row.status)
  const fieldsChanged =
    day?.getTime() !== opened.day.getTime() ||
    hour !== opened.hour ||
    minute !== opened.minute ||
    ageGroup !== opened.ageGroup ||
    type !== opened.type ||
    description.trim() !== opened.description.trim()
  const dirty = fieldsChanged || rowsChanged || copyMode

  useEffect(() => onStateChange({ dirty, busy: busy || deleting }), [dirty, busy, deleting, onStateChange])
  useEffect(() => onCopyMode(copyMode), [copyMode, onCopyMode])

  const toggleChild = (child: Registration, on: boolean) => {
    setConfirmNames(null)
    setRows((list) => {
      if (!on) return list.filter((row) => row.id !== child.id)
      if (list.some((row) => row.id === child.id)) return list
      // A child taken out and put back in the same visit gets back the status they had
      const status = opened.snapshot.get(child.id)?.status ?? 'scheduled'
      return [...list, { id: child.id, name: child.student_name, detail: describe(child), isActive: true, status }]
    })
  }

  const fail = (error: unknown, fallback: string) => {
    if (error instanceof LessonError) {
      if (error.code === 'minute_taken') {
        setTimeTaken(true)
        return toast({ tone: 'error', title: t.calendar.minuteTaken })
      }
      if (error.code === 'needs_confirmation') return setConfirmNames(error.detail.names ?? [])
      if (error.code === 'too_many') {
        const { limit = maxCapacity, count } = error.detail
        return toast({ tone: 'error', title: count ? fmt(t.calendar.lesson.tooMany, { limit, count }) : fmt(t.calendar.lesson.tooManyNow, { limit }) })
      }
      if (error.code === 'not_found') {
        toast({ tone: 'warning', title: t.calendar.lesson.notFound })
        refresh.lessons()
        return onDone()
      }
    }
    toast({ tone: 'error', title: fallback })
  }

  const save = async (confirmed = false) => {
    if (!valid || busy) return
    setBusy(true)
    setTimeTaken(false)
    try {
      const fields = { ageGroup: ageGroup!, type: type!, description }
      if (copyMode && lesson) {
        const copyStart = set(copyDay!, { hours: hour!, minutes: minute!, seconds: 0, milliseconds: 0 })
        await copyLesson({ ...fields, start: copyStart }, going.map((row) => row.id), maxCapacity)
        toast({ title: t.calendar.lesson.copied })
      } else if (lesson) {
        await saveLesson({
          lessonId: lesson.id,
          snapshot: opened.snapshot,
          fields: { ...fields, start: startAt! },
          children: rows.map((row) => ({ registrationId: row.id, status: row.status })),
          timeChanged: !sameMinute(startAt!, new Date(lesson.event_date)),
          maxCapacity,
          removalConfirmed: confirmed
        })
        toast({ title: t.calendar.lesson.updated })
      } else {
        await createLesson({ ...fields, start: startAt! }, rows.map((row) => row.id))
        toast({ title: t.calendar.lesson.created })
      }
      setConfirmNames(null)
      refresh.lessons()
      onDone()
    } catch (error) {
      const editingSave = Boolean(lesson) && !copyMode
      fail(error, editingSave ? t.calendar.lesson.saveFailed : t.calendar.lesson.createFailed)
      // A save is several writes: the board shows whatever went through
      if (editingSave) refresh.lessons()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!lesson) return
    setDeleting(true)
    try {
      await deleteLesson(lesson.id)
      toast({ title: t.calendar.lesson.deleted })
      refresh.lessons()
      setAskDelete(false)
      onDone()
    } catch {
      toast({ tone: 'error', title: t.calendar.lesson.deleteFailed })
    } finally {
      setDeleting(false)
    }
  }


  // ---- options (a stored time outside the usual steps stays choosable, so it is never changed unseen)
  const timeKey = (h: number, m: number) => `${h}:${m}`
  const timeOptions: Option[] = LESSON_HOURS.flatMap((h) => LESSON_MINUTE_STEPS.map((m) => [h, m] as const))
    .concat(opened.hour !== null && opened.minute !== null ? [[opened.hour, opened.minute] as const] : [])
    .filter(([h, m], index, all) => all.findIndex(([h2, m2]) => h2 === h && m2 === m) === index)
    .sort(([h1, m1], [h2, m2]) => h1 * 60 + m1 - (h2 * 60 + m2))
    .map(([h, m]) => ({ id: timeKey(h, m), label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }))
  const ageOptions: Option[] = (AGE_GROUPS as string[]).map((group) => ({ id: group, label: labels.ageGroup(group) }))

  const removeRow = (id: string) => {
    setConfirmNames(null)
    setRows((list) => list.filter((item) => item.id !== id))
  }
  const seatsHeld = copyMode ? going.length : holders
  const seatsOpen = SEATS_SHOWN - seatsHeld

  const addChild = (
    <AriaButton
      onPress={() => setPicking(true)}
      className={cx(
        'inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.90625rem] font-medium text-accent-ink outline-none',
        'shadow-[inset_0_0_0_1.5px_var(--line-strong)] transition-colors duration-150 data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus'
      )}
    >
      <PlusIcon aria-hidden weight="bold" className="size-4" />
      {t.calendar.lesson.addChildren}
    </AriaButton>
  )

  const childrenPart = (
    <section aria-labelledby="lesson-children" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="lesson-children" className={fieldLabelClass}>
          {t.calendar.lesson.children}
        </h3>
        {rows.length > 0 && (
          <span className="text-[0.84375rem] font-medium text-ink-3">
            {holders}/{SEATS_SHOWN}
          </span>
        )}
      </div>
      {unmarked > 0 && <Notice tone="action">{plural(t.calendar.lesson.unmarkedHint, unmarked)}</Notice>}
      {holders > SEATS_SHOWN && !copyMode && <Notice tone="action">{fmt(t.calendar.lesson.seats, { count: holders })}</Notice>}
      {overLimit && <Notice tone="negative">{fmt(t.calendar.lesson.tooMany, { limit: maxCapacity, count: going.length })}</Notice>}
      {copyMode && rows.some((row) => !row.isActive) && <Notice>{t.calendar.lesson.copyArchived}</Notice>}
      {picking ? (
        <ChildPicker selected={selected} onToggle={toggleChild} onDone={() => setPicking(false)} />
      ) : editing ? (
        // An existing lesson: a row per child with their attendance, in a felt well
        <div className="on-felt rounded-[1.25rem] bg-felt">
          {rows.length === 0 ? (
            <p className="px-4 pt-3.5 text-sm text-ink-2">{t.calendar.lesson.noChildren}</p>
          ) : (
            <ul>
              {rows.map((row) => {
                const overdue = dayPassed && !copyMode && row.status === 'scheduled'
                return (
                  <li key={row.id} className="flex items-center gap-3 border-t border-line py-2.5 pr-2 pl-3.5 first:border-t-0">
                    <Avatar name={row.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[0.9375rem] font-medium">{row.name}</span>
                        {!row.isActive && <Mark tone="neutral">{t.today.archived}</Mark>}
                      </p>
                      {row.detail && <p className="truncate text-[0.8125rem] text-ink-3">{row.detail}</p>}
                    </div>
                    {editing && !copyMode && (
                      <StatusMenu
                        status={row.status}
                        options={STATUSES}
                        onChange={(status) => setRows((list) => list.map((item) => (item.id === row.id ? { ...item, status } : item)))}
                        label={fmt(t.children.detail.lessonStatus, { name: row.name })}
                        overdue={overdue}
                        overdueLabel={t.calendar.lesson.notMarked}
                      />
                    )}
                    <IconButton size="sm" label={fmt(t.calendar.lesson.remove, { name: row.name })} onPress={() => removeRow(row.id)} className="shrink-0">
                      <XIcon aria-hidden className="size-4" />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          )}
          <div className={cx('px-3 pb-3', rows.length === 0 ? 'pt-3' : 'border-t border-line pt-3')}>{addChild}</div>
        </div>
      ) : (
        // A new lesson: the children as people chips on a felt well
        <div className="on-felt flex flex-wrap items-center gap-2 rounded-[1.25rem] bg-felt p-3">
          {rows.map((row) => (
            <span key={row.id} className="inline-flex h-10 max-w-full min-w-0 items-center gap-2 rounded-full bg-piece pr-1 pl-1.5 shadow-lift dark:shadow-none">
              <Avatar name={row.name} size="xs" tone="sky" />
              <span className="min-w-0 truncate text-[0.90625rem] font-medium">{row.name}</span>
              <IconButton size="sm" label={fmt(t.calendar.lesson.remove, { name: row.name })} onPress={() => removeRow(row.id)} className="size-8! shrink-0">
                <XIcon aria-hidden className="size-3.5" />
              </IconButton>
            </span>
          ))}
          {addChild}
          {rows.length === 0 && <span className="px-1 text-[0.84375rem] text-ink-3">{t.calendar.lesson.childrenRequired}</span>}
        </div>
      )}
      {!picking && rows.length > 0 && (
        <p className="flex items-center gap-2.5 px-0.5 text-sm text-ink-2">
          <SeatDots taken={seatsHeld} capacity={SEATS_SHOWN} />
          {seatsOpen > 0 ? plural(t.calendar.lesson.seatsLeft, seatsOpen) : t.calendar.lesson.seatsFull}
        </p>
      )}
      {confirmNames && (
        <div role="alert" className="rounded-control bg-negative-wash px-3.5 py-3 text-[0.84375rem] text-negative-ink">
          <p className="text-pretty">{fmt(t.calendar.lesson.removeRecorded, { names: confirmNames.join(', ') })}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={() => setConfirmNames(null)} isDisabled={busy}>
              {t.common.cancel}
            </Button>
            <Button size="sm" variant="danger" onPress={() => void save(true)} isPending={busy}>
              {t.calendar.lesson.removeAnyway}
            </Button>
          </div>
        </div>
      )}
    </section>
  )

  const whenPart = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-2.5">
        <DateField
          label={t.calendar.lesson.date}
          value={day}
          onChange={(next) => {
            if (next) setDay(next)
            setTimeTaken(false)
          }}
          isDisabled={copyMode}
        />
        <Select
          label={t.calendar.lesson.hour}
          options={timeOptions}
          value={hour === null || minute === null ? null : timeKey(hour, minute)}
          onChange={(value) => {
            const [h, m] = value.split(':').map(Number)
            setHour(h)
            setMinute(m)
            setTimeTaken(false)
          }}
          placeholder="––:––"
        />
      </div>
      {timeTaken && <Notice tone="negative">{t.calendar.minuteTaken}</Notice>}
    </div>
  )

  const whatPart = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span id="lesson-age" className={fieldLabelClass}>
          {t.calendar.lesson.ageGroup}
        </span>
        <ToggleButtonGroup
          aria-labelledby="lesson-age"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={ageGroup ? [ageGroup] : []}
          onSelectionChange={(keys) => {
            const next = [...keys][0]
            if (next != null) setAgeGroup(String(next))
          }}
          className="flex flex-wrap gap-[0.4375rem]"
        >
          {ageOptions.map((option) => (
            <ToggleButton
              key={option.id}
              id={option.id}
              className={cx(
                'relative inline-flex h-[2.125rem] items-center rounded-full bg-field px-[0.8125rem] text-sm font-medium whitespace-nowrap text-ink-2 outline-none',
                'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1',
                'transition-[background-color,color,box-shadow] duration-150 data-hovered:bg-track data-hovered:text-ink',
                'data-selected:bg-sky-felt data-selected:text-sky-ink data-selected:shadow-[inset_0_0_0_2px_var(--sky)] data-selected:data-hovered:bg-sky-felt',
                'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-sheet'
              )}
            >
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <div className="flex flex-col gap-2">
        <span id="lesson-type" className={fieldLabelClass}>
          {t.calendar.lesson.type}
        </span>
        {/* Three felt tiles; the chosen one takes its type's felt, a ring and a check */}
        <ToggleButtonGroup
          aria-labelledby="lesson-type"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={type ? [type] : []}
          onSelectionChange={(keys) => {
            const next = [...keys][0]
            if (next != null) setType(String(next) as LessonType)
          }}
          className="grid grid-cols-3 gap-2"
        >
          {TYPES.map((value) => (
            <ToggleButton
              key={value}
              id={value}
              className={cx(
                typeClass(value),
                'group relative flex min-w-0 flex-col items-start gap-2 rounded-[1.125rem] bg-field px-3 py-3 text-left text-[0.9375rem] font-medium text-ink outline-none',
                'sm:flex-row sm:items-center sm:gap-2.5 sm:py-[0.8125rem]',
                'transition-[background-color,color,box-shadow,scale] duration-150 data-hovered:bg-track data-pressed:scale-[0.98]',
                'data-selected:bg-(--t-felt) data-selected:text-(--t-ink) data-selected:shadow-[inset_0_0_0_2px_var(--t-mid)] data-selected:data-hovered:bg-(--t-felt)',
                'data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-sheet'
              )}
            >
              <LessonShape type={value} size="md" />
              <span className="min-w-0 truncate">{labels.lessonType(value)}</span>
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 hidden size-5 place-items-center rounded-full bg-(--t-ink) text-(--t-felt) ring-2 ring-sheet group-data-selected:grid"
              >
                <CheckIcon weight="bold" className="size-3" />
              </span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {type === 'ozel' && (
        <TextField
          label={t.calendar.lesson.description}
          placeholder={t.calendar.lesson.descriptionPlaceholder}
          value={description}
          onChange={setDescription}
          description={descriptionMissing ? t.calendar.lesson.descriptionRequired : undefined}
          maxLength={120}
          autoComplete="off"
        />
      )}
    </div>
  )

  const copyPart = editing && (
    <div className="flex flex-col gap-4">
      <FormRule />
      <Switch
        isSelected={copyMode}
        onChange={(on) => {
          setCopyMode(on)
          setConfirmNames(null)
        }}
      >
        {t.calendar.lesson.copyToggle}
      </Switch>
      {copyMode && (
        <>
          <DateField label={t.calendar.lesson.copyTo} value={copyDay} onChange={setCopyDay} minValue={startOfDay(new Date())} />
          <Notice>{t.calendar.lesson.copyNote}</Notice>
        </>
      )}
    </div>
  )

  const parts: ReactNode[] = editing ? [childrenPart, whenPart, whatPart, copyPart] : [whenPart, whatPart, childrenPart]
  // An existing lesson saves only once something changed; a new one as soon as it is complete
  const unchanged = editing && !copyMode && !dirty

  return (
    <div className="flex flex-col gap-6 pt-1">
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}

      <SheetFooter>
        <SheetActions
          start={
            editing && !copyMode ? (
              <Button
                variant="danger-soft"
                icon={<TrashIcon aria-hidden className="size-4" />}
                onPress={() => setAskDelete(true)}
                isDisabled={busy}
                className="-ml-3"
              >
                {t.calendar.lesson.delete}
              </Button>
            ) : (
              <Button variant="quiet" onPress={() => closeSheet?.()} isDisabled={busy}>
                {t.common.cancel}
              </Button>
            )
          }
        >
          <Button
            variant="primary"
            isDisabled={!valid || Boolean(confirmNames) || unchanged}
            isPending={busy}
            onPress={() => void save()}
            className="max-md:flex-1"
          >
            {copyMode ? t.calendar.lesson.copyAction : editing ? t.calendar.lesson.save : t.calendar.lesson.create}
          </Button>
        </SheetActions>
      </SheetFooter>

      <ConfirmDialog
        isOpen={askDelete}
        onOpenChange={setAskDelete}
        title={t.calendar.lesson.deleteTitle}
        body={
          <>
            {t.calendar.lesson.deleteBody}
            {opened.recorded > 0 && <span className="mt-2 block font-medium text-negative-ink">{plural(t.calendar.lesson.deleteRecorded, opened.recorded)}</span>}
          </>
        }
        confirmLabel={t.calendar.lesson.deleteConfirm}
        tone="danger"
        isPending={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
