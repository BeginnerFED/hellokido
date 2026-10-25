import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  childIncomeEntries,
  childLessons,
  listRegistrations,
  loadCatalog,
  loadHistory,
  pendingIncome,
  usageFor,
  type Catalog,
  type Registration,
  type UsageMap
} from '@hellokido/core/api'
import { makeLabels, usageFingerprint, type UsageRow } from '@hellokido/core/view'
import { useI18n } from '../providers/I18n'

/**
 * Query keys, the same as the web panel's: every finance read starts with 'finance' and every
 * lesson read with 'lessons', so one invalidation refreshes a whole area after a write.
 */
export const keys = {
  catalog: ['catalog'] as const,
  registrations: ['registrations'] as const,
  usage: (scope: string) => ['usage', scope] as const,
  history: (id: string) => ['history', id] as const,
  childLessons: (id: string) => ['child-lessons', id] as const,
  childEntries: (id: string) => ['child-entries', id] as const,
  lessons: (from: string, to: string) => ['lessons', from, to] as const,
  lesson: (id: string) => ['lesson', id] as const,
  unmarked: ['lessons', 'unmarked'] as const,
  themes: (from: string, to: string) => ['themes', from, to] as const,
  finance: (...parts: (string | number)[]) => ['finance', ...parts] as const,
  waitlist: ['waitlist'] as const,
  notes: ['notes'] as const,
  admins: ['admins'] as const
}

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: loadCatalog, staleTime: 5 * 60_000 })
}

export function useRegistrations(enabled = true) {
  return useQuery({ queryKey: keys.registrations, queryFn: listRegistrations, enabled })
}

/** Lesson numbers of every active child (one batched read; ~50 children). */
export function useActiveUsage() {
  const registrations = useRegistrations().data
  const active = useMemo(() => (registrations ?? []).filter((row) => row.is_active === true), [registrations])
  return useQuery({
    queryKey: [...keys.usage('active'), usageFingerprint(active)],
    queryFn: () => usageFor(active),
    enabled: registrations !== undefined,
    staleTime: 60_000,
    // A new or changed child reads again without the whole list blinking
    placeholderData: keepPreviousData
  })
}

/** Usage of one child (archived children are not in the active batch). */
export function useChildUsage(registration: Registration | undefined) {
  return useQuery({
    queryKey: [...keys.usage(registration?.id ?? 'none'), registration ? usageFingerprint([registration]) : ''],
    queryFn: async () => (await usageFor([registration!]))[registration!.id],
    enabled: Boolean(registration),
    staleTime: 60_000
  })
}

/**
 * Usage for the children of a lesson list: active ones come from the shared batch, the few archived
 * ones (they stay in the lessons they were part of) are read on their own.
 */
export function useUsageOf(rows: (UsageRow & Pick<Registration, 'is_active'>)[]) {
  const active = useActiveUsage().data
  const archived = useMemo(() => {
    const seen = new Map<string, UsageRow>()
    for (const row of rows) if (row.is_active !== true) seen.set(row.id, row)
    return [...seen.values()]
  }, [rows])
  const extra = useQuery({
    queryKey: ['usage', 'archived', usageFingerprint(archived)],
    queryFn: () => usageFor(archived),
    enabled: archived.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData
  })
  return useMemo<UsageMap | undefined>(() => (active ? { ...(extra.data ?? {}), ...active } : undefined), [active, extra.data])
}

/** Money still to come: unpaid package payments and expected income (shared by Today and Finance). */
export function usePendingIncome() {
  return useQuery({ queryKey: keys.finance('pending'), queryFn: pendingIncome })
}

export function useHistory(id: string | undefined) {
  return useQuery({ queryKey: keys.history(id ?? ''), queryFn: () => loadHistory(id!), enabled: Boolean(id) })
}

export function useChildLessons(id: string | undefined) {
  return useQuery({ queryKey: keys.childLessons(id ?? ''), queryFn: () => childLessons(id!), enabled: Boolean(id) })
}

export function useChildEntries(id: string | undefined) {
  return useQuery({ queryKey: keys.childEntries(id ?? ''), queryFn: () => childIncomeEntries(id!), enabled: Boolean(id) })
}

/** Refreshes everything a write may have changed. Cheap: lists are small and only visible ones refetch. */
export function useRefresh() {
  const client = useQueryClient()
  return useMemo(
    () => ({
      children: (id?: string) => {
        void client.invalidateQueries({ queryKey: keys.registrations })
        void client.invalidateQueries({ queryKey: ['usage'] })
        void client.invalidateQueries({ queryKey: ['finance'] })
        void client.invalidateQueries({ queryKey: ['lessons'] })
        if (id) {
          void client.invalidateQueries({ queryKey: keys.history(id) })
          void client.invalidateQueries({ queryKey: keys.childLessons(id) })
          void client.invalidateQueries({ queryKey: keys.childEntries(id) })
        }
      },
      attendance: (registrationId?: string) => {
        void client.invalidateQueries({ queryKey: ['usage'] })
        void client.invalidateQueries({ queryKey: keys.unmarked })
        if (registrationId) void client.invalidateQueries({ queryKey: keys.childLessons(registrationId) })
      },
      finance: (registrationId?: string) => {
        void client.invalidateQueries({ queryKey: ['finance'] })
        if (registrationId) void client.invalidateQueries({ queryKey: keys.childEntries(registrationId) })
      },
      /** After a lesson was added, changed, copied or removed: every lesson view and the children's numbers. */
      lessons: () => {
        void client.invalidateQueries({ queryKey: ['lessons'] })
        void client.invalidateQueries({ queryKey: ['lesson'] })
        void client.invalidateQueries({ queryKey: ['usage'] })
        void client.invalidateQueries({ queryKey: ['child-lessons'] })
      },
      themes: () => client.invalidateQueries({ queryKey: ['themes'] }),
      waitlist: () => client.invalidateQueries({ queryKey: keys.waitlist }),
      notes: () => client.invalidateQueries({ queryKey: keys.notes }),
      /** Packages, categories and card settings: every form and label reads them from here. */
      catalog: () => client.invalidateQueries({ queryKey: keys.catalog }),
      admins: () => client.invalidateQueries({ queryKey: keys.admins })
    }),
    [client]
  )
}

/** Names of codes: the catalog's own names first, the built-in labels while it loads. */
export function useLabels() {
  const { t, locale } = useI18n()
  const catalog = useCatalog().data
  return useMemo(() => makeLabels(t, locale, catalog), [catalog, locale, t])
}

export type { Labels } from '@hellokido/core/view'
export type { Catalog }
