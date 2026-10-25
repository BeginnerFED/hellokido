import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../db/types'
import { supabase } from '../rules/client.js'
import { fetchAllRows } from '../rules/fetchAll.js'

/** The client the app injected with setSupabaseClient, typed with the database schema. */
export const db = supabase as unknown as SupabaseClient<Database>

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Insert<T extends keyof Tables> = Tables[T]['Insert']
export type Update<T extends keyof Tables> = Tables[T]['Update']

/** Reads every page of a query; PostgREST silently stops at 1000 rows. */
export function fetchAll<T>(buildQuery: () => unknown): Promise<T[]> {
  return fetchAllRows(buildQuery as never) as Promise<T[]>
}

/** Throws the Supabase error so callers (and TanStack Query) see a failure. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error
  return result.data as T
}

/** For writes that must hand back the row they made (insert … select().single()). */
export function unwrapRow<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error
  if (result.data == null) throw new Error('no_row')
  return result.data as NonNullable<R['data']>
}
