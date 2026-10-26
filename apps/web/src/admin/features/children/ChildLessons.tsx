import { useMemo, useState } from 'react'
import { Button as AriaButton, Header, MenuSection } from 'react-aria-components'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, max as latest, min as earliest, startOfDay, startOfMonth } from 'date-fns'
import { CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { setAttendance, type AttendanceStatus, type ChildLesson, type Registration } from '@hellokido/core/api'
import { isAttendanceOverdue } from '@hellokido/core/rules/attendance.js'
import { weekStart } from '@hellokido/core/view'
import { keys, useChildLessons, useLabels } from '../../data/queries'
import { useI18n, type I18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LoadError, Skeleton } from '../../ui/Bits'
import { IconButton } from '../../ui/Button'
import { Segmented } from '../../ui/Choice'
import { Menu, MenuItem } from '../../ui/Menu'
import { Band, Card, CardLink } from '../../ui/Page'
import { LessonShape, typeClass } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { StatusMenu } from '../lessons/StatusMenu'
import { isFree } from './rules'

/** The statuses a lesson can be given from here; "scheduled" is never chosen by hand. */
const STATUSES: AttendanceStatus[] = ['attended', 'no_show', 'postponed', 'makeup']
const STEP = 10
const FIRST_UPCOMING = 3
/** A period longer than this many weeks is shown a month at a time. */
const MAX_WEEKS = 6

type Mode = 'calendar' | 'list'

function lessonWhen(i18n: Pick<I18n, 'date'>, value: string) {
  const day = new Date(value)
  const thisYear = day.getFullYear() === new Date().getFullYear()
  const date = i18n.date(day, thisYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
  return `${date}, ${i18n.date(day, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Every lesson of the child: the package's period as a calendar (attended, absent and planned at a
 * glance), or as a list across all periods: what comes next first, then the past, newest first, with
 * a rule where the current package begins. Attendance can be corrected from either.
 */
export function ChildLessons({ registration, level }: { registration: Registration; level: 2 | 3 }) {
  const i18n = useI18n()
  const { t, plural } = i18n
  const toast = useToast()
  const client = useQueryClient()
  const lessons = useChildLessons(registration.id)
  const [saving, setSaving] = useState<Set<string>>(() => new Set())
  const free = isFree(registration)
  // Free participation has no period to draw
  const [mode, setMode] = useState<Mode>(free ? 'list' : 'calendar')

  const key = keys.childLessons(registration.id)
  const patch = (id: string, status: string) =>
    client.setQueryData<ChildLesson[]>(key, (rows) => rows?.map((row) => (row.id === id ? { ...row, status } : row)))

  const change = async (lesson: ChildLesson, status: AttendanceStatus) => {
    if (lesson.status === status || saving.has(lesson.id)) return
    const before = lesson.status
    setSaving((set) => new Set(set).add(lesson.id))
    await client.cancelQueries({ queryKey: key })
    patch(lesson.id, status)
    try {
      await setAttendance(lesson.id, status)
    } catch {
      patch(lesson.id, before)
      toast({ tone: 'error', title: t.children.detail.statusFailed })
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(lesson.id)
        return next
      })
    }
    // The child's numbers and every lesson view follow; this list already shows the new status
    void client.invalidateQueries({ queryKey: ['usage'] })
    void client.invalidateQueries({ queryKey: ['lessons'] })
  }

  // A package has no last day: its lessons count from the first day until the next package starts
  const start = useMemo(() => startOfDay(new Date(registration.package_start_date)), [registration.package_start_date])
  const rows = lessons.data ?? []
  const total = rows.length
  const inPeriod = useMemo(() => (lessons.data ?? []).filter((row) => startOfDay(new Date(row.events!.event_date)) >= start), [lessons.data, start])
  // The calendar runs on to the period's last lesson, however late that falls
  const period = useMemo(() => ({ start, end: latest([start, ...inPeriod.map((row) => startOfDay(new Date(row.events!.event_date)))]) }), [start, inPeriod])

  const showCalendar = !free && mode === 'calendar'
  const outside = total - inPeriod.length

  return (
    <Card
      level={level}
      title={t.children.detail.lessonsTitle}
      description={
        lessons.data && total > 0 ? (showCalendar ? plural(t.children.web.periodLessons, inPeriod.length) : plural(t.children.form.lessons, total)) : undefined
      }
      aside={
        !free && (
          <Segmented<Mode>
            aria-label={t.children.web.lessonsView}
            size="sm"
            fit
            value={mode}
            onChange={setMode}
            options={[
              { id: 'calendar', label: t.children.web.calendar },
              { id: 'list', label: t.children.web.list }
            ]}
          />
        )
      }
      footer={
        showCalendar && lessons.data && outside > 0 ? (
          <>
            <span>{plural(t.children.web.outside, outside)}</span>
            <CardLink onPress={() => setMode('list')}>{t.children.web.showList}</CardLink>
          </>
        ) : undefined
      }
    >
      {lessons.isPending ? (
        <div className="flex flex-col gap-2 px-4 pb-5 sm:px-[1.375rem]">
          <Skeleton className="h-6" />
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-11" />
          ))}
        </div>
      ) : lessons.isError ? (
        <div className="px-4 pb-5 sm:px-[1.375rem]">
          <LoadError message={t.children.detail.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
        </div>
      ) : total === 0 ? (
        // An empty grid with no month and no lessons says nothing; say it in words in both views
        <p className="px-4 pb-5 text-[0.9375rem] text-ink-3 sm:px-[1.375rem]">{t.children.detail.lessonsEmpty}</p>
      ) : showCalendar ? (
        <PeriodCalendar start={period.start} end={period.end} lessons={inPeriod} saving={saving} onChange={(lesson, status) => void change(lesson, status)} />
      ) : (
        <LessonList registration={registration} rows={rows} saving={saving} onChange={(lesson, status) => void change(lesson, status)} level={level} />
      )}
    </Card>
  )
}

type ChangeProps = {
  saving: Set<string>
  onChange: (lesson: ChildLesson, status: AttendanceStatus) => void
}

/**
 * The period as a month-like grid, Monday first. A lesson day takes its type's felt with a badge:
 * a green check when attended, grey when absent, a ring while planned (amber once its attendance is
 * overdue). Today is outlined. Days outside the period are quiet. Tapping a lesson day corrects it.
 */
function PeriodCalendar({ start, end, lessons, saving, onChange }: { start: Date; end: Date; lessons: ChildLesson[] } & ChangeProps) {
  const i18n = useI18n()
  const { t, date } = i18n
  const today = startOfDay(new Date())

  const byDay = useMemo(() => {
    const map = new Map<string, ChildLesson[]>()
    for (const row of [...lessons].sort((a, b) => a.events!.event_date.localeCompare(b.events!.event_date))) {
      const day = format(new Date(row.events!.event_date), 'yyyy-MM-dd')
      map.set(day, [...(map.get(day) ?? []), row])
    }
    return map
  }, [lessons])

  // Long periods (three months) are paged a month at a time, opening on the month of today
  const months = useMemo(() => {
    const list: Date[] = []
    for (let month = startOfMonth(start); month <= end; month = addMonths(month, 1)) list.push(month)
    return list
  }, [start, end])
  const weekCount = Math.round((weekStart(end).getTime() - weekStart(start).getTime()) / (7 * 86_400_000)) + 1
  const paged = weekCount > MAX_WEEKS && months.length > 1
  const firstPage = Math.max(
    0,
    months.findIndex((month) => isSameMonth(month, today < start ? start : today > end ? end : today))
  )
  const [page, setPage] = useState(firstPage)

  const from = paged ? latest([start, months[page]]) : start
  const to = paged ? earliest([end, endOfMonth(months[page])]) : end
  const weeks: Date[] = []
  for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) weeks.push(monday)
  const heads = Array.from({ length: 7 }, (_, index) => addDays(weeks[0], index))

  return (
    <div className="px-4 pb-[1.125rem] sm:px-[1.375rem]">
      {paged && (
        <div className="-mt-1 mb-2 flex items-center gap-1">
          <p aria-live="polite" className="min-w-0 flex-1 text-[0.9375rem] font-semibold capitalize">
            {date(months[page], { month: 'long', year: 'numeric' })}
          </p>
          <IconButton label={t.calendar.previousMonth} size="sm" variant="quiet" isDisabled={page === 0} onPress={() => setPage((value) => value - 1)}>
            <CaretLeftIcon aria-hidden weight="bold" className="size-4" />
          </IconButton>
          <IconButton
            label={t.calendar.nextMonth}
            size="sm"
            variant="quiet"
            isDisabled={page === months.length - 1}
            onPress={() => setPage((value) => value + 1)}
          >
            <CaretRightIcon aria-hidden weight="bold" className="size-4" />
          </IconButton>
        </div>
      )}
      {/* Each lesson day is a button that says its date, lessons and status; the rest is the picture */}
      <div className="flex flex-col gap-[5px]">
        <div aria-hidden className="grid grid-cols-7 gap-[5px]">
          {heads.map((day) => (
            <span key={day.getDay()} className="pb-1 text-center text-xs text-ink-3">
              {date(day, { weekday: 'short' })}
            </span>
          ))}
        </div>
        {weeks.map((monday) => (
          <div key={monday.getTime()} className="grid grid-cols-7 gap-[5px]">
            {Array.from({ length: 7 }, (_, index) => {
              const day = addDays(monday, index)
              const within = day >= start && day <= end
              const list = within ? (byDay.get(format(day, 'yyyy-MM-dd')) ?? []) : []
              return (
                <div key={index} className="min-w-0">
                  {list.length > 0 ? (
                    <LessonDay day={day} lessons={list} isToday={isSameDay(day, today)} saving={saving} onChange={onChange} />
                  ) : (
                    <span
                      aria-hidden
                      className={cx(
                        'flex h-11 items-center justify-center rounded-xl text-[0.84375rem]',
                        within ? 'font-medium text-ink' : 'text-ink-3',
                        isSameDay(day, today) && 'shadow-[inset_0_0_0_2px_var(--fill)]'
                      )}
                    >
                      {day.getDate()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** One lesson's status as a small badge in the day cell. */
function Badge({ lesson }: { lesson: ChildLesson }) {
  const overdue = isAttendanceOverdue(lesson.status, lesson.events!.event_date)
  const status = lesson.status
  return (
    <span
      aria-hidden
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded-full',
        status === 'attended' && 'bg-green text-white dark:text-page',
        status === 'no_show' && 'bg-mute',
        status === 'makeup' && 'bg-pink',
        (status === 'postponed' || status === 'cancelled') && 'border-[1.5px] border-dashed border-current opacity-60',
        status === 'scheduled' && (overdue ? 'shadow-[inset_0_0_0_2px_var(--amber)]' : 'shadow-[inset_0_0_0_1.5px_currentColor] opacity-70')
      )}
    >
      {status === 'attended' && <CheckIcon weight="bold" className="size-[0.6875rem]" />}
    </span>
  )
}

/** A lesson day: the type's felt, the badges, and a menu to correct each lesson of the day. */
function LessonDay({ day, lessons, isToday, saving, onChange }: { day: Date; lessons: ChildLesson[]; isToday: boolean } & ChangeProps) {
  const { t, date } = useI18n()
  const labels = useLabels()
  const first = lessons[0].events!
  const titleOf = (lesson: ChildLesson) =>
    lesson.events!.event_type === 'ozel' && lesson.events!.custom_description ? lesson.events!.custom_description : labels.lessonType(lesson.events!.event_type)
  const timeOf = (lesson: ChildLesson) => date(lesson.events!.event_date, { hour: '2-digit', minute: '2-digit' })
  const statusOf = (lesson: ChildLesson) =>
    isAttendanceOverdue(lesson.status, lesson.events!.event_date) ? t.children.detail.notMarked : labels.attendance(lesson.status)
  const label = `${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${lessons
    .map((lesson) => `${titleOf(lesson)}, ${timeOf(lesson)}, ${statusOf(lesson)}`)
    .join('; ')}`

  return (
    <Menu
      label={label}
      placement="bottom"
      trigger={
        <AriaButton
          aria-label={label}
          isDisabled={lessons.some((lesson) => saving.has(lesson.id))}
          className={cx(
            typeClass(first.event_type),
            'flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-(--t-felt) text-[0.84375rem] leading-4 font-medium text-(--t-ink) outline-none',
            'transition-[box-shadow,scale,opacity] duration-150 data-pressed:scale-[0.96] data-disabled:opacity-60',
            'data-hovered:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--t-mid)_55%,transparent)] data-focus-visible:ring-2 data-focus-visible:ring-focus',
            isToday && 'shadow-[inset_0_0_0_2px_var(--fill)]!'
          )}
        >
          <span aria-hidden>{day.getDate()}</span>
          <span className="flex gap-0.5">
            {lessons.slice(0, 2).map((lesson) => (
              <Badge key={lesson.id} lesson={lesson} />
            ))}
          </span>
        </AriaButton>
      }
    >
      {lessons.map((lesson) => {
        const choices = STATUSES.includes(lesson.status as AttendanceStatus) ? STATUSES : [lesson.status as AttendanceStatus, ...STATUSES]
        return (
          <MenuSection key={lesson.id}>
            <Header className="flex items-center gap-2 px-3 pt-2 pb-1 text-[0.8125rem] font-semibold text-ink-2">
              <LessonShape type={lesson.events!.event_type} />
              <span className="min-w-0 truncate">
                {titleOf(lesson)}, {timeOf(lesson)}
              </span>
            </Header>
            {choices.map((option) => (
              <MenuItem
                key={option}
                id={`${lesson.id}:${option}`}
                isDisabled={option === 'cancelled'}
                onAction={() => onChange(lesson, option)}
                icon={<CheckIcon aria-hidden weight="bold" className={cx('size-4', option === lesson.status ? 'text-accent' : 'opacity-0')} />}
              >
                {labels.attendance(option)}
              </MenuItem>
            ))}
          </MenuSection>
        )
      })}
    </Menu>
  )
}

/** All the child's lessons as rows: what comes next, then the past, earlier packages under a rule. */
function LessonList({ registration, rows, saving, onChange, level }: { registration: Registration; rows: ChildLesson[]; level: 2 | 3 } & ChangeProps) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const Subheading = level === 3 ? 'h4' : 'h3'
  const [shownUpcoming, setShownUpcoming] = useState(FIRST_UPCOMING)
  const [shownPast, setShownPast] = useState(STEP)

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    return {
      upcoming: rows.filter((row) => new Date(row.events!.event_date).getTime() >= now).reverse(),
      past: rows.filter((row) => new Date(row.events!.event_date).getTime() < now)
    }
  }, [rows])

  // The past of the current package, then (under a rule) lessons of earlier packages
  const startsAt = isFree(registration) ? null : new Date(registration.package_start_date).getTime()
  const shownPastRows = past.slice(0, shownPast)
  const split = startsAt === null ? -1 : shownPastRows.findIndex((row) => new Date(row.events!.event_date).getTime() < startsAt)
  const currentRows = split === -1 ? shownPastRows : shownPastRows.slice(0, split)
  const earlierRows = split === -1 ? [] : shownPastRows.slice(split)

  const row = (lesson: ChildLesson) => {
    const event = lesson.events!
    const overdue = isAttendanceOverdue(lesson.status, event.event_date)
    const title = event.event_type === 'ozel' && event.custom_description ? event.custom_description : labels.lessonType(event.event_type)
    const when = lessonWhen(i18n, event.event_date)
    const notes = [
      lesson.cancellation_reason && fmt(t.children.detail.cancelReason, { text: lesson.cancellation_reason }),
      lesson.makeup_notes && fmt(t.children.detail.makeupNote, { text: lesson.makeup_notes }),
      lesson.postponed_notes && fmt(t.children.detail.postponedNote, { text: lesson.postponed_notes })
    ].filter(Boolean)
    return (
      <li key={lesson.id} className="flex items-start gap-3 border-t border-line px-4 py-2.5 first:border-t-0 sm:px-[1.375rem]">
        <LessonShape type={event.event_type} className="mt-[0.4375rem]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-medium text-ink">
            {title}
            <span className="font-normal text-ink-3">, {labels.ageGroup(event.age_group)}</span>
          </p>
          <p className="text-[0.84375rem] text-ink-2 tabular">
            {when}
            {lesson.is_makeup && <span className="text-pink-ink">, {t.children.detail.makeup}</span>}
          </p>
          {notes.map((note) => (
            <p key={note as string} className="mt-0.5 text-[0.8125rem] text-ink-3 text-pretty">
              {note}
            </p>
          ))}
        </div>
        <StatusMenu
          status={lesson.status}
          options={STATUSES}
          onChange={(status) => onChange(lesson, status)}
          label={fmt(t.children.detail.lessonStatus, { name: when })}
          overdue={overdue}
          overdueLabel={t.children.detail.notMarked}
          isDisabled={saving.has(lesson.id)}
        />
      </li>
    )
  }

  const more = (rest: number, onPress: () => void) =>
    rest > 0 && (
      <div className="border-t border-line px-4 py-2.5 text-[0.84375rem] sm:px-[1.375rem]">
        <CardLink onPress={onPress}>{plural(t.children.detail.showMore, Math.min(STEP, rest))}</CardLink>
      </div>
    )

  return (
    <div className="flex flex-col pb-2">
      {upcoming.length > 0 && (
        <div>
          <Band>
            <Subheading>{t.children.detail.upcoming}</Subheading>
          </Band>
          <ul>{upcoming.slice(0, shownUpcoming).map(row)}</ul>
          {more(upcoming.length - shownUpcoming, () => setShownUpcoming((count) => count + STEP))}
        </div>
      )}
      {past.length > 0 && (
        <div className={cx(upcoming.length > 0 && 'mt-2')}>
          {upcoming.length > 0 && (
            <Band>
              <Subheading>{t.children.detail.past}</Subheading>
            </Band>
          )}
          {currentRows.length > 0 && <ul>{currentRows.map(row)}</ul>}
          {earlierRows.length > 0 && (
            <>
              <Band className={cx(currentRows.length > 0 && 'mt-2')}>
                <Subheading>{t.children.detail.earlierPackages}</Subheading>
              </Band>
              <ul>{earlierRows.map(row)}</ul>
            </>
          )}
          {more(past.length - shownPast, () => setShownPast((count) => count + STEP))}
        </div>
      )}
    </div>
  )
}
