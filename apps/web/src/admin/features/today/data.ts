import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, addMinutes } from 'date-fns'
import { lessonsBetween, unmarkedSeats, type Lesson, type Seat } from '@hellokido/core/api'
import { keys, useActiveUsage, usePendingIncome, useRegistrations } from '../../data/queries'
import { isPaymentDue, needsRenewal } from '../children/rules'
import { LESSON_MINUTES } from '../calendar/model'
import { useClock } from './clock'

// Today's page, its sidebar count and the cards it points to count from the same queries

export const lessonEnd = (lesson: Lesson) => addMinutes(new Date(lesson.event_date), LESSON_MINUTES)

/** Today's and tomorrow's lessons, read together (the key is the one attendance answers patch). */
export function useDayLessons(dayKey: string) {
  const todayStart = useMemo(() => new Date(`${dayKey}T00:00:00`), [dayKey])
  const tomorrowStart = useMemo(() => addDays(todayStart, 1), [todayStart])
  const rangeEnd = useMemo(() => addDays(todayStart, 2), [todayStart])
  const key = keys.lessons(todayStart.toISOString(), rangeEnd.toISOString())
  const query = useQuery({ queryKey: key, queryFn: () => lessonsBetween(todayStart, rangeEnd) })
  const todays = useMemo(() => (query.data ?? []).filter((lesson) => new Date(lesson.event_date) < tomorrowStart), [query.data, tomorrowStart])
  const tomorrows = useMemo(() => (query.data ?? []).filter((lesson) => new Date(lesson.event_date) >= tomorrowStart), [query.data, tomorrowStart])
  return { key, query, todays, tomorrows }
}

export type HeroPhase = 'running' | 'next' | 'done'

/**
 * The lesson of the moment: the running one, else the next one. Once the day is over, the last
 * lesson whose attendance is still missing, else the last one with children, else the last one.
 * (The same choice as the iPhone app.)
 */
export function pickHero(todays: Lesson[], now: Date): { hero: Lesson | undefined; phase: HeroPhase } {
  const running = todays.find((lesson) => now >= new Date(lesson.event_date) && now < lessonEnd(lesson))
  const upcoming = todays.find((lesson) => new Date(lesson.event_date) > now)
  const lastOf = (test: (lesson: Lesson) => boolean) => [...todays].reverse().find(test)
  const hero =
    running ??
    upcoming ??
    lastOf((lesson) => lesson.seats.some((seat) => seat.status === 'scheduled')) ??
    lastOf((lesson) => lesson.seats.length > 0) ??
    todays[todays.length - 1]
  return { hero, phase: running ? 'running' : upcoming ? 'next' : 'done' }
}

/** Attendance nobody marked in the last 30 days (days before today). */
export function useUnmarked(dayKey: string) {
  const key = [...keys.unmarked, dayKey]
  return { key, query: useQuery({ queryKey: key, queryFn: () => unmarkedSeats() }) }
}

/** Unpaid packages and expected fees of active children; free participation never waits for money. */
export function usePaymentsDue() {
  const registrations = useRegistrations()
  const pending = usePendingIncome()
  const byId = useMemo(() => new Map((registrations.data ?? []).map((row) => [row.id, row])), [registrations.data])
  const packages = useMemo(
    () =>
      (registrations.data ?? [])
        .filter(isPaymentDue)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [registrations.data]
  )
  const fees = useMemo(
    () => (pending.data ?? []).filter((line) => line.source === 'child' && line.registrationId && byId.get(line.registrationId)?.is_active === true),
    [pending.data, byId]
  )
  const families = useMemo(() => new Set([...packages.map((row) => row.id), ...fees.map((line) => line.registrationId)]).size, [packages, fees])
  return { registrations, pending, byId, packages, fees, families, total: packages.length + fees.length }
}

/** Packages down to their last two lessons or out of them, with the lessons left (never below 0). */
export function useEndingPackages() {
  const registrations = useRegistrations()
  const usageQuery = useActiveUsage()
  const usage = usageQuery.data
  const rows = useMemo(
    () =>
      (registrations.data ?? [])
        .filter((row) => needsRenewal(row, usage?.[row.id]))
        .map((child) => ({ child, remaining: Math.max(usage?.[child.id]?.remaining ?? 0, 0) })),
    [registrations.data, usage]
  )
  // Without the lessons left no package can be told apart; a failed count shows none rather than wait forever
  return { registrations, rows, ready: usage !== undefined || usageQuery.isError }
}

export type EarlierLesson = { lesson: Lesson; seats: Seat[] }

/**
 * What waits for the admin. The jobs are the attendance missing from past days and from today's
 * lessons that have ended (other than the one on the hero card). Payments due and packages to renew
 * come along for a card of their own; they are not jobs and never add to the count.
 */
export function useWaiting() {
  const { now, dayKey } = useClock()
  const day = useDayLessons(dayKey)
  const unmarked = useUnmarked(dayKey)
  const payments = usePaymentsDue()
  const ending = useEndingPackages()
  const { hero, phase } = pickHero(day.todays, now)
  const earlier = useMemo<EarlierLesson[]>(
    () =>
      day.todays
        .filter((lesson) => lesson.id !== hero?.id && lessonEnd(lesson) <= now)
        .map((lesson) => ({ lesson, seats: lesson.seats.filter((seat) => seat.status === 'scheduled') }))
        .filter((item) => item.seats.length > 0),
    [day.todays, hero?.id, now]
  )
  const attendance = (unmarked.query.data?.length ?? 0) + earlier.reduce((sum, item) => sum + item.seats.length, 0)
  return {
    now,
    dayKey,
    day,
    hero,
    phase,
    earlier,
    unmarked,
    payments,
    ending,
    counts: { attendance, pay: payments.total, renew: ending.rows.length },
    total: attendance,
    ready: Boolean(unmarked.query.data && day.query.data),
    packagesReady: Boolean(payments.registrations.data && ending.ready)
  }
}
