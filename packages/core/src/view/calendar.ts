import { addDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import type { Lesson } from '../api'
import { holdsSeat, isAttendanceOverdue, isRecordedAttendance } from '../rules/attendance.js'

export type CalendarView = 'week' | 'day' | 'month'

/** How long a lesson runs: the board draws it this tall and Today calls it "now" meanwhile. */
export const LESSON_MINUTES = 90
/** The hours the board always shows; a lesson outside them widens the board. */
export const DAY_START_HOUR = 9
export const DAY_END_HOUR = 19
/** Drags and new lessons land on quarter hours. */
export const SNAP_MINUTES = 15
/** Start hours offered for a lesson (the last one ends at 19:00 at the latest start). */
export const LESSON_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
export const LESSON_MINUTE_STEPS = [0, 15, 30, 45]

export const weekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 })

/** Weekly themes are keyed by the local Monday as 'yyyy-MM-dd' (never toISOString: UTC would give Sunday). */
export const weekKey = (date: Date) => format(weekStart(date), 'yyyy-MM-dd')

/** The span a view reads. The day view reads its whole week, since the strip above it shows the week. */
export function rangeOf(view: CalendarView, anchor: Date) {
  if (view === 'month') {
    const start = weekStart(startOfMonth(anchor))
    return { start, end: addDays(weekStart(endOfMonth(anchor)), 7) }
  }
  const start = weekStart(anchor)
  return { start, end: addDays(start, 7) }
}

export const daysOf = (start: Date, count = 7) => Array.from({ length: count }, (_, index) => addDays(start, index))

export const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes()

/**
 * A lesson that already took place, or that has attendance, stays put on the board: dragging it
 * would carry the attendance to another day. Its date can still be changed inside the lesson.
 */
export function isLocked(lesson: Lesson, now: Date) {
  return new Date(lesson.event_date) < startOfDay(now) || lesson.seats.some((seat) => isRecordedAttendance(seat.status))
}

export const seatsTaken = (lesson: Pick<Lesson, 'seats'>) => lesson.seats.filter((seat) => holdsSeat(seat.status)).length

export const unmarkedIn = (lesson: Lesson, now: Date) =>
  lesson.seats.filter((seat) => isAttendanceOverdue(seat.status, lesson.event_date, now)).length

/** Lessons of one day grouped by local date key. */
export function byDay(lessons: Lesson[]) {
  const map = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const key = format(new Date(lesson.event_date), 'yyyy-MM-dd')
    map.set(key, [...(map.get(key) ?? []), lesson])
  }
  return map
}

export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')

/**
 * Lessons of one day that overlap in time sit side by side: each gets a column within its group of
 * overlapping lessons and the number of columns that group needs.
 */
export function layoutDay(lessons: Lesson[]) {
  const items = lessons
    .map((lesson) => {
      const start = minutesOfDay(new Date(lesson.event_date))
      return { id: lesson.id, start, end: start + LESSON_MINUTES }
    })
    .sort((a, b) => a.start - b.start)
  const placed = new Map<string, { column: number; columns: number }>()
  let group: { id: string; column: number }[] = []
  let ends: number[] = []
  let groupEnd = -1
  const close = () => {
    for (const item of group) placed.set(item.id, { column: item.column, columns: ends.length })
    group = []
    ends = []
  }
  for (const item of items) {
    if (group.length > 0 && item.start >= groupEnd) close()
    let column = ends.findIndex((end) => end <= item.start)
    if (column === -1) {
      column = ends.length
      ends.push(item.end)
    } else {
      ends[column] = item.end
    }
    group.push({ id: item.id, column })
    groupEnd = group.length === 1 ? item.end : Math.max(groupEnd, item.end)
  }
  close()
  return placed
}

/** The first copy date offered for one lesson: a week later, and never in the past. */
export function nextCopyDate(lessonStart: Date, now: Date) {
  let next = addDays(startOfDay(lessonStart), 7)
  while (next < startOfDay(now)) next = addDays(next, 7)
  return next
}
