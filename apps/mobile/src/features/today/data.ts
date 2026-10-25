import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { unmarkedSeats } from '@hellokido/core/api'
import { daysLeft, isEnding, isPaymentDue } from '@hellokido/core/view'
import { keys, usePendingIncome, useRegistrations } from '../../data/queries'

// The strip at the top and the sections it points to count from the same queries

/** Attendance nobody marked in the last 30 days. */
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
  return { registrations, byId, packages, fees, total: packages.length + fees.length }
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
