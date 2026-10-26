import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { unmarkedSeats } from '@hellokido/core/api'
import { isPaymentDue, needsRenewal } from '@hellokido/core/view'
import { keys, useActiveUsage, usePendingIncome, useRegistrations } from '../../data/queries'

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
