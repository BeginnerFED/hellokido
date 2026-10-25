import { useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { isSameDay, set, startOfDay } from 'date-fns'
import { PlusIcon } from '@phosphor-icons/react'
import { SEATS_SHOWN, type Lesson } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { AgeTablet, LessonShape } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { lessonTone, lessonWash, MiniSockets, SeatNames, useLessonTitle } from '../lessons/LessonBits'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  LESSON_MINUTES,
  SNAP_MINUTES,
  byDay,
  dayKey,
  daysOf,
  isLocked,
  layoutDay,
  minutesOfDay,
  seatsTaken,
  unmarkedIn
} from './model'

const HOUR_PX = 72
const PER_MINUTE = HOUR_PX / 60
const AXIS_PX = 56
// Room around the first and last hour lines, so their labels are not cut off
const TOP_PX = 10
const BOTTOM_PX = 12
const LESSON_PX = LESSON_MINUTES * PER_MINUTE

type Drag = { lesson: Lesson; pointerId: number; x: number; y: number; grab: number; day: number; minutes: number; moved: boolean }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const atMinutes = (day: Date, minutes: number) => set(day, { hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0, milliseconds: 0 })
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * The week as a board of seven days. A lesson is drawn as long as it runs; hovering shows who is
 * in it. Lessons still to come can be dragged to another day or time; an empty spot adds a lesson
 * there. Lessons that already happened, or have attendance, stay where they are.
 */
