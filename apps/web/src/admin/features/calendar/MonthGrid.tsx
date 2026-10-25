import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { addDays, isSameDay, isSameMonth, startOfDay } from 'date-fns'
import type { Lesson } from '@hellokido/core/api'
import { useI18n } from '../../providers/I18n'
import { Card } from '../../ui/Page'
import { LessonShape, typeClass, typeTone } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { useLessonTitle } from '../lessons/LessonBits'
import { DOT_TONE } from './DayAgenda'
import { dateRange } from './labels'
import { byDay, dayKey, daysOf, rangeOf, unmarkedIn, weekKey } from './model'
import { WeekTheme } from './WeekTheme'

type MonthProps = {
  anchor: Date
  lessons: Lesson[]
  themes: Record<string, string> | undefined
  themesLoading: boolean
  now: Date
  onOpenDay: (day: Date) => void
  onOpen: (lesson: Lesson) => void
  onCreateDay: (day: Date) => void
}

const COLUMNS = 'grid grid-cols-[8.5rem_repeat(7,minmax(0,1fr))] gap-1.5'

function useWeeks(anchor: Date) {
  return useMemo(() => {
    const { start, end } = rangeOf('month', anchor)
    const weeks: Date[] = []
    for (let monday = start; monday < end; monday = addDays(monday, 7)) weeks.push(monday)
    return weeks
  }, [anchor])
}

/**
 * The month as rows of felt day tiles. Each week starts with its theme, written where it is planned;
 * a day lists its first lessons in their type's felt and opens in the day view. Days that are over
 * are hatched, today has a ring. An empty spot adds a lesson on that day.
 */
