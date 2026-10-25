import { useMemo } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { addDays, isSameDay, isSameMonth, startOfDay } from 'date-fns'
import type { Lesson } from '@hellokido/core/api'
import { useI18n } from '../../providers/I18n'
import { LessonShape } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { lessonTone, useLessonTitle } from '../lessons/LessonBits'
import { dateRange } from './labels'
import { byDay, dayKey, daysOf, rangeOf, unmarkedIn, weekKey } from './model'
import { WeekTheme } from './WeekTheme'

const DOT_TONE: Record<string, string> = { ingilizce: 'bg-accent', duyusal: 'bg-pink' }

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

function useWeeks(anchor: Date) {
  return useMemo(() => {
    const { start, end } = rangeOf('month', anchor)
    const weeks: Date[] = []
    for (let monday = start; monday < end; monday = addDays(monday, 7)) weeks.push(monday)
    return weeks
  }, [anchor])
}

/**
 * The month as weeks. Each week starts with its theme, written where it is planned; a day lists
 * its first lessons and opens in the day view. An empty spot adds a lesson on that day.
 */
export function MonthGrid({ anchor, lessons, themes, themesLoading, now, onOpenDay, onOpen, onCreateDay }: MonthProps) {
  const { t, date } = useI18n()
  const weeks = useWeeks(anchor)
  const grouped = useMemo(() => byDay(lessons), [lessons])

  return (
    <div className="overflow-clip rounded-panel border border-line bg-surface shadow-piece">
      <div aria-hidden className="grid grid-cols-[9rem_repeat(7,minmax(0,1fr))] border-b border-line bg-surface-2 text-[0.75rem] font-medium text-ink-3">
        <span className="px-3 py-2">{t.calendar.theme.label}</span>
        {daysOf(weeks[0]).map((day) => (
          <span key={day.getDay()} className="border-l border-line px-2.5 py-2">
            {date(day, { weekday: 'short' })}
          </span>
        ))}
      </div>
      {weeks.map((monday) => (
        <div key={dayKey(monday)} className="grid grid-cols-[9rem_repeat(7,minmax(0,1fr))] border-b border-line last:border-b-0">
          <div className="bg-surface-2 p-1.5">
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
    <div className={cx('relative min-h-[7.5rem] border-l border-line p-1.5', !inMonth && 'bg-[color-mix(in_oklab,var(--surface-2)_70%,transparent)]')}>
      {/* The empty day: a click adds a lesson on it, the time is picked in the sheet */}
      <div aria-hidden className="absolute inset-0 cursor-cell" onClick={() => onCreateDay(day)} />
      <div className="pointer-events-none relative flex flex-col gap-0.5">
        <AriaButton
          onPress={() => onOpenDay(day)}
          aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${lessons.length ? `, ${plural(t.calendar.lessonCount, lessons.length)}` : ''}`}
          className={cx(
            'pointer-events-auto mb-0.5 grid size-7 place-items-center rounded-full text-[0.8125rem] font-semibold tabular outline-none',
            'data-focus-visible:ring-2 data-focus-visible:ring-focus',
            isToday ? 'bg-accent-solid text-on-accent' : cx('data-hovered:bg-well', inMonth && !past ? 'text-ink' : 'text-ink-3')
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
                'pointer-events-auto flex min-w-0 items-center gap-1 rounded-[0.375rem] border px-1.5 py-[0.1875rem] text-left text-[0.75rem] leading-tight outline-none',
                'data-hovered:shadow-piece data-focus-visible:ring-2 data-focus-visible:ring-focus',
                lessonTone(lesson.event_type, past)
              )}
            >
              <span className="font-semibold tabular">{time}</span>
              <LessonShape type={lesson.event_type} className="size-2" />
              <span className="min-w-0 truncate">{title(lesson)}</span>
              {unmarked > 0 && <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-action" />}
            </AriaButton>
          )
        })}
        {more > 0 && (
          <AriaButton
            onPress={() => onOpenDay(day)}
            className="pointer-events-auto self-start rounded-[0.375rem] px-1.5 py-0.5 text-[0.75rem] font-medium text-ink-2 outline-none data-hovered:bg-well data-hovered:text-ink data-focus-visible:ring-2 data-focus-visible:ring-focus"
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
    <div className="flex flex-col gap-8">
      <div className="rounded-panel border border-line bg-surface p-1.5 shadow-piece">
        <div aria-hidden className="grid grid-cols-7 pt-1 pb-1.5 text-center text-[0.6875rem] font-medium text-ink-3">
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
                  className="flex min-h-14 flex-col items-center gap-1 rounded-[0.75rem] py-1.5 outline-none data-focus-visible:ring-2 data-focus-visible:ring-focus data-pressed:bg-well"
                >
                  <span
                    className={cx(
                      'grid size-8 place-items-center rounded-full text-[0.9375rem] font-semibold tabular',
                      isToday ? 'bg-accent-solid text-on-accent' : inMonth && day >= todayStart ? 'text-ink' : 'text-ink-3'
                    )}
                  >
                    {date(day, { day: 'numeric' })}
                  </span>
                  <span aria-hidden className="flex h-1.5 items-center gap-[0.1875rem]">
                    {list.slice(0, 4).map((lesson) => (
                      <span key={lesson.id} className={cx('size-1.5 rounded-full', inMonth ? (DOT_TONE[lesson.event_type] ?? 'bg-ink-3') : 'bg-line-strong')} />
                    ))}
                  </span>
                </AriaButton>
              )
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="month-themes">
        <h2 id="month-themes" className="mb-2 text-[1rem] font-semibold">
          {t.calendar.theme.label}
        </h2>
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface shadow-piece">
          {weeks.map((monday) => (
            <li key={dayKey(monday)} className="relative flex items-start gap-3 px-3 py-2">
              <span className="w-[7.5rem] shrink-0 pt-1.5 text-[0.8125rem] text-ink-2 tabular">
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
      </section>
    </div>
  )
}
