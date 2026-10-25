import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMinutes } from 'date-fns'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import {
  lessonsBetween,
  LessonError,
  SEATS_SHOWN,
  setAttendance,
  type AttendanceStatus,
  type Lesson,
  type Seat,
  type UsageMap
} from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { keys, useLabels, useUsageOf } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LoadError, Mark } from '../../ui/Bits'
import { ButtonLink } from '../../ui/Button'
import { CardTabs, Figure, FigureGrid } from '../../ui/Figures'
import { Band, Card, CardLink, Page } from '../../ui/Page'
import { LessonShape } from '../../ui/signature'
import { formatPeriod, UsageLine } from '../children/ChildBits'
import { isPaymentDue } from '../children/rules'
import { LESSON_MINUTES } from '../calendar/model'
import { AttendancePicker } from '../lessons/AttendancePicker'
import { useLessonTitle } from '../lessons/LessonBits'
import { useClock } from './clock'
import { ChildLink, ListSkeleton, TomorrowCard, UnmarkedList, useEndingPackages, usePaymentsDue, useUnmarked, WorkCard, type WorkTab } from './sections'

type LessonsTab = 'today' | 'past'

/**
 * The working day: a figure for each kind of work, today's lessons with attendance in one tap,
 * forgotten attendance, payments and renewals, and tomorrow's reminders.
 */