export function MonthGrid({ anchor, lessons, themes, themesLoading, now, onOpenDay, onOpen, onCreateDay }: MonthProps) {
  const { t, date } = useI18n()
  const weeks = useWeeks(anchor)
  const grouped = useMemo(() => byDay(lessons), [lessons])

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden className={cx(COLUMNS, 'sticky top-[4.25rem] z-10 bg-page pb-1 text-[0.8125rem] text-ink-3')}>
        <span className="px-2.5">{t.calendar.theme.label}</span>
        {daysOf(weeks[0]).map((day) => (
          <span key={day.getDay()} className="px-2.5">
            {date(day, { weekday: 'short' })}
          </span>
        ))}
      </div>
      {weeks.map((monday) => (
        <div key={dayKey(monday)} className={COLUMNS}>
          <div className="rounded-tablet p-1">
            <WeekTheme variant="cell" week={monday} theme={themes?.[weekKey(monday)]} isLoading={themesLoading} />
          </div>
          {daysOf(monday).map((day) => (
            <MonthDay
              key={dayKey(day)}
              day={day}
              inMonth={isSameMonth(day, anchor)}
              lessons={grouped.get(dayKey(day)) ?? []}
              now={now}
              onOpenDay={onOpenDay}
              onOpen={onOpen}
              onCreateDay={onCreateDay}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function MonthDay({
  day,
  inMonth,
  lessons,
  now,
  onOpenDay,
  onOpen,
  onCreateDay
}: {
  day: Date
  inMonth: boolean
  lessons: Lesson[]
} & Pick<MonthProps, 'now' | 'onOpenDay' | 'onOpen' | 'onCreateDay'>) {
  const { t, fmt, plural, date } = useI18n()
  const title = useLessonTitle()
  const isToday = isSameDay(day, now)
  const past = day < startOfDay(now)
  // Four fit; from five on, three show and the rest are counted
  const shown = lessons.length > 4 ? lessons.slice(0, 3) : lessons
  const more = lessons.length - shown.length

  return (
    <div
      className={cx(
        'relative min-h-[7.5rem] rounded-tablet p-1.5',
        inMonth ? 'bg-felt' : 'bg-[color-mix(in_srgb,var(--felt)_45%,transparent)]',
        past && 'hatch',
        isToday && 'shadow-[inset_0_0_0_2px_var(--fill)]'
      )}
    >
      {/* The empty day: a click adds a lesson on it, the time is picked in the sheet */}
      <div aria-hidden className="absolute inset-0 cursor-cell rounded-tablet" onClick={() => onCreateDay(day)} />
      <div className="pointer-events-none relative flex flex-col gap-1">
        <AriaButton
          onPress={() => onOpenDay(day)}
          aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${lessons.length ? `, ${plural(t.calendar.lessonCount, lessons.length)}` : ''}`}
          className={cx(
            'pointer-events-auto grid h-7 min-w-7 place-items-center self-start rounded-full px-1 text-[0.875rem] outline-none',
            'transition-colors duration-150 data-hovered:bg-hover data-focus-visible:ring-2 data-focus-visible:ring-focus',
            isToday ? 'font-semibold text-accent-ink' : inMonth && !past ? 'font-semibold text-ink' : cx('text-ink-3', inMonth ? 'font-semibold' : 'font-normal')
          )}
        >
          {date(day, { day: 'numeric' })}
        </AriaButton>
        {shown.map((lesson) => {
          const time = date(lesson.event_date, { hour: '2-digit', minute: '2-digit' })
          const unmarked = unmarkedIn(lesson, now)
          return (
            <AriaButton
              key={lesson.id}
              onPress={() => onOpen(lesson)}
              aria-label={[time, title(lesson), unmarked ? plural(t.calendar.unmarked, unmarked) : ''].filter(Boolean).join(', ')}
              className={cx(
                typeClass(lesson.event_type),
                'pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-lg bg-(--t-felt) px-1.5 py-[0.1875rem] text-left text-[0.75rem] leading-4 text-(--t-ink) outline-none',
                'transition-shadow duration-150 data-hovered:shadow-lift data-focus-visible:ring-2 data-focus-visible:ring-focus'
              )}
            >
              <LessonShape type={lesson.event_type} className="size-2!" />
              <span className="font-semibold">{time}</span>
              <span className="min-w-0 truncate">{title(lesson)}</span>
              {unmarked > 0 && <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-amber" />}
            </AriaButton>
          )
        })}
        {more > 0 && (
          <AriaButton
            onPress={() => onOpenDay(day)}
            className="pointer-events-auto self-start rounded-full px-1.5 py-0.5 text-[0.75rem] font-medium text-ink-2 outline-none data-hovered:bg-hover data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus"
          >
            {fmt(t.calendar.moreLessons, { count: more })}
          </AriaButton>
        )}
      </div>
    </div>
  )
}

/**
 * The month on a phone: a day per tap target with a dot per lesson, then the weeks' themes. A day
 * opens in the day view, where its lessons are.
 */
export function MonthDots({ anchor, lessons, themes, themesLoading, now, onOpenDay }: Omit<MonthProps, 'onOpen' | 'onCreateDay'>) {
  const i18n = useI18n()
  const { t, plural, date } = i18n
  const weeks = useWeeks(anchor)
  const grouped = useMemo(() => byDay(lessons), [lessons])
  const todayStart = startOfDay(now)

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-panel bg-felt p-1.5">
        <div aria-hidden className="grid grid-cols-7 pt-1.5 pb-1 text-center text-[0.75rem] text-ink-3">
          {daysOf(weeks[0]).map((day) => (
            <span key={day.getDay()}>{date(day, { weekday: 'narrow' })}</span>
          ))}
        </div>
        {weeks.map((monday) => (
          <div key={dayKey(monday)} className="grid grid-cols-7">
            {daysOf(monday).map((day) => {
              const list = grouped.get(dayKey(day)) ?? []
              const isToday = isSameDay(day, now)
              const inMonth = isSameMonth(day, anchor)
              return (
                <AriaButton
                  key={dayKey(day)}
                  onPress={() => onOpenDay(day)}
                  aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${plural(t.calendar.lessonCount, list.length)}` : ''}`}
                  className="flex min-h-14 flex-col items-center gap-1 rounded-[1rem] py-1.5 outline-none transition-colors duration-150 data-focus-visible:ring-2 data-focus-visible:ring-focus data-pressed:bg-hover"
                >
                  <span
                    className={cx(
                      'grid size-8 place-items-center rounded-full text-[0.9375rem]',
                      isToday
                        ? 'font-semibold text-accent-ink shadow-[inset_0_0_0_2px_var(--fill)]'
                        : inMonth && day >= todayStart
                          ? 'font-semibold text-ink'
                          : cx('text-ink-3', inMonth ? 'font-semibold' : 'font-normal')
                    )}
                  >
                    {date(day, { day: 'numeric' })}
                  </span>
                  <span aria-hidden className="flex h-1.5 items-center gap-[0.1875rem]">
                    {list.slice(0, 4).map((lesson) => (
                      <span key={lesson.id} className={cx('size-1.5 rounded-full', inMonth ? DOT_TONE[typeTone(lesson.event_type)] : 'bg-mute')} />
                    ))}
                  </span>
                </AriaButton>
              )
            })}
          </div>
        ))}
      </div>

      <Card title={t.calendar.theme.label}>
        <ul className="pb-2">
          {weeks.map((monday) => (
            <li key={dayKey(monday)} className="relative flex items-start gap-3 border-t border-line px-4 py-2 first:border-t-0 sm:px-[1.375rem]">
              <span className="w-[7.5rem] shrink-0 pt-1.5 text-[0.84375rem] text-ink-2">
                {dateRange(i18n, monday, addDays(monday, 6), { day: 'numeric', month: 'short' })}
              </span>
              {/* The whole row opens the week's theme, dates included */}
              <WeekTheme
                variant="cell"
                week={monday}
                theme={themes?.[weekKey(monday)]}
                isLoading={themesLoading}
                className="min-w-0 flex-1 after:absolute after:inset-0"
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
