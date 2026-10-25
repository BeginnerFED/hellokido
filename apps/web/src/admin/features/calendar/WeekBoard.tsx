import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { isSameDay, set, startOfDay } from 'date-fns'
import { PlusIcon } from '@phosphor-icons/react'
import { SEATS_SHOWN, type Lesson } from '@hellokido/core/api'
import { useLabels } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useToast } from '../../providers/Toasts'
import { LessonShape, typeClass } from '../../ui/signature'
import { cx } from '../../ui/cx'
import { SeatNames, useLessonTitle } from '../lessons/LessonBits'
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
// The space between two day columns (gap-x-2)
const GAP_PX = 8
// Room in a column above the first hour line and below the last one
const TOP_PX = 8
const BOTTOM_PX = 8
const LESSON_PX = LESSON_MINUTES * PER_MINUTE
const COLUMNS = `${AXIS_PX}px repeat(7, minmax(0, 1fr))`

type Drag = { lesson: Lesson; pointerId: number; x: number; y: number; grab: number; day: number; minutes: number; moved: boolean }
type Slot = { day: number; minutes: number }

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const atMinutes = (day: Date, minutes: number) => set(day, { hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0, milliseconds: 0 })
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** True while any sheet is open (the Sheet marks the page), so the slot a new lesson came from can stay marked. */
function useSheetOpen() {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-sheet'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.dataset.sheet === 'open',
    () => false
  )
}