export default function TodayPage() {
  const i18n = useI18n()
  const { t, plural, fmt, date } = i18n
  const toast = useToast()
  const client = useQueryClient()
  const { now, dayKey } = useClock()

  const todayStart = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart])
  const rangeEnd = useMemo(() => addDays(todayStart, 2), [todayStart])
  const key = keys.lessons(todayStart.toISOString(), rangeEnd.toISOString())
  const lessons = useQuery({ queryKey: key, queryFn: () => lessonsBetween(todayStart, rangeEnd) })

  const todays = useMemo(() => (lessons.data ?? []).filter((lesson) => new Date(lesson.event_date) < tomorrowStart), [lessons.data, tomorrowStart])
  const tomorrows = useMemo(() => (lessons.data ?? []).filter((lesson) => new Date(lesson.event_date) >= tomorrowStart), [lessons.data, tomorrowStart])
  const usage = useUsageOf(useMemo(() => (lessons.data ?? []).flatMap((lesson) => lesson.seats.map((seat) => seat.child)), [lessons.data]))
  const [saving, setSaving] = useState<Set<string>>(() => new Set())

  const patch = (seatId: string, status: AttendanceStatus) =>
    client.setQueryData<Lesson[]>(key, (list) =>
      list?.map((lesson) => ({ ...lesson, seats: lesson.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)) }))
    )

  // Optimistic: the answer shows at once and goes back if it could not be saved
  const mark = async (seat: Seat, status: AttendanceStatus) => {
    if (seat.status === status || saving.has(seat.id)) return
    const before = seat.status
    setSaving((set) => new Set(set).add(seat.id))
    await client.cancelQueries({ queryKey: key })
    patch(seat.id, status)
    try {
      await setAttendance(seat.id, status)
    } catch (error) {
      patch(seat.id, before)
      // The child was taken out of the lesson meanwhile: show the lesson as it is now
      if (error instanceof LessonError && error.code === 'not_found') {
        toast({ tone: 'info', title: t.today.lessonGone })
        void lessons.refetch()
      } else {
        toast({ tone: 'error', title: t.children.detail.statusFailed })
      }
    } finally {
      setSaving((set) => {
        const next = new Set(set)
        next.delete(seat.id)
        return next
      })
    }
    void client.invalidateQueries({ queryKey: ['usage'] })
    void client.invalidateQueries({ queryKey: keys.childLessons(seat.registration_id) })
    // Other lesson views read again when they open; this list already shows the answer
    void client.invalidateQueries({ queryKey: ['lessons'], refetchType: 'none' })
  }

  // What waits for the admin, counted from the same queries as the cards they open
  const unmarked = useUnmarked(dayKey).query
  const payments = usePaymentsDue()
  const ending = useEndingPackages(now)
  const unmarkedCount = unmarked.data?.length ?? 0
  const endedCount = ending.rows.filter((row) => row.days < 0).length
  const waiting = payments.total + ending.rows.length + unmarkedCount

  const childCount = new Set(todays.flatMap((lesson) => lesson.seats.map((seat) => seat.registration_id))).size
  const seats = todays.flatMap((lesson) => lesson.seats)
  const marked = seats.filter((seat) => seat.status !== 'scheduled').length
  const running = todays.some((lesson) => isRunning(lesson, now))
  const day = date(now, { weekday: 'long', day: 'numeric', month: 'long' })
  const dayLine = lessons.data && todays.length > 0 ? `${day} · ${plural(t.today.lessonCount, todays.length)}, ${plural(t.today.childCount, childCount)}` : day

  const [lessonsTab, setLessonsTab] = useState<LessonsTab>('today')
  const [workTab, setWorkTab] = useState<WorkTab>('pay')

  const jump = (id: 'lessons' | 'work', select?: () => void) => {
    select?.()
    const card = document.getElementById(id)
    if (!card) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    card.tabIndex = -1
    card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    card.focus({ preventScroll: true })
  }
  const openFirstWork = () => {
    if (unmarkedCount > 0) jump('lessons', () => setLessonsTab('past'))
    else if (payments.total > 0) jump('work', () => setWorkTab('pay'))
    else jump('work', () => setWorkTab('renew'))
  }

  const summary = (
    <>
      {waiting > 0 && (
        <>
          <AriaButton
            onPress={openFirstWork}
            className="rounded-[0.25rem] font-medium text-accent-solid outline-none data-hovered:underline data-hovered:underline-offset-[3px] data-focus-visible:ring-2 data-focus-visible:ring-focus"
          >
            {plural(t.today.waiting, waiting)}
          </AriaButton>
          {' · '}
        </>
      )}
      {dayLine}
    </>
  )

  return (
    <Page
      title={t.today.title}
      summary={summary}
      width="wide"
      toolbar={
        <ButtonLink href="/calendar" icon={<CalendarBlankIcon aria-hidden className="size-4" />}>
          {t.today.openCalendar}
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-6">
        <Card title={t.today.overview.title} description={t.today.overview.body}>
          <FigureGrid>
            <Figure
              label={t.today.overview.lessons}
              value={lessons.data ? todays.length : '–'}
              hint={
                <>
                  {running && <span className="font-medium text-accent-solid">{t.today.overview.running} · </span>}
                  {plural(t.today.childCount, childCount)}
                </>
              }
              onPress={() => jump('lessons', () => setLessonsTab('today'))}
            />
            <Figure
              label={t.today.overview.attendance}
              value={
                <>
                  {marked}
                  <span className="font-medium text-ink-4">/{seats.length}</span>
                </>
              }
              hint={
                unmarkedCount > 0 ? (
                  <span className="font-medium text-action-ink">{plural(t.today.overview.pastUnmarked, unmarkedCount)}</span>
                ) : (
                  t.today.overview.pastDone
                )
              }
              onPress={() => jump('lessons', () => setLessonsTab(unmarkedCount > 0 ? 'past' : 'today'))}
            />
            <Figure
              label={t.today.overview.payments}
              value={payments.registrations.data ? payments.total : '–'}
              hint={payments.total > 0 ? fmt(t.today.overview.paymentsHint, { packages: payments.packages.length, fees: payments.fees.length }) : t.today.overview.none}
              onPress={() => jump('work', () => setWorkTab('pay'))}
            />
            <Figure
              label={t.today.overview.renewals}
              value={ending.registrations.data ? ending.rows.length : '–'}
              hint={
                ending.rows.length === 0 ? (
                  t.today.overview.none
                ) : (
                  <>
                    {endedCount > 0 && <span className="font-medium text-action-ink">{plural(t.today.overview.renewalsEnded, endedCount)}</span>}
                    {endedCount > 0 && ending.rows.length > endedCount && ' · '}
                    {ending.rows.length > endedCount && plural(t.today.overview.renewalsSoon, ending.rows.length - endedCount)}
                  </>
                )
              }
              onPress={() => jump('work', () => setWorkTab('renew'))}
            />
          </FigureGrid>
        </Card>

        <Card
          id="lessons"
          className="outline-none"
          title={t.today.lessonsTitle}
          description={lessonsTab === 'today' ? fmt(t.today.lessonsCard.todayBody, { day: dayLine }) : t.today.lessonsCard.pastBody}
          aside={
            <CardTabs<LessonsTab>
              label={t.today.lessonsCard.which}
              value={lessonsTab}
              onChange={setLessonsTab}
              options={[
                { id: 'today', label: t.today.lessonsCard.today, count: seats.length },
                { id: 'past', label: t.today.lessonsCard.past, count: unmarkedCount, countTone: unmarkedCount > 0 ? 'action' : 'muted' }
              ]}
            />
          }
          footer={
            <>
              <span>
                {lessonsTab === 'today' ? fmt(t.today.lessonsCard.foot, { marked, total: seats.length }) : t.today.lessonsCard.pastFoot}
              </span>
              <CardLink href="/calendar">{t.today.lessonsCard.inCalendar}</CardLink>
            </>
          }
        >
          {lessonsTab === 'past' ? (
            <UnmarkedList dayKey={dayKey} />
          ) : lessons.isError ? (
            <div className="p-4 sm:p-5">
              <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={() => void lessons.refetch()} />
            </div>
          ) : lessons.isPending ? (
            <ListSkeleton rows={5} />
          ) : todays.length === 0 ? (
            <EmptyState
              icon={<CalendarBlankIcon aria-hidden className="size-8" />}
              title={t.today.noLessons}
              body={t.today.noLessonsBody}
              action={
                <ButtonLink href="/calendar" variant="secondary" size="sm">
                  {t.today.openCalendar}
                </ButtonLink>
              }
            />
          ) : (
            <div>
              <Band className="hidden gap-x-5 lg:flex">
                <span className="min-w-0 flex-[1.6_1_15rem]">{t.today.lessonsCard.child}</span>
                <span className="min-w-0 flex-[1.1_1_10.5rem]">{t.today.lessonsCard.package}</span>
                <span className="min-w-0 flex-[1_1_9.5rem]">{t.today.lessonsCard.left}</span>
                <span className="w-[17rem] shrink-0">{t.today.lessonsCard.attendance}</span>
              </Band>
              {todays.map((lesson) => (
                <LessonBlock key={lesson.id} lesson={lesson} usage={usage} now={now} saving={saving} onMark={(seat, status) => void mark(seat, status)} />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-6">
          <WorkCard now={now} tab={workTab} onTab={setWorkTab} className="flex-[7_1_32.5rem] outline-none lg:max-h-[30rem]" />
          <TomorrowCard
            className="flex-[5_1_23.75rem] lg:max-h-[30rem]"
            lessons={tomorrows}
            isPending={lessons.isPending}
            isError={lessons.isError}
            onRetry={() => void lessons.refetch()}
            now={now}
          />
        </div>
      </div>
    </Page>
  )
}

function isRunning(lesson: Lesson, now: Date) {
  const start = new Date(lesson.event_date)
  return now >= start && now < addMinutes(start, LESSON_MINUTES)
}

/** One lesson inside the lessons card: its band, then a row for each child. */
function LessonBlock({
  lesson,
  usage,
  now,
  saving,
  onMark
}: {
  lesson: Lesson
  usage: UsageMap | undefined
  now: Date
  saving: Set<string>
  onMark: (seat: Seat, status: AttendanceStatus) => void
}) {
  const i18n = useI18n()
  const { t, fmt, date } = i18n
  const labels = useLabels()
  const title = useLessonTitle()
  const { startTask } = useActions()
  const start = new Date(lesson.event_date)
  const taken = lesson.seats.filter((seat) => holdsSeat(seat.status)).length
  const marked = lesson.seats.filter((seat) => seat.status !== 'scheduled').length
  const done = lesson.seats.length > 0 && marked === lesson.seats.length
  const running = isRunning(lesson, now)
  const later = now < start
  const time = date(start, { hour: '2-digit', minute: '2-digit' })

  return (
    <section aria-label={`${time} ${title(lesson)}`}>
      <Band className="gap-y-1.5 text-[0.84375rem] text-ink">
        {/* The lesson itself opens from its band: children to add, time to change */}
        <AriaButton
          onPress={() => startTask('lesson', { lessonId: lesson.id })}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-[0.375rem] text-left outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus"
        >
          <time dateTime={lesson.event_date} className="font-semibold tabular">
            {time}
          </time>
          <LessonShape type={lesson.event_type} />
          <span className="truncate font-semibold group-data-hovered:underline group-data-hovered:decoration-line-strong group-data-hovered:underline-offset-[3px]">
            {title(lesson)}
          </span>
          <span className="min-w-0 truncate text-[0.8125rem] text-ink-3">
            · {labels.ageGroup(lesson.age_group)} · {fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })}
          </span>
        </AriaButton>
        {done ? (
          <Mark tone="positive">{t.today.lessonsCard.done}</Mark>
        ) : running ? (
          <Mark tone="accent">{t.today.now}</Mark>
        ) : later ? (
          <Mark tone="neutral">{t.today.lessonsCard.later}</Mark>
        ) : null}
        {lesson.seats.length > 0 && (
          <span className="min-w-16 text-right text-[0.8125rem] text-ink-3 tabular">{fmt(t.today.lessonsCard.marked, { marked, total: lesson.seats.length })}</span>
        )}
      </Band>
      {lesson.seats.length === 0 ? (
        <p className="border-b border-line px-4 py-3 text-sm text-ink-3 sm:px-5">{t.today.emptyLesson}</p>
      ) : (
        <ul>
          {lesson.seats.map((seat) => {
            const child = seat.child
            const sub = [child.student_age, child.parent_name && fmt(t.today.lessonsCard.parentOf, { name: child.parent_name })].filter(Boolean).join(' · ')
            return (
              <li key={seat.id} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line px-4 py-[0.6875rem] sm:px-5">
                <div className="flex min-w-0 flex-[1.6_1_15rem] items-center gap-3">
                  <Avatar name={child.student_name} />
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2">
                      <ChildLink id={child.id} name={child.student_name} />
                      {child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                      {isPaymentDue(child) && <Mark tone="action">{t.children.pendingPayment}</Mark>}
                    </p>
                    {sub && <p className="mt-px truncate text-[0.8125rem] text-ink-3">{sub}</p>}
                  </div>
                </div>
                <div className="min-w-0 flex-[1.1_1_10.5rem] max-sm:hidden">
                  <p className="truncate text-sm">{labels.packageName(child.package_type)}</p>
                  <p className="mt-px text-[0.8125rem] text-ink-3 tabular">{formatPeriod(i18n, child.package_start_date, child.package_end_date)}</p>
                </div>
                <UsageLine usage={usage?.[child.id]} className="min-w-0 flex-[1_1_9.5rem] flex-nowrap" />
                <AttendancePicker
                  status={seat.status}
                  onChange={(status) => onMark(seat, status)}
                  isDisabled={saving.has(seat.id)}
                  label={fmt(t.children.detail.lessonStatus, { name: child.student_name })}
                  className="w-full shrink-0 sm:w-[17rem]"
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
