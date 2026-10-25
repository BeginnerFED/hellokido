import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { differenceInMinutes } from 'date-fns'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { SEATS_SHOWN, type AttendanceStatus, type Lesson, type Seat, type UsageMap } from '@hellokido/core/api'
import { holdsSeat } from '@hellokido/core/rules/attendance.js'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useActions } from '../../shell/Actions'
import { Avatar, EmptyState, LiveMark, LoadError, Mark } from '../../ui/Bits'
import { ButtonLink, textLinkClass } from '../../ui/Button'
import { LessonShape, MiniBeads, typeClass } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { beadsLabel } from '../children/ChildBits'
import { isPaymentDue } from '../children/rules'
import { LESSON_MINUTES } from '../calendar/model'
import { AttendancePicker } from '../lessons/AttendancePicker'
import { useLessonTitle } from '../lessons/LessonBits'
import { lessonEnd } from './data'
import { ChildLink, ListSkeleton } from './sections'

const hhmm = { hour: '2-digit', minute: '2-digit' } as const

/** "10:00–11:30" */
function useRange() {
  const { date } = useI18n()
  return (lesson: Lesson) => `${date(lesson.event_date, hhmm)}–${date(lessonEnd(lesson), hhmm)}`
}

/**
 * The day on a time strip: each lesson a block of its type's felt at its real time and length,
 * past hours hatched, a pink line at the time now. Selecting a block brings it onto the card below.
 */
