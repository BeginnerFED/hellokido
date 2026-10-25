import type { Registration } from './registrations'
import {
  computeExtensionPreview,
  fetchCarryOverSource,
  fetchLessonUsageMap,
  startsNewPeriod as startsNewPeriodRule
} from '../rules/lessonUsage.js'

/** Lesson numbers of a child's current package (see computeLessonUsage). Free packages have no quota: null. */
export type Usage = {
  isFree: boolean
  total: number | null
  packageTotal: number | null
  earlierPaymentLessons: number
  carried: number
  extra: number
  used: number
  remaining: number | null
  attended: number
  noShow: number
  makeup: number
  scheduled: number
  postponed: number
  unmarkedPast: number
}

export type UsageMap = Record<string, Usage>

type UsageInput = Pick<Registration, 'id' | 'package_type' | 'package_start_date'> & Partial<Pick<Registration, 'package_end_date' | 'extra_lessons'>>

/** Usage for many children with a handful of batched reads. Every child passed in gets an entry. */
export async function usageFor(registrations: UsageInput[]): Promise<UsageMap> {
  if (registrations.length === 0) return {}
  return (await fetchLessonUsageMap(registrations)) as UsageMap
}

export type CarrySource = {
  registration: Pick<Registration, 'id' | 'package_type' | 'package_start_date' | 'package_end_date' | 'extra_lessons'>
  rows: unknown[]
  extensions: unknown[]
  carried: number
}

/** The current period read fresh, with what it carries, for the extension preview. */
export async function carrySource(registrationId: string): Promise<CarrySource> {
  return (await fetchCarryOverSource(registrationId)) as CarrySource
}

export type ExtensionPreview = Usage & { samePackage: boolean }

/** How the child's package will look after the extension; the same code path as the numbers on screen. */
export function previewExtension(source: CarrySource | null, packageType: string | null, startDate: Date | null, extraLessons: number) {
  return computeExtensionPreview(source, packageType, startDate, extraLessons) as ExtensionPreview | null
}

/** Does this start date open a new period (a later day in Istanbul) or pay for the current one? */
export function startsNewPeriod(currentStart: string | Date | null | undefined, newStart: Date | null) {
  return startsNewPeriodRule(currentStart, newStart) as boolean
}

/** A remaining count's tone: none left, nearly out, or fine. */
export function remainingTone(usage: Usage | undefined): 'free' | 'out' | 'low' | 'ok' | null {
  if (!usage) return null
  if (usage.isFree) return 'free'
  const remaining = usage.remaining ?? 0
  if (remaining <= 0) return 'out'
  if (remaining <= 2) return 'low'
  return 'ok'
}
