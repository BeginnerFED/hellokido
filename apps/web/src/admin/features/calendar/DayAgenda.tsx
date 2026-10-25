import { useMemo } from 'react'
import { Button as AriaButton, ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { addMinutes, isSameDay, startOfDay } from 'date-fns'
import { CalendarBlankIcon, PlusIcon } from '@phosphor-icons/react'
import { SEATS_SHOWN, type Lesson } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, Mark, Skeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { AgeTablet, LessonShape, SocketBoard } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { lessonTone, SeatNames, useLessonTitle } from '../lessons/LessonBits'
import { LESSON_MINUTES, byDay, dayKey, seatsTaken, unmarkedIn } from './model'

const DOT_TONE: Record<string, string> = { ingilizce: 'bg-accent', duyusal: 'bg-pink' }

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
      className="grid grid-cols-7 gap-1 rounded-panel border border-line bg-surface p-1.5 shadow-piece"
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
              'group flex min-w-0 flex-col items-center gap-0.5 rounded-[0.75rem] pt-1.5 pb-2 outline-none',
              'transition-colors duration-150 data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus',
              'data-selected:bg-accent-solid data-selected:text-on-accent data-selected:data-hovered:bg-accent-solid'
            )}
          >
            <span
              className={cx(
                'text-[0.75rem] font-medium group-data-selected:text-on-accent',
                isToday ? 'text-accent-ink' : day < todayStart ? 'text-ink-3' : 'text-ink-2'
              )}
            >
              {date(day, { weekday: 'short' })}
            </span>
            <span
              className={cx(
                'grid size-8 place-items-center rounded-full text-[1.0625rem] font-semibold tabular',
                isToday && 'ring-[1.5px] ring-accent group-data-selected:ring-on-accent',
                !isToday && day < todayStart && 'text-ink-3 group-data-selected:text-on-accent'
              )}
            >
              {date(day, { day: 'numeric' })}
            </span>
            <span aria-hidden className="flex h-1.5 items-center gap-[0.1875rem]">
              {list.slice(0, 4).map((lesson) => (
                <span
                  key={lesson.id}
                  className={cx('size-1.5 rounded-full group-data-selected:bg-on-accent', DOT_TONE[lesson.event_type] ?? 'bg-ink-3')}
                />
              ))}
            </span>
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )
}

/** One day's lessons, in order, with who is in each; a lesson opens on tap. */
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
      <div className="flex items-baseline gap-3">
        <h2 id="agenda-day" className="min-w-0 flex-1 text-[1rem] font-semibold">
          {date(day, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {list.length > 0 && <span className="shrink-0 text-sm text-ink-2">{plural(t.calendar.lessonCount, list.length)}</span>}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-panel" />
          <Skeleton className="h-28 rounded-panel" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="rounded-panel border border-dashed border-line-strong"
          icon={<CalendarBlankIcon aria-hidden className="size-8" />}
          title={t.calendar.noLessonsDay}
          action={
            <Button size="sm" variant="secondary" onPress={() => onCreate(day)} icon={<PlusIcon aria-hidden weight="bold" className="size-3.5" />}>
              {t.calendar.addLessonDay}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {list.map((lesson) => (
              <AgendaCard key={lesson.id} lesson={lesson} now={now} onOpen={() => onOpen(lesson)} />
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onCreate(day)}
            icon={<PlusIcon aria-hidden weight="bold" className="size-3.5" />}
            className="self-start"
          >
            {t.calendar.addLessonDay}
          </Button>
        </>
      )}
    </section>
  )
}

function AgendaCard({ lesson, now, onOpen }: { lesson: Lesson; now: Date; onOpen: () => void }) {
  const { t, fmt, plural, date } = useI18n()
  const labels = useLabels()
  const title = useLessonTitle()
  const start = new Date(lesson.event_date)
  const end = addMinutes(start, LESSON_MINUTES)
  const past = start < startOfDay(now)
  const running = now >= start && now < end
  const taken = seatsTaken(lesson)
  const unmarked = unmarkedIn(lesson, now)
  const capacity = fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN })
  const time = date(start, { hour: '2-digit', minute: '2-digit' })

  return (
    <li className={cx('relative rounded-panel border shadow-piece has-[[data-focus-visible]]:ring-2 has-[[data-focus-visible]]:ring-focus', lessonTone(lesson.event_type, past, true))}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2.5">
        <div className="w-12 shrink-0">
          <p className="text-[1.0625rem] leading-tight font-semibold tabular">{time}</p>
          <p className="text-[0.75rem] text-ink-3 tabular">{date(end, { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <LessonShape type={lesson.event_type} />
            <span className="truncate">{title(lesson)}</span>
          </p>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <AgeTablet group={lesson.age_group} label={labels.ageGroup(lesson.age_group)} className="text-[0.8125rem] text-ink-2" />
            {running && <Mark tone="accent">{t.calendar.now}</Mark>}
            {unmarked > 0 && <Mark tone="action">{plural(t.calendar.unmarked, unmarked)}</Mark>}
          </p>
        </div>
        <SocketBoard
          className="max-sm:hidden"
          size="sm"
          capacity={SEATS_SHOWN}
          label={capacity}
          seats={lesson.seats.map((seat) => ({ id: seat.id, name: seat.child.student_name, status: seat.status }))}
        />
        <span aria-label={capacity} className="text-[0.8125rem] text-ink-3 tabular sm:hidden">
          {taken}/{SEATS_SHOWN}
        </span>
      </div>
      <div className="border-t border-[color-mix(in_oklab,var(--line)_70%,transparent)] px-4 py-2.5">
        {lesson.seats.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-3">{t.calendar.lesson.noChildren}</p>
        ) : (
          <SeatNames seats={lesson.seats} layout="row" className="text-[0.8125rem]" />
        )}
      </div>
      <AriaButton aria-label={`${time} ${title(lesson)}`} onPress={onOpen} className="absolute inset-0 cursor-pointer rounded-panel outline-none" />
    </li>
  )
}