export function DayRibbon({
  lessons,
  now,
  heroId,
  onSelect,
  isPending
}: {
  lessons: Lesson[]
  now: Date
  heroId: string | undefined
  onSelect: (id: string) => void
  isPending: boolean
}) {
  const { t, fmt, date } = useI18n()
  const title = useLessonTitle()
  const range = useRange()

  const day = useMemo(() => {
    const base = new Date(now)
    base.setHours(0, 0, 0, 0)
    const hours = lessons.flatMap((lesson) => [new Date(lesson.event_date), lessonEnd(lesson)].map((at) => differenceInMinutes(at, base) / 60))
    const from = Math.min(9, Math.floor(Math.min(...hours, 9)))
    const to = Math.max(18, Math.ceil(Math.max(...hours, 18)))
    return { base, from, to }
  }, [lessons, now])

  const span = (day.to - day.from) * 60
  const at = (when: Date) => ((differenceInMinutes(when, day.base) - day.from * 60) / span) * 100
  const nowAt = at(now)
  const nowShown = nowAt >= 0 && nowAt <= 100
  const pastWidth = Math.min(Math.max(nowAt, 0), 100)

  // Lessons that overlap share the strip's height, each in its own lane
  const lanes = useMemo(() => {
    const ends: number[] = []
    const lane = new Map<string, number>()
    for (const lesson of [...lessons].sort((a, b) => a.event_date.localeCompare(b.event_date))) {
      const start = new Date(lesson.event_date).getTime()
      let index = ends.findIndex((end) => end <= start)
      if (index === -1) index = ends.push(0) - 1
      ends[index] = lessonEnd(lesson).getTime()
      lane.set(lesson.id, index)
    }
    return { lane, count: Math.max(ends.length, 1) }
  }, [lessons])

  const hours = Array.from({ length: day.to - day.from + 1 }, (_, index) => day.from + index)
  const label = (hour: number) => date(new Date(day.base.getFullYear(), day.base.getMonth(), day.base.getDate(), hour), hhmm)

  return (
    <section aria-label={t.today.web.ribbon} className="on-felt overflow-x-auto rounded-panel bg-felt px-4 pt-3.5 pb-4 sm:px-[1.375rem]">
      <div className="min-w-[44rem]">
        <div aria-hidden className="relative h-[1.125rem] text-[0.78125rem] text-ink-3">
          {hours.map((hour, index) => {
            const left = ((hour - day.from) / (day.to - day.from)) * 100
            // The time chip on the now line takes the place of the hour it would touch
            if (nowShown && Math.abs(left - nowAt) < 3.2) return null
            const edge = index === 0 ? 'translate-x-0' : index === hours.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
            return (
              <span key={hour} className={cx('absolute top-0 tabular', edge)} style={{ left: `${left}%` }}>
                {label(hour)}
              </span>
            )
          })}
        </div>
        <div className="relative mt-1.5 h-[3.875rem] rounded-2xl bg-track">
          {pastWidth > 0 && <div aria-hidden className="hatch absolute inset-y-0 left-0 rounded-l-2xl" style={{ width: `${pastWidth}%` }} />}
          {nowShown && (
            <div aria-hidden className="absolute -top-2 -bottom-1 w-0.5 -translate-x-1/2 bg-pink" style={{ left: `${nowAt}%` }}>
              <span className="absolute -top-3.5 left-1/2 z-[3] -translate-x-1/2 rounded-lg bg-now-chip px-1.5 py-px text-[0.71875rem] font-semibold whitespace-nowrap text-on-now-chip tabular">
                {date(now, hhmm)}
              </span>
            </div>
          )}
          {lessons.map((lesson) => {
            const start = new Date(lesson.event_date)
            const left = Math.max(at(start), 0)
            const width = Math.min(at(lessonEnd(lesson)), 100) - left
            const running = now >= start && now < lessonEnd(lesson)
            const elapsed = running ? Math.round((differenceInMinutes(now, start) / LESSON_MINUTES) * 100) : 0
            const taken = lesson.seats.filter((seat) => holdsSeat(seat.status)).length
            const lane = lanes.lane.get(lesson.id) ?? 0
            const chosen = lesson.id === heroId
            const name = title(lesson)
            return (
              <AriaButton
                key={lesson.id}
                aria-pressed={chosen}
                aria-label={fmt(t.today.web.focusLesson, { lesson: `${range(lesson)} ${name}` })}
                onPress={() => onSelect(lesson.id)}
                className={cx(
                  typeClass(lesson.event_type),
                  'absolute z-[1] flex flex-col justify-center gap-px overflow-hidden rounded-xl bg-(--t-felt) px-3 py-1.5 text-left text-(--t-ink) outline-none',
                  'transition-[box-shadow,scale] duration-150 data-pressed:scale-[0.99] data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-track',
                  chosen ? 'shadow-[inset_0_0_0_2px_var(--t-mid)]' : 'data-hovered:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--t-mid)_55%,transparent)]'
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: `calc(5px + (100% - 10px) * ${lane} / ${lanes.count})`,
                  height: `calc((100% - 10px) / ${lanes.count} - ${lanes.count > 1 ? 2 : 0}px)`,
                  // The running lesson's elapsed part sits a shade deeper
                  backgroundImage: running
                    ? `linear-gradient(90deg, color-mix(in srgb, var(--t-mid) 16%, var(--t-felt)) 0 ${elapsed}%, transparent ${elapsed}%)`
                    : undefined
                }}
              >
                <span className="flex min-w-0 items-center gap-[7px] text-sm leading-[1.125rem] font-semibold whitespace-nowrap">
                  <LessonShape type={lesson.event_type} />
                  <span className="truncate">{name}</span>
                </span>
                {lanes.count === 1 && (
                  <span className="truncate text-[0.78125rem] leading-4 whitespace-nowrap tabular">
                    {range(lesson)}<span className="max-sm:hidden">, {fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })}</span>
                  </span>
                )}
              </AriaButton>
            )
          })}
          {!isPending && lessons.length === 0 && (
            <p className="absolute inset-0 grid place-items-center text-[0.84375rem] text-ink-3">{t.today.noLessons}</p>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * The lesson of the moment on its type's felt: the time, how far it has run, and a row per child
 * with the lessons left and attendance in one tap.
 */
export function HeroCard({
  lesson,
  now,
  usage,
  saving,
  onMark,
  isPending,
  isError,
  onRetry
}: {
  lesson: Lesson | undefined
  now: Date
  usage: UsageMap | undefined
  saving: Set<string>
  onMark: (seat: Seat, status: AttendanceStatus) => void
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const i18n = useI18n()
  const { t, fmt, plural } = i18n
  const labels = useLabels()
  const title = useLessonTitle()
  const range = useRange()
  const { startTask } = useActions()

  if (isError)
    return (
      <section className="rounded-panel bg-felt p-5">
        <LoadError message={t.today.lessonsFailed} retryLabel={t.common.retry} onRetry={onRetry} />
      </section>
    )
  if (isPending)
    return (
      <section aria-busy className="rounded-panel bg-felt py-2">
        <ListSkeleton rows={5} />
      </section>
    )
  if (!lesson)
    return (
      <section className="rounded-panel bg-felt">
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
      </section>
    )

  const start = new Date(lesson.event_date)
  const end = lessonEnd(lesson)
  const running = now >= start && now < end
  const over = now >= end
  const elapsed = Math.max(0, differenceInMinutes(now, start))
  const progress = running ? Math.round((elapsed / LESSON_MINUTES) * 100) : over ? 100 : 0
  const taken = lesson.seats.filter((seat) => holdsSeat(seat.status)).length
  const marked = lesson.seats.filter((seat) => seat.status !== 'scheduled').length
  const missing = lesson.seats.length - marked
  const startsIn = differenceInMinutes(start, now)
  // Forgotten attendance is work waiting: amber, like every other "needs your action"
  const forgotten = over && missing > 0

  const state = running ? (
    <LiveMark>
      {t.today.now}, {fmt(t.today.board.left, { count: Math.max(differenceInMinutes(end, now), 1) })}
    </LiveMark>
  ) : (
    <span
      className={cx(
        'inline-flex h-[1.875rem] items-center gap-[7px] rounded-full bg-raised px-3 text-sm font-medium whitespace-nowrap dark:bg-(--t-track)',
        forgotten && 'text-amber-ink'
      )}
    >
      {forgotten ? <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-amber" /> : <LessonShape type={lesson.event_type} className="size-2!" />}
      {over ? (missing > 0 ? plural(t.today.board.missing, missing) : t.today.board.done) : startsIn <= 180 ? fmt(t.today.board.startsIn, { count: startsIn }) : t.today.board.next}
    </span>
  )

  return (
    <section
      aria-labelledby="hero-time"
      className={cx(typeClass(lesson.event_type), 'flex min-w-0 flex-col rounded-panel bg-(--t-felt) px-4 pt-5 text-(--t-ink) sm:px-[1.375rem]')}
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <h2 id="hero-time" className="text-[2rem] leading-10 font-semibold tracking-[-0.03em] tabular lg:text-[2.5rem] lg:leading-[2.75rem]">
          <time dateTime={lesson.event_date}>{range(lesson)}</time>
        </h2>
        {state}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[1.0625rem] leading-[1.375rem] font-semibold">
        <LessonShape type={lesson.event_type} />
        {title(lesson)}
        <span className="text-[0.9375rem] font-normal opacity-[0.88]">
          {labels.ageGroup(lesson.age_group)}, {fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={running ? fmt(t.today.board.elapsed, { count: elapsed }) : t.today.lessonsTitle}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-(--t-track)"
      >
        <div className="h-full rounded-full bg-(--t-mid)" style={{ width: `${progress}%` }} />
      </div>

      {lesson.seats.length === 0 ? (
        <p className="mt-4 border-t border-[color-mix(in_srgb,var(--t-ink)_12%,transparent)] py-4 text-[0.9375rem] opacity-90">{t.today.emptyLesson}</p>
      ) : (
        <>
          <div aria-hidden className="mt-4 hidden grid-cols-[minmax(0,1fr)_8rem_14.5rem] gap-x-4 pb-1.5 text-[0.78125rem] font-medium opacity-80 md:grid">
            <span>{t.today.web.childAndPackage}</span>
            <span>{t.today.lessonsCard.left}</span>
            <span>{t.today.lessonsCard.attendance}</span>
          </div>
          <ul className="max-md:mt-3">
            {lesson.seats.map((seat) => {
              const child = seat.child
              const sub = [labels.packageName(child.package_type), child.student_age].filter(Boolean).join(', ')
              return (
                <li
                  key={seat.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 border-t border-[color-mix(in_srgb,var(--t-ink)_12%,transparent)] py-2.5 md:grid-cols-[minmax(0,1fr)_8rem_14.5rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={child.student_name} tone="type" />
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2">
                        <ChildLink id={child.id} name={child.student_name} className="text-inherit" />
                        {child.is_active !== true && <Mark tone="neutral">{t.today.archived}</Mark>}
                        {isPaymentDue(child) && <Mark tone="action">{t.children.pendingPayment}</Mark>}
                      </p>
                      {sub && <p className="truncate text-[0.84375rem] leading-[1.125rem] opacity-[0.82]">{sub}</p>}
                    </div>
                  </div>
                  <MiniBeads usage={usage?.[child.id]} label={usage?.[child.id] ? beadsLabel(i18n, usage[child.id]) : ''} freeText={labels.packageName(child.package_type)} />
                  <AttendancePicker
                    status={seat.status}
                    onChange={(status) => onMark(seat, status)}
                    isDisabled={saving.has(seat.id)}
                    label={fmt(t.children.detail.lessonStatus, { name: child.student_name })}
                    onType
                    className="col-span-2 md:col-span-1"
                  />
                </li>
              )
            })}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[color-mix(in_srgb,var(--t-ink)_12%,transparent)] pt-3 pb-3.5 text-[0.84375rem]">
        <span>{lesson.seats.length > 0 ? fmt(t.today.lessonsCard.foot, { marked, total: lesson.seats.length }) : labels.ageGroup(lesson.age_group)}</span>
        <AriaButton onPress={() => startTask('lesson', { lessonId: lesson.id })} className={textLinkClass('inherit')}>
          {t.today.web.openLesson}
        </AriaButton>
      </div>
    </section>
  )
}
