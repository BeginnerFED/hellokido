import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { set, startOfDay } from 'date-fns'
import { PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
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
import { LoadError, Mark, Skeleton } from '../../ui/Bits'
import { Button, IconButton } from '../../ui/Button'
import { Chips, Segmented, Select, Switch, type Option } from '../../ui/Choice'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DateField } from '../../ui/DateField'
import { TextField, fieldLabelClass } from '../../ui/Field'
import { FormRule, Notice } from '../../ui/Notice'
import { Sheet, SheetActions, SheetFooter } from '../../ui/Sheet'
import { AgeTablet, LessonShape, Peg } from '../../ui/signature'
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
  const { t, date } = useI18n()
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
  const description = lesson
    ? `${date(lesson.event_date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })}`
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
  const hourOptions: Option[] = [...new Set([...LESSON_HOURS, ...(opened.hour !== null ? [opened.hour] : [])])]
    .sort((a, b) => a - b)
    .map((value) => ({ id: String(value), label: String(value).padStart(2, '0') }))
  const minuteOptions: Option[] = [...new Set([...LESSON_MINUTE_STEPS, ...(opened.minute !== null ? [opened.minute] : [])])]
    .sort((a, b) => a - b)
    .map((value) => ({ id: String(value), label: String(value).padStart(2, '0') }))
  const ageOptions: Option[] = (AGE_GROUPS as string[]).map((group) => ({
    id: group,
    label: labels.ageGroup(group),
    icon: <AgeTablet group={group} />
  }))
  const typeOptions: Option<LessonType>[] = TYPES.map((value) => ({ id: value, label: labels.lessonType(value), icon: <LessonShape type={value} /> }))

  const childrenPart = (
    <section aria-labelledby="lesson-children" className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center gap-3">
        <h3 id="lesson-children" className={`${fieldLabelClass} min-w-0 flex-1`}>
          {t.calendar.lesson.children}
          {rows.length > 0 && (
            <span className="ml-2 font-normal text-ink-3 tabular">
              {holders}/{SEATS_SHOWN}
            </span>
          )}
        </h3>
        {!picking && (
          <Button size="sm" variant="quiet" icon={<PlusIcon aria-hidden weight="bold" className="size-4" />} onPress={() => setPicking(true)} className="-mr-2">
            {t.calendar.lesson.addChildren}
          </Button>
        )}
      </div>
      {unmarked > 0 && <Notice tone="action">{plural(t.calendar.lesson.unmarkedHint, unmarked)}</Notice>}
      {holders > SEATS_SHOWN && !copyMode && <Notice tone="action">{fmt(t.calendar.lesson.seats, { count: holders })}</Notice>}
      {overLimit && <Notice tone="negative">{fmt(t.calendar.lesson.tooMany, { limit: maxCapacity, count: going.length })}</Notice>}
      {copyMode && rows.some((row) => !row.isActive) && <Notice>{t.calendar.lesson.copyArchived}</Notice>}
      {picking && <ChildPicker selected={selected} onToggle={toggleChild} onDone={() => setPicking(false)} />}
      {rows.length === 0
        ? !picking && <p className="text-sm text-ink-2">{editing ? t.calendar.lesson.noChildren : t.calendar.lesson.childrenRequired}</p>
        : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const overdue = dayPassed && !copyMode && row.status === 'scheduled'
              return (
                <li key={row.id} className="flex items-center gap-3 py-2">
                  <Peg seat={{ id: row.id, name: row.name, status: copyMode ? 'scheduled' : row.status, overdue }} size="md" />
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
                  <IconButton
                    size="sm"
                    label={fmt(t.calendar.lesson.remove, { name: row.name })}
                    onPress={() => {
                      setConfirmNames(null)
                      setRows((list) => list.filter((item) => item.id !== row.id))
                    }}
                    className="-mr-1.5 shrink-0"
                  >
                    <XIcon aria-hidden className="size-4" />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}
      {confirmNames && (
        <div role="alert" className="rounded-control bg-negative-wash px-3 py-3 text-[0.8125rem] text-negative-ink">
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
    <div className="flex flex-col gap-4">
      <DateField
        label={t.calendar.lesson.date}
        value={day}
        onChange={(next) => {
          if (next) setDay(next)
          setTimeTaken(false)
        }}
        isDisabled={copyMode}
      />
      <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-start gap-3">
        <Select
          label={t.calendar.lesson.hour}
          options={hourOptions}
          value={hour === null ? null : String(hour)}
          onChange={(value) => {
            setHour(Number(value))
            setTimeTaken(false)
          }}
          placeholder="––"
        />
        <Segmented
          label={t.calendar.lesson.minute}
          options={minuteOptions}
          value={minute === null ? null : String(minute)}
          onChange={(value) => {
            setMinute(Number(value))
            setTimeTaken(false)
          }}
        />
      </div>
      {timeTaken && <Notice tone="negative">{t.calendar.minuteTaken}</Notice>}
    </div>
  )

  const whatPart = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabelClass}>{t.calendar.lesson.ageGroup}</span>
        <Chips aria-label={t.calendar.lesson.ageGroup} options={ageOptions} selected={ageGroup ? [ageGroup] : []} onChange={(next) => next[0] && setAgeGroup(next[0])} />
      </div>
      <Segmented<LessonType> label={t.calendar.lesson.type} options={typeOptions} value={type} onChange={setType} />
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

  return (
    <div className="flex flex-col gap-5">
      {parts.map((part, index) => (
        <div key={index} className="flex flex-col gap-5">
          {index > 0 && <FormRule />}
          {part}
        </div>
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
            ) : undefined
          }
        >
          <Button variant="primary" isDisabled={!valid || Boolean(confirmNames)} isPending={busy} onPress={() => void save()} className="max-md:flex-1">
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
