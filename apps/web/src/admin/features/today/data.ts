import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, addMinutes } from 'date-fns'
import { lessonsBetween, unmarkedSeats, type Lesson, type Seat } from '@hellokido/core/api'
import { keys, usePendingIncome, useRegistrations } from '../../data/queries'
import { daysLeft, isEnding, isPaymentDue } from '../children/rules'
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

/** Packages that ended or end within a week, with the days left (negative once ended). */
export function useEndingPackages(now: Date) {
  const registrations = useRegistrations()
  const rows = useMemo(
    () => (registrations.data ?? []).filter((row) => isEnding(row, now)).map((child) => ({ child, days: daysLeft(child, now) ?? 0 })),
    [registrations.data, now]
  )
  return { registrations, rows }
}

export type EarlierLesson = { lesson: Lesson; seats: Seat[] }

/**
 * Everything that waits for the admin: attendance missing from past days and from today's lessons
 * that have ended (other than the one on the hero card), payments due and packages to renew.
 */
export function useWaiting() {
  const { now, dayKey } = useClock()
  const day = useDayLessons(dayKey)
  const unmarked = useUnmarked(dayKey)
  const payments = usePaymentsDue()
  const ending = useEndingPackages(now)
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
  const ready = Boolean(unmarked.query.data && payments.registrations.data && day.query.data)
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
    total: attendance + payments.total + ending.rows.length,
    ready
  }
}