export function WeekBoard({
  start,
  lessons,
  now,
  onOpen,
  onCreate,
  onMove,
  onOpenDay
}: {
  start: Date
  lessons: Lesson[]
  now: Date
  onOpen: (lesson: Lesson) => void
  onCreate: (start: Date) => void
  onMove: (lesson: Lesson, start: Date) => void
  onOpenDay: (day: Date) => void
}) {
  const { t, fmt, plural, date } = useI18n()
  const toast = useToast()
  const labels = useLabels()
  const title = useLessonTitle()
  const days = useMemo(() => daysOf(start), [start])
  const grouped = useMemo(() => byDay(lessons), [lessons])
  const gridRef = useRef<HTMLDivElement>(null)
  const clickAfterDrag = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<{ day: number; minutes: number } | null>(null)

  // 09:00–19:00, widened when a lesson starts earlier or runs later
  const { first, last } = useMemo(() => {
    let firstHour = DAY_START_HOUR
    let lastHour = DAY_END_HOUR
    for (const lesson of lessons) {
      const at = minutesOfDay(new Date(lesson.event_date))
      firstHour = Math.min(firstHour, Math.floor(at / 60))
      lastHour = Math.max(lastHour, Math.ceil((at + LESSON_MINUTES) / 60))
    }
    return { first: firstHour * 60, last: Math.min(lastHour, 24) * 60 }
  }, [lessons])
  const height = (last - first) * PER_MINUTE + TOP_PX + BOTTOM_PX
  const topOf = (minutes: number) => TOP_PX + (minutes - first) * PER_MINUTE
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, index) => first + index * 60)
  const todayStart = startOfDay(now)
  const nowMinutes = minutesOfDay(now)

  // The quarter hour under the pointer; `grab` is how far below the lesson's start it was picked up
  const minutesAt = (clientY: number, grab: number, snap: 'round' | 'floor') => {
    const raw = (clientY - gridRef.current!.getBoundingClientRect().top - TOP_PX) / PER_MINUTE + first - grab
    return clamp(Math[snap](raw / SNAP_MINUTES) * SNAP_MINUTES, first, last - SNAP_MINUTES)
  }
  const dayAt = (clientX: number) => {
    const rect = gridRef.current!.getBoundingClientRect()
    return clamp(Math.floor((clientX - rect.left - AXIS_PX) / ((rect.width - AXIS_PX) / 7)), 0, 6)
  }

  // Two lessons never start in the same minute; the drop is refused before asking the server
  const dropProblem = (lesson: Lesson, day: number, minutes: number) => {
    const taken = (grouped.get(dayKey(days[day])) ?? []).some(
      (other) => other.id !== lesson.id && minutesOfDay(new Date(other.event_date)) === minutes
    )
    return taken ? t.calendar.minuteTaken : null
  }

  // Dragging near the top or bottom of the window scrolls the page along
  const followEdge = (clientY: number) => {
    if (clientY < 72) window.scrollBy({ top: -14 })
    else if (clientY > window.innerHeight - 72) window.scrollBy({ top: 14 })
  }

  const pointerDown = (event: PointerEvent<HTMLElement>, lesson: Lesson, day: number) => {
    if (event.button !== 0 || event.pointerType !== 'mouse' || isLocked(lesson, now)) return
    const begins = minutesOfDay(new Date(lesson.event_date))
    const pointer = (event.clientY - gridRef.current!.getBoundingClientRect().top - TOP_PX) / PER_MINUTE + first
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ lesson, pointerId: event.pointerId, x: event.clientX, y: event.clientY, grab: pointer - begins, day, minutes: begins, moved: false })
  }

  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return
    const day = dayAt(event.clientX)
    const minutes = minutesAt(event.clientY, drag.grab, 'round')
    if (!drag.moved || day !== drag.day || minutes !== drag.minutes) setDrag({ ...drag, day, minutes, moved: true })
    followEdge(event.clientY)
  }

  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    const done = drag
    setDrag(null)
    if (!done.moved) return
    // The click that ends a drag must not open the lesson
    clickAfterDrag.current = true
    window.setTimeout(() => (clickAfterDrag.current = false), 0)
    const from = new Date(done.lesson.event_date)
    if (isSameDay(days[done.day], from) && done.minutes === minutesOfDay(from)) return
    const problem = dropProblem(done.lesson, done.day, done.minutes)
    if (problem) return toast({ tone: 'error', title: problem })
    onMove(done.lesson, atMinutes(days[done.day], done.minutes))
  }

  const trackHover = (event: PointerEvent<HTMLElement>, day: number) => {
    if (event.pointerType !== 'mouse' || drag) return
    const minutes = minutesAt(event.clientY, 0, 'floor')
    if (hover?.day !== day || hover.minutes !== minutes) setHover({ day, minutes })
  }

  const createAt = (event: MouseEvent<HTMLElement>, day: Date) => onCreate(atMinutes(day, minutesAt(event.clientY, 0, 'floor')))

  const dragProblem = drag?.moved ? dropProblem(drag.lesson, drag.day, drag.minutes) : null

  return (
    <div className="rounded-panel border border-line bg-surface shadow-piece">
      <div
        className="sticky top-0 z-30 grid rounded-t-panel border-b border-line bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] backdrop-blur-xl"
        style={{ gridTemplateColumns: `${AXIS_PX}px repeat(7, minmax(0, 1fr))` }}
      >
        <span aria-hidden />
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          const count = grouped.get(dayKey(day))?.length ?? 0
          return (
            <AriaButton
              key={day.toISOString()}
              onPress={() => onOpenDay(day)}
              aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${plural(t.calendar.lessonCount, count)}` : ''}`}
              className="flex flex-col items-center gap-0.5 border-l border-line py-2 outline-none data-hovered:bg-well data-focus-visible:ring-2 data-focus-visible:ring-focus data-focus-visible:ring-inset"
            >
              <span className={cx('text-[0.75rem] font-medium', isToday ? 'text-accent-ink' : 'text-ink-3')}>{date(day, { weekday: 'short' })}</span>
              <span
                className={cx(
                  'grid size-8 place-items-center rounded-full text-[1.0625rem] font-semibold tabular',
                  isToday ? 'bg-accent-solid text-on-accent' : day < todayStart ? 'text-ink-3' : 'text-ink'
                )}
              >
                {date(day, { day: 'numeric' })}
              </span>
            </AriaButton>
          )
        })}
      </div>

      <div ref={gridRef} className="relative grid" style={{ gridTemplateColumns: `${AXIS_PX}px repeat(7, minmax(0, 1fr))`, height }}>
        {/* Hour lines across the whole board, half hours fainter */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: AXIS_PX }}>
          {hours.map((minutes) => (
            <div key={minutes} className="absolute inset-x-0 border-t border-line" style={{ top: topOf(minutes) }} />
          ))}
          {hours.slice(0, -1).map((minutes) => (
            <div key={`half-${minutes}`} className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: topOf(minutes + 30) }} />
          ))}
        </div>

        <div aria-hidden className="relative">
          {hours.map((minutes) => (
            <span key={minutes} className="absolute right-2 -translate-y-1/2 text-[0.75rem] text-ink-3 tabular" style={{ top: topOf(minutes) }}>
              {clock(minutes)}
            </span>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const list = grouped.get(dayKey(day)) ?? []
          const layout = layoutDay(list)
          const isToday = isSameDay(day, now)
          return (
            <div
              key={day.toISOString()}
              className={cx(
                'relative border-l border-line',
                isToday && 'bg-[color-mix(in_oklab,var(--accent-wash)_55%,transparent)]',
                dayIndex === 6 && 'rounded-br-[calc(var(--radius-panel)-1px)]'
              )}
            >
              {/* The empty board: a click adds a lesson at that quarter hour */}
              <div
                aria-hidden
                className="absolute inset-0 cursor-cell"
                onPointerMove={(event) => trackHover(event, dayIndex)}
                onPointerLeave={() => setHover(null)}
                onClick={(event) => createAt(event, day)}
              />
              {hover?.day === dayIndex && !drag && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[3px] flex items-start gap-1 rounded-[0.625rem] border border-dashed border-accent px-2 py-1.5 text-[0.75rem] font-medium text-accent-ink"
                  style={{ top: topOf(hover.minutes), height: LESSON_PX }}
                >
                  <PlusIcon weight="bold" className="mt-0.5 size-3" />
                  <span className="tabular">{clock(hover.minutes)}</span>
                </div>
              )}

              {isToday && nowMinutes >= first && nowMinutes <= last && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: topOf(nowMinutes) - 4 }}>
                  <span className="-ml-1 size-2 rounded-full bg-accent-solid" />
                  <span className="h-[2px] flex-1 bg-accent-solid" />
                </div>
              )}

              {list.map((lesson) => {
                const at = new Date(lesson.event_date)
                const place = layout.get(lesson.id) ?? { column: 0, columns: 1 }
                const locked = isLocked(lesson, now)
                const past = at < todayStart
                const isDragged = drag?.lesson.id === lesson.id && drag.moved
                const unmarked = unmarkedIn(lesson, now)
                const taken = seatsTaken(lesson)
                const name = title(lesson)
                const time = date(at, { hour: '2-digit', minute: '2-digit' })
                const style = {
                  top: topOf(minutesOfDay(at)),
                  left: `calc(${(place.column / place.columns) * 100}% + 3px)`,
                  width: `calc(${100 / place.columns}% - 6px)`,
                  '--h': `${LESSON_PX}px`
                } as CSSProperties
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    aria-label={[time, name, labels.ageGroup(lesson.age_group), fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN }), unmarked ? plural(t.calendar.unmarked, unmarked) : '']
                      .filter(Boolean)
                      .join(', ')}
                    title={locked && !past ? t.calendar.locked : undefined}
                    onPointerDown={(event) => pointerDown(event, lesson, dayIndex)}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={() => setDrag(null)}
                    onClick={() => !clickAfterDrag.current && onOpen(lesson)}
                    className={cx(
                      'group absolute z-[1] flex h-(--h) flex-col gap-1 overflow-hidden rounded-[0.625rem] border px-2 py-1.5 text-left text-ink outline-none select-none',
                      'transition-[box-shadow,opacity] duration-150 focus-visible:z-20 focus-visible:h-auto focus-visible:min-h-(--h) focus-visible:ring-2 focus-visible:ring-focus',
                      !drag && 'hover:z-20 hover:h-auto hover:min-h-(--h) hover:shadow-lift',
                      lessonTone(lesson.event_type, past),
                      locked ? 'cursor-pointer' : 'cursor-grab',
                      isDragged && 'opacity-40'
                    )}
                    style={style}
                  >
                    <span className="flex min-w-0 items-center gap-1 text-[0.8125rem] leading-tight">
                      <span className="font-semibold tabular">{time}</span>
                      <LessonShape type={lesson.event_type} className="size-2.5 shrink-0" />
                      <span className={cx('min-w-0 truncate font-medium', !drag && 'group-hover:whitespace-normal', 'group-focus-visible:whitespace-normal')}>{name}</span>
                      {unmarked > 0 && <span aria-hidden className="ml-auto size-2 shrink-0 rounded-full bg-action ring-2 ring-surface" />}
                    </span>
                    <AgeTablet group={lesson.age_group} label={labels.ageGroup(lesson.age_group)} className="text-[0.75rem] leading-tight text-ink-2" />
                    <span className={cx('mt-auto flex items-center gap-1.5 group-focus-visible:mt-0', !drag && 'group-hover:mt-0')}>
                      <MiniSockets seats={lesson.seats} />
                      <span className="text-[0.75rem] text-ink-3 tabular">
                        {taken}/{SEATS_SHOWN}
                      </span>
                    </span>
                    {lesson.seats.length > 0 && (
                      <span className={cx('hidden pt-0.5', !drag && 'group-hover:block', 'group-focus-visible:block')}>
                        <SeatNames seats={lesson.seats} className="text-[0.75rem]" />
                      </span>
                    )}
                  </button>
                )
              })}

              {drag?.moved && drag.day === dayIndex && (
                <div
                  aria-hidden
                  className={cx(
                    'pointer-events-none absolute inset-x-[3px] z-30 flex flex-col gap-0.5 rounded-[0.625rem] border-2 px-2 py-1.5 shadow-lift',
                    dragProblem ? 'border-negative bg-negative-wash' : cx('border-accent', lessonWash(drag.lesson.event_type))
                  )}
                  style={{ top: topOf(drag.minutes), height: LESSON_PX }}
                >
                  <span className={cx('text-[0.8125rem] font-semibold tabular', dragProblem ? 'text-negative-ink' : 'text-accent-ink')}>{clock(drag.minutes)}</span>
                  <span className="truncate text-[0.75rem] text-ink-2">{title(drag.lesson)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
