import { useMemo } from 'react'
import { Button as AriaButton, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { addMinutes, isSameDay, startOfDay } from 'date-fns'
import { CalendarBlankIcon, PlusIcon } from '@phosphor-icons/react'
import { SEATS_SHOWN, type Lesson } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { MonthCalendar, fromCalendarDate, toCalendarDate } from '../../ui/DateField'
import { Card } from '../../ui/Page'
import { LessonShape, SeatDots, typeClass, typeTone } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { SeatNames, useLessonTitle } from '../lessons/LessonBits'
import { LESSON_MINUTES, byDay, dayKey, seatsTaken, unmarkedIn } from './model'

/** A lesson's dot in its type's colour (sky, sun, pink). */
export const DOT_TONE = { sky: 'bg-sky', sun: 'bg-sun', pink: 'bg-pink' } as const

/** Seven days to pick from; each shows a dot per lesson, so a full day reads before it is opened. */
export function WeekStrip({
  days,
  selected,
  lessons,
  now,
  onSelect
}: {
  days: Date[]
  selected: Date
  lessons: Lesson[]
  now: Date
  onSelect: (day: Date) => void
}) {
  const { t, plural, date } = useI18n()
  const grouped = useMemo(() => byDay(lessons), [lessons])
  const todayStart = startOfDay(now)
  return (
    <ToggleButtonGroup
      aria-label={t.calendar.views.day}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[dayKey(selected)]}
      onSelectionChange={(keys) => {
        const key = [...keys][0]
        const day = days.find((item) => dayKey(item) === key)
        if (day) onSelect(day)
      }}
      className="on-felt grid grid-cols-7 gap-1 rounded-panel bg-felt p-1.5"
    >
      {days.map((day) => {
        const list = grouped.get(dayKey(day)) ?? []
        const isToday = isSameDay(day, now)
        return (
          <ToggleButton
            key={dayKey(day)}
            id={dayKey(day)}
            aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${plural(t.calendar.lessonCount, list.length)}` : ''}`}
            className={cx(
              'group flex min-w-0 flex-col items-center gap-0.5 rounded-[1.125rem] pt-1.5 pb-2 outline-none',
              'transition-[background-color,box-shadow] duration-180 ease-out data-focus-visible:ring-2 data-focus-visible:ring-focus',
              // The chosen day is a piece lifted off the felt
              'data-hovered:bg-hover data-selected:bg-raised data-selected:shadow-lift data-selected:data-hovered:bg-raised'
            )}
          >
            <span className={cx('text-[0.75rem] font-medium', isToday ? 'text-accent-ink' : day < todayStart ? 'text-ink-3' : 'text-ink-2')}>
              {date(day, { weekday: 'short' })}
            </span>
            <span
              className={cx(
                'grid size-8 place-items-center rounded-full text-[1.0625rem] font-semibold',
                isToday ? 'text-accent-ink shadow-[inset_0_0_0_2px_var(--fill)]' : day < todayStart ? 'text-ink-3' : 'text-ink'
              )}
            >
              {date(day, { day: 'numeric' })}
            </span>
            <span aria-hidden className="flex h-1.5 items-center gap-[0.1875rem]">
              {list.slice(0, 4).map((lesson) => (
                <span key={lesson.id} className={cx('size-1.5 rounded-full', DOT_TONE[typeTone(lesson.event_type)])} />
              ))}
            </span>
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )
}

/** One day's lessons, in order, each on its type's felt with who is in it; a lesson opens on tap. */
export function DayAgenda({
  day,
  lessons,
  now,
  isPending,
  onOpen,
  onCreate
}: {
  day: Date
  lessons: Lesson[]
  now: Date
  isPending: boolean
  onOpen: (lesson: Lesson) => void
  onCreate: (day: Date) => void
}) {
  const { t, plural, date } = useI18n()
  const list = useMemo(() => byDay(lessons).get(dayKey(day)) ?? [], [lessons, day])

  return (
    <section aria-labelledby="agenda-day" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 px-1">
        <h2 id="agenda-day" className="min-w-0 flex-1 text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em]">
          {date(day, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {list.length > 0 && <span className="shrink-0 text-sm text-ink-3">{plural(t.calendar.lessonCount, list.length)}</span>}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-panel" />
          <Skeleton className="h-28 rounded-panel" />
        </div>
      ) : list.length === 0 ? (
        <div className="on-felt rounded-panel bg-felt">
          <EmptyState
            icon={<CalendarBlankIcon aria-hidden className="size-8" />}
            title={t.calendar.noLessonsDay}
            action={
              <Button size="sm" variant="secondary" onPress={() => onCreate(day)} icon={<PlusIcon aria-hidden weight="bold" className="size-3.5" />}>
                {t.calendar.addLessonDay}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {list.map((lesson) => (
              <AgendaCard key={lesson.id} lesson={lesson} now={now} onOpen={() => onOpen(lesson)} />
            ))}
          </ul>
          <Button size="sm" variant="quiet" onPress={() => onCreate(day)} icon={<PlusIcon aria-hidden weight="bold" className="size-3.5" />} className="self-start">
            {t.calendar.addLessonDay}
          </Button>
        </>
      )}
    </section>
  )
}

/**
 * The column beside a day on wide screens: a month to jump to any day from, and the day in
 * numbers (lessons, seats taken and free, attendance still to mark).
 */
export function DayRail({
  day,
  lessons,
  now,
  isPending,
  onSelect
}: {
  day: Date
  lessons: Lesson[]
  now: Date
  isPending: boolean
  onSelect: (day: Date) => void
}) {
  const { t } = useI18n()
  const list = useMemo(() => byDay(lessons).get(dayKey(day)) ?? [], [lessons, day])
  const sum = (count: (lesson: Lesson) => number) => list.reduce((total, lesson) => total + count(lesson), 0)
  const unmarked = sum((lesson) => unmarkedIn(lesson, now))
  const rows = [
    { key: 'lessons', label: t.calendar.dayRail.lessons, value: list.length },
    { key: 'booked', label: t.calendar.dayRail.booked, value: sum(seatsTaken) },
    { key: 'free', label: t.calendar.dayRail.free, value: sum((lesson) => Math.max(SEATS_SHOWN - seatsTaken(lesson), 0)) },
    ...(unmarked > 0 ? [{ key: 'unmarked', label: t.calendar.dayRail.unmarked, value: unmarked }] : [])
  ]

  return (
    <aside aria-label={t.calendar.dayRail.summary} className="flex flex-col gap-4">
      <Card bodyClassName="flex justify-center px-4 py-4">
        <MonthCalendar
          aria-label={t.calendar.dayRail.pickDay}
          value={toCalendarDate(day)}
          onChange={(value) => {
            const next = fromCalendarDate(value)
            if (next) onSelect(next)
          }}
        />
      </Card>
      <Card title={t.calendar.dayRail.summary} bodyClassName="px-4 pb-2 sm:px-[1.375rem]">
        <dl>
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
              <dt className={cx('text-[0.9375rem]', row.key === 'unmarked' ? 'font-medium text-amber-ink' : 'text-ink-2')}>{row.label}</dt>
              <dd className={cx('text-[1.0625rem] font-semibold tabular', row.key === 'unmarked' && 'text-amber-ink')}>
                {isPending ? <Skeleton className="h-5 w-6" /> : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </aside>
  )
}

function AgendaCard({ lesson, now, onOpen }: { lesson: Lesson; now: Date; onOpen: () => void }) {
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const running = now >= start && now < end
  const taken = seatsTaken(lesson)
  const unmarked = unmarkedIn(lesson, now)
  const seats = fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })
  const time = date(start, { hour: '2-digit', minute: '2-digit' })
  const rule = 'border-[color-mix(in_srgb,var(--t-ink)_12%,transparent)]'

  return (
    <li
      className={cx(
        typeClass(lesson.event_type),
        'relative rounded-panel bg-(--t-felt) text-(--t-ink) transition-[scale] duration-150 has-[[data-pressed]]:scale-[0.99]',
        running && 'ring-2 ring-(--t-mid) ring-inset',
        'has-[[data-focus-visible]]:ring-2 has-[[data-focus-visible]]:ring-focus'
      )}
    >
      <div className="flex items-start gap-3.5 px-4 pt-3.5 pb-3 sm:px-5">
        <div className="shrink-0">
          <p className="text-[1.375rem] leading-7 font-semibold tracking-[-0.02em]">{time}</p>
          <p className="text-[0.8125rem] opacity-80">{date(end, { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex min-w-0 items-center gap-2 text-[0.96875rem] leading-[1.375rem] font-semibold">
            <LessonShape type={lesson.event_type} />
            <span className="truncate">{title(lesson)}</span>
          </p>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.84375rem]">
            <span>
              {labels.ageGroup(lesson.age_group)}, {seats}
            </span>
            {running && <Mark tone="pink">{t.calendar.now}</Mark>}
            {unmarked > 0 && <Mark tone="action">{plural(t.calendar.unmarkedShort, unmarked)}</Mark>}
          </p>
        </div>
        <SeatDots taken={taken} capacity={SEATS_SHOWN} size="sm" className="mt-2 max-sm:hidden" />
      </div>
      <div className={cx('border-t px-4 py-2.5 text-[0.84375rem] sm:px-5', rule)}>
        {lesson.seats.length === 0 ? <p className="opacity-85">{t.calendar.lesson.noChildren}</p> : <SeatNames seats={lesson.seats} layout="row" />}
      </div>
      <AriaButton
        aria-label={[`${time} ${title(lesson)}`, labels.ageGroup(lesson.age_group), seats, running ? t.calendar.now : '', unmarked ? plural(t.calendar.unmarked, unmarked) : '']
          .filter(Boolean)
          .join(', ')}
        onPress={onOpen} className="absolute inset-0 cursor-pointer rounded-panel outline-none" />
    </li>
  )
}