/**
 * The week as seven felt columns under an hour rail. A lesson is a block of its type's felt, as long
 * as it runs; hovering shows who is in it. Time that is over is hatched, and a pink line marks the
 * time now. Lessons still to come can be dragged to another day or time; an empty spot adds a lesson
 * there and stays marked while the new lesson's sheet is open. Lessons that already happened, or
 * have attendance, stay where they are.
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
  const [hover, setHover] = useState<Slot | null>(null)
  const [pending, setPending] = useState<Slot | null>(null)
  const sheetOpen = useSheetOpen()
  const sheetSeen = useRef(false)

  // The slot a new lesson was opened from stays marked until its sheet closes
  useEffect(() => {
    if (!pending) return
    if (sheetOpen) sheetSeen.current = true
    else if (sheetSeen.current) {
      sheetSeen.current = false
      setPending(null)
    }
  }, [pending, sheetOpen])

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
  const todayIndex = days.findIndex((day) => isSameDay(day, now))
  const nowShown = todayIndex >= 0 && nowMinutes >= first && nowMinutes <= last

  // The quarter hour under the pointer; `grab` is how far below the lesson's start it was picked up
  const minutesAt = (clientY: number, grab: number, snap: 'round' | 'floor') => {
    const raw = (clientY - gridRef.current!.getBoundingClientRect().top - TOP_PX) / PER_MINUTE + first - grab
    return clamp(Math[snap](raw / SNAP_MINUTES) * SNAP_MINUTES, first, last - SNAP_MINUTES)
  }
  const dayAt = (clientX: number) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const stride = (rect.width - AXIS_PX - 7 * GAP_PX) / 7 + GAP_PX
    return clamp(Math.floor((clientX - rect.left - AXIS_PX - GAP_PX / 2) / stride), 0, 6)
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

  const createAt = (event: MouseEvent<HTMLElement>, dayIndex: number) => {
    const minutes = minutesAt(event.clientY, 0, 'floor')
    sheetSeen.current = false
    setPending({ day: dayIndex, minutes })
    setHover(null)
    onCreate(atMinutes(days[dayIndex], minutes))
  }

  const dragProblem = drag?.moved ? dropProblem(drag.lesson, drag.day, drag.minutes) : null

  return (
    <div>
      {/* Day heads stay in view under the top bar while the hours scroll */}
      <div className="sticky top-[4.25rem] z-30 grid gap-x-2 bg-page pb-2" style={{ gridTemplateColumns: COLUMNS }}>
        <span aria-hidden />
        {days.map((day) => {
          const isToday = isSameDay(day, now)
          const count = grouped.get(dayKey(day))?.length ?? 0
          const quiet = count === 0 && lessons.length > 0
          return (
            <AriaButton
              key={day.toISOString()}
              onPress={() => onOpenDay(day)}
              aria-label={`${date(day, { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${plural(t.calendar.lessonCount, count)}` : ''}`}
              className="flex flex-col items-center rounded-tile pt-1 pb-1.5 outline-none transition-colors duration-150 data-hovered:bg-felt data-focus-visible:ring-2 data-focus-visible:ring-focus"
            >
              <span className={cx('text-[0.8125rem] leading-[1.125rem]', isToday ? 'font-medium text-accent-ink' : 'text-ink-3')}>
                {date(day, { weekday: 'short' })}
              </span>
              <span
                className={cx(
                  'grid h-9 min-w-9 place-items-center rounded-full px-1 text-[1.25rem] leading-[1.625rem]',
                  isToday
                    ? 'font-semibold text-accent-ink shadow-[inset_0_0_0_2px_var(--fill)]'
                    : quiet || day < todayStart
                      ? cx('text-ink-3', quiet ? 'font-normal' : 'font-semibold')
                      : 'font-semibold text-ink'
                )}
              >
                {date(day, { day: 'numeric' })}
              </span>
            </AriaButton>
          )
        })}
      </div>

      <div ref={gridRef} className="relative grid gap-x-2" style={{ gridTemplateColumns: COLUMNS, height }}>
        <div aria-hidden className="relative">
          {hours.map((minutes) => {
            // The time chip on the now line takes the place of the hour it would touch
            if (nowShown && Math.abs(minutes - nowMinutes) < 14) return null
            return (
              <span key={minutes} className="absolute right-2 -translate-y-1/2 text-[0.75rem] text-ink-3" style={{ top: topOf(minutes) }}>
                {clock(minutes)}
              </span>
            )
          })}
          {nowShown && (
            <span
              className="absolute right-1 z-10 -translate-y-1/2 rounded-lg bg-now-chip px-1.5 py-px text-[0.71875rem] font-semibold whitespace-nowrap text-on-now-chip"
              style={{ top: topOf(nowMinutes) }}
            >
              {clock(nowMinutes)}
            </span>
          )}
        </div>

        {days.map((day, dayIndex) => {
          const list = grouped.get(dayKey(day)) ?? []
          const layout = layoutDay(list)
          const isToday = dayIndex === todayIndex
          // A day that is over, or a day without lessons in a week that has some, is hatched
          const hatched = day < todayStart || (list.length === 0 && lessons.length > 0)
          const pastPx = isToday ? clamp(topOf(nowMinutes), 0, height) : 0
          return (
            <div key={day.toISOString()} className={cx('relative rounded-[1.125rem] bg-felt', hatched && 'hatch')}>
              {/* Today: the part of the day that is over is hatched */}
              {pastPx > 0 && (
                <div aria-hidden className={cx('hatch pointer-events-none absolute inset-x-0 top-0 rounded-t-[1.125rem]', pastPx >= height && 'rounded-b-[1.125rem]')} style={{ height: pastPx }} />
              )}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {hours.slice(1, -1).map((minutes) => (
                  <div key={minutes} className="absolute inset-x-0 border-t border-line/70" style={{ top: topOf(minutes) }} />
                ))}
              </div>

              {/* The empty board: a click adds a lesson at that quarter hour */}
              <div
                aria-hidden
                className="absolute inset-0 cursor-cell rounded-[1.125rem]"
                onPointerMove={(event) => trackHover(event, dayIndex)}
                onPointerLeave={() => setHover(null)}
                onClick={(event) => createAt(event, dayIndex)}
              />
              {hover?.day === dayIndex && !drag && !(pending && sheetOpen) && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 flex items-start gap-1 rounded-tablet border-[1.5px] border-dashed border-sky px-2 py-1.5 text-[0.75rem] font-medium text-sky-ink"
                  style={{ top: topOf(hover.minutes), height: LESSON_PX }}
                >
                  <PlusIcon weight="bold" className="mt-0.5 size-3" />
                  <span>{clock(hover.minutes)}</span>
                </div>
              )}
              {pending?.day === dayIndex && sheetOpen && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 z-20 flex flex-col rounded-tablet bg-page/70 px-2.5 py-2 text-sky-ink shadow-[inset_0_0_0_2px_var(--sky)]"
                  style={{ top: topOf(pending.minutes), height: LESSON_PX }}
                >
                  <span className="flex items-center gap-1.5 text-[0.8125rem] leading-[1.0625rem] font-semibold">
                    <PlusIcon weight="bold" className="size-3" />
                    {t.calendar.newLesson}
                  </span>
                  <span className="mt-0.5 text-[0.75rem] leading-4">{clock(pending.minutes)}</span>
                </div>
              )}

              {/* The now line runs behind the lessons; the running one carries a ring of its own */}
              {nowShown && isToday && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: topOf(nowMinutes) - 4 }}>
                  <span className="-ml-1 size-2 rounded-full bg-pink" />
                  <span className="h-0.5 flex-1 bg-pink" />
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
                const age = labels.ageGroup(lesson.age_group)
                const elapsed = (now.getTime() - at.getTime()) / 60_000
                const running = elapsed >= 0 && elapsed < LESSON_MINUTES
                const style = {
                  top: topOf(minutesOfDay(at)) + 2,
                  left: `calc(${(place.column / place.columns) * 100}% + 4px)`,
                  width: `calc(${100 / place.columns}% - 8px)`,
                  '--h': `${LESSON_PX - 4}px`,
                  // The running lesson's elapsed part sits a shade deeper
                  backgroundImage: running
                    ? `linear-gradient(180deg, color-mix(in srgb, var(--t-mid) 16%, var(--t-felt)) 0 ${elapsed * PER_MINUTE}px, transparent ${elapsed * PER_MINUTE}px)`
                    : undefined
                } as CSSProperties
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    aria-label={[`${time} ${name}`, age, fmt(t.today.seats, { count: taken, capacity: SEATS_SHOWN }), running ? t.calendar.now : '', unmarked ? plural(t.calendar.unmarked, unmarked) : '']
                      .filter(Boolean)
                      .join(', ')}
                    title={locked && !past ? t.calendar.locked : undefined}
                    onPointerDown={(event) => pointerDown(event, lesson, dayIndex)}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={() => setDrag(null)}
                    onClick={() => !clickAfterDrag.current && onOpen(lesson)}
                    className={cx(
                      typeClass(lesson.event_type),
                      'group absolute z-[1] flex h-(--h) flex-col overflow-hidden rounded-tablet bg-(--t-felt) px-2.5 py-2 text-left text-(--t-ink) outline-none select-none',
                      'transition-[box-shadow,opacity] duration-150 focus-visible:z-20 focus-visible:h-auto focus-visible:min-h-(--h) focus-visible:ring-2 focus-visible:ring-focus',
                      running && 'ring-2 ring-(--t-mid) ring-inset',
                      !drag && 'hover:z-20 hover:h-auto hover:min-h-(--h) hover:shadow-lift',
                      locked ? 'cursor-pointer' : 'cursor-grab',
                      isDragged && 'opacity-40'
                    )}
                    style={style}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] leading-[1.0625rem] font-semibold">
                      <LessonShape type={lesson.event_type} />
                      <span className={cx('min-w-0 truncate', !drag && 'group-hover:whitespace-normal', 'group-focus-visible:whitespace-normal')}>{name}</span>
                      {unmarked > 0 && <span aria-hidden className="ml-auto size-2 shrink-0 rounded-full bg-amber" />}
                    </span>
                    <span className="mt-0.5 truncate text-[0.75rem] leading-4">
                      {time}, {age}
                    </span>
                    <span className="truncate text-[0.75rem] leading-4">{fmt(t.today.lessonsCard.seatsShort, { count: taken, capacity: SEATS_SHOWN })}</span>
                    {lesson.seats.length > 0 && (
                      <span className={cx('hidden pt-1.5', !drag && 'group-hover:block', 'group-focus-visible:block')}>
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
                    'pointer-events-none absolute inset-x-1 z-30 flex flex-col gap-0.5 rounded-tablet px-2.5 py-2 shadow-lift',
                    dragProblem ? 'bg-negative-wash text-negative-ink ring-2 ring-negative ring-inset' : cx(typeClass(drag.lesson.event_type), 'bg-(--t-felt) text-(--t-ink) ring-2 ring-(--t-mid) ring-inset')
                  )}
                  style={{ top: topOf(drag.minutes) + 2, height: LESSON_PX - 4 }}
                >
                  <span className="text-[0.8125rem] font-semibold">{clock(drag.minutes)}</span>
                  <span className="truncate text-[0.75rem]">{title(drag.lesson)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
