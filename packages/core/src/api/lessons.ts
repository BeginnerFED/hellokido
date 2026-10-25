import { db, unwrap, unwrapRow, type Row } from './db'
import type { Registration } from './registrations'
import { isRecordedAttendance } from '../rules/attendance.js'

export type LessonType = 'ingilizce' | 'duyusal' | 'ozel'
export type AttendanceStatus = 'scheduled' | 'attended' | 'no_show' | 'postponed' | 'makeup' | 'cancelled'

/** A lesson holds at most this many children of any status (events.max_capacity, enforced by the database). */
export const LESSON_ROW_LIMIT = 10
/** Seats shown to people: the room is planned for six. */
export const SEATS_SHOWN = 6

export type LessonChild = Pick<
  Registration,
  | 'id'
  | 'student_name'
  | 'student_age'
  | 'parent_name'
  | 'parent_phone'
  | 'is_active'
  | 'package_type'
  | 'package_start_date'
  | 'package_end_date'
  | 'extra_lessons'
  | 'payment_status'
>

export type Seat = { id: string; registration_id: string; status: AttendanceStatus; created_at: string | null; child: LessonChild }
export type Lesson = Row<'events'> & { seats: Seat[] }

const CHILD_COLUMNS =
  'id, student_name, student_age, parent_name, parent_phone, is_active, package_type, package_start_date, package_end_date, extra_lessons, payment_status'

/** Reads children by id in slices, so a month of lessons never builds an over-long address. */
async function childrenById(ids: string[]): Promise<Map<string, LessonChild>> {
  const unique = [...new Set(ids)]
  const map = new Map<string, LessonChild>()
  for (let i = 0; i < unique.length; i += 120) {
    const slice = unique.slice(i, i + 120)
    const rows = unwrap(await db.from('registrations').select(CHILD_COLUMNS).in('id', slice)) ?? []
    for (const row of rows as LessonChild[]) map.set(row.id, row)
  }
  return map
}

/**
 * Lessons whose start lies in [start, end), with their children (archived ones too: they stay in
 * the lessons they were part of). A seat whose child cannot be read is left out of every count.
 */
export async function lessonsBetween(start: Date, end: Date): Promise<Lesson[]> {
  const events = unwrap(
    await db
      .from('events')
      .select('*, event_participants(id, registration_id, status, created_at)')
      .eq('is_active', true)
      .gte('event_date', start.toISOString())
      .lt('event_date', end.toISOString())
      .order('event_date', { ascending: true })
      .order('created_at', { referencedTable: 'event_participants', ascending: true })
  ) ?? []
  const children = await childrenById(events.flatMap((event) => event.event_participants.map((row) => row.registration_id)))
  return events.map(({ event_participants, ...event }) => ({
    ...event,
    seats: event_participants
      .filter((row) => children.has(row.registration_id))
      .map((row) => ({ ...row, status: row.status as AttendanceStatus, child: children.get(row.registration_id)! }))
  }))
}

/** Is another lesson already starting in this exact minute? One lesson per minute, workshop-wide. */
export async function minuteTaken(start: Date, excludeId?: string) {
  const from = new Date(start)
  from.setSeconds(0, 0)
  const to = new Date(from.getTime() + 60_000)
  let query = db.from('events').select('id').eq('is_active', true).gte('event_date', from.toISOString()).lt('event_date', to.toISOString())
  if (excludeId) query = query.neq('id', excludeId)
  const rows = unwrap(await query.limit(1)) ?? []
  return rows.length > 0
}

export type LessonFields = {
  start: Date
  ageGroup: string
  type: LessonType
  description: string | null
}

/** The errors lesson writes report, as one word the screens translate. */
export class LessonError extends Error {
  constructor(
    public code: 'minute_taken' | 'too_many' | 'not_found' | 'needs_confirmation',
    public detail: { count?: number; limit?: number; names?: string[] } = {}
  ) {
    super(code)
  }
}

const toRow = (fields: LessonFields) => {
  const start = new Date(fields.start)
  start.setSeconds(0, 0)
  return {
    event_date: start.toISOString(),
    age_group: fields.ageGroup,
    event_type: fields.type,
    custom_description: fields.type === 'ozel' ? fields.description?.trim() || null : null
  }
}

/**
 * New lesson with its children. If adding the children fails the lesson is removed again, so a
 * retry never leaves two lessons in the same minute.
 */
export async function createLesson(fields: LessonFields, registrationIds: string[], maxCapacity = LESSON_ROW_LIMIT) {
  if (registrationIds.length > maxCapacity) throw new LessonError('too_many', { count: registrationIds.length, limit: maxCapacity })
  if (await minuteTaken(fields.start)) throw new LessonError('minute_taken')
  const event = unwrapRow(
    await db
      .from('events')
      .insert({ ...toRow(fields), max_capacity: maxCapacity, current_capacity: 0 })
      .select('id')
      .single()
  )
  if (registrationIds.length > 0) {
    const inserted = await db.from('event_participants').insert(registrationIds.map((id) => ({ event_id: event.id, registration_id: id })))
    if (inserted.error) {
      await db.from('events').delete().eq('id', event.id)
      throw inserted.error
    }
  }
  return event.id
}

export type LessonDetail = {
  lesson: Row<'events'>
  seats: { id: string; registration_id: string; status: AttendanceStatus; child: LessonChild }[]
}

/** The lesson as stored now, for the edit sheet; seats without a readable child are hidden and never touched. */
export async function loadLesson(id: string): Promise<LessonDetail> {
  const [event, participants] = await Promise.all([
    db.from('events').select('*').eq('id', id).maybeSingle(),
    db.from('event_participants').select('id, registration_id, status').eq('event_id', id)
  ])
  const lesson = unwrap(event)
  if (!lesson) throw new LessonError('not_found')
  const rows = unwrap(participants) ?? []
  const ids = rows.map((row) => row.registration_id)
  const children = ids.length
    ? ((unwrap(await db.from('registrations').select(CHILD_COLUMNS).in('id', ids)) ?? []) as LessonChild[])
    : []
  const byId = new Map(children.map((child) => [child.id, child]))
  return {
    lesson,
    seats: rows
      .filter((row) => byId.has(row.registration_id))
      .map((row) => ({ ...row, status: row.status as AttendanceStatus, child: byId.get(row.registration_id)! }))
  }
}

export type LessonSave = {
  lessonId: string
  /** registration id → status, as the sheet found them when it opened */
  snapshot: Map<string, { participantId: string; status: AttendanceStatus; name: string }>
  fields: LessonFields
  /** Children in the form with the status chosen for each */
  children: { registrationId: string; status: AttendanceStatus }[]
  timeChanged: boolean
  maxCapacity: number
  /** The person agreed to remove children whose attendance was recorded */
  removalConfirmed: boolean
}

/**
 * Saves the edit sheet. Changes are worked out against the snapshot taken when it opened: only
 * children this person removed are removed, only those they added are added, and only statuses
 * they changed are written; edits made meanwhile on another device survive.
 */
export async function saveLesson(save: LessonSave) {
  const { lessonId, snapshot, fields, children, maxCapacity } = save
  if (children.length > maxCapacity) throw new LessonError('too_many', { count: children.length, limit: maxCapacity })
  if (save.timeChanged && (await minuteTaken(fields.start, lessonId))) throw new LessonError('minute_taken')

  const current = unwrap(await db.from('event_participants').select('id, registration_id, status').eq('event_id', lessonId)) ?? []
  const inDb = new Map(current.map((row) => [row.registration_id, row]))
  const inForm = new Map(children.map((child) => [child.registrationId, child]))

  const removals = [...snapshot.keys()].filter((id) => !inForm.has(id) && inDb.has(id))
  const additions = children.filter((child) => !snapshot.has(child.registrationId) && !inDb.has(child.registrationId))
  if (current.length - removals.length + additions.length > maxCapacity) throw new LessonError('too_many', { limit: maxCapacity })

  const recorded = removals.filter((id) => isRecordedAttendance(inDb.get(id)!.status))
  if (recorded.length > 0 && !save.removalConfirmed) {
    throw new LessonError('needs_confirmation', { names: recorded.map((id) => snapshot.get(id)?.name ?? '') })
  }

  if (removals.length > 0) {
    const removed = await db.from('event_participants').delete().eq('event_id', lessonId).in('registration_id', removals)
    if (removed.error) throw removed.error
  }
  if (additions.length > 0) {
    const added = await db
      .from('event_participants')
      .insert(additions.map((child) => ({ event_id: lessonId, registration_id: child.registrationId, status: child.status })))
    if (added.error) throw added.error
  }

  // One request per new status, only for children whose status this person changed
  const byStatus = new Map<AttendanceStatus, string[]>()
  for (const child of children) {
    const before = snapshot.get(child.registrationId)
    const row = inDb.get(child.registrationId)
    if (!before || !row || child.status === before.status) continue
    byStatus.set(child.status, [...(byStatus.get(child.status) ?? []), row.id])
  }
  for (const [status, ids] of byStatus) {
    const updated = await db.from('event_participants').update({ status }).in('id', ids)
    if (updated.error) throw updated.error
  }

  const result = await db
    .from('events')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new LessonError('not_found')
}

/**
 * Copies one lesson to another day: same checks as a new lesson (the source itself counts as a
 * clash), everyone starts as scheduled, and the caller leaves archived children out.
 */
export function copyLesson(fields: LessonFields, registrationIds: string[], maxCapacity: number) {
  return createLesson(fields, registrationIds, maxCapacity)
}

/** Deletes the lesson and, through the database, every child's seat in it. */
export async function deleteLesson(id: string) {
  const result = await db.from('events').delete().eq('id', id)
  if (result.error) throw result.error
}

/** Moves a lesson to another start; the children and their statuses move with it. */
export async function moveLesson(id: string, start: Date) {
  if (await minuteTaken(start, id)) throw new LessonError('minute_taken')
  const at = new Date(start)
  at.setSeconds(0, 0)
  const result = await db.from('events').update({ event_date: at.toISOString() }).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new LessonError('not_found')
}

/** Marks one child's attendance. Zero rows means the seat was removed elsewhere. */
export async function setAttendance(participantId: string, status: AttendanceStatus) {
  const result = await db.from('event_participants').update({ status }).eq('id', participantId).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new LessonError('not_found')
}

export type UnmarkedSeat = {
  id: string
  status: AttendanceStatus
  registration_id: string
  events: { id: string; event_date: string; event_type: string; age_group: string; custom_description: string | null }
  child: Pick<Registration, 'id' | 'student_name' | 'parent_name' | 'is_active' | 'package_type' | 'package_start_date'>
}

/** Seats still "scheduled" in lessons of the last 30 days: attendance someone forgot to mark. */
export async function unmarkedSeats(now = new Date()): Promise<UnmarkedSeat[]> {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const from = new Date(todayStart)
  from.setDate(from.getDate() - 30)
  const rows =
    unwrap(
      await db
        .from('event_participants')
        .select('id, status, registration_id, events!inner(id, event_date, event_type, age_group, custom_description, is_active)')
        .eq('status', 'scheduled')
        .eq('events.is_active', true)
        .gte('events.event_date', from.toISOString())
        .lt('events.event_date', todayStart.toISOString())
    ) ?? []
  const ids = [...new Set(rows.map((row) => row.registration_id))]
  const children = new Map<string, UnmarkedSeat['child']>()
  for (let i = 0; i < ids.length; i += 120) {
    const slice = ids.slice(i, i + 120)
    const found = unwrap(
      await db.from('registrations').select('id, student_name, parent_name, is_active, package_type, package_start_date').in('id', slice)
    ) ?? []
    for (const child of found) children.set(child.id, child)
  }
  return rows
    .filter((row) => children.has(row.registration_id))
    .map((row) => ({ ...row, status: row.status as AttendanceStatus, child: children.get(row.registration_id)! }) as UnmarkedSeat)
    .sort((a, b) => {
      const byDate = new Date(b.events.event_date).getTime() - new Date(a.events.event_date).getTime()
      return byDate || a.child.student_name.localeCompare(b.child.student_name, 'tr')
    })
}

// ---------------------------------------------------------------------------------------------
// Weekly themes: one row per Monday, keyed 'yyyy-MM-dd' in local time (never toISOString).

export async function themesBetween(fromKey: string, toKeyInclusive: string): Promise<Record<string, string>> {
  const rows =
    unwrap(await db.from('weekly_themes').select('week_start, theme').gte('week_start', fromKey).lte('week_start', toKeyInclusive)) ?? []
  return Object.fromEntries(rows.map((row) => [row.week_start, row.theme]))
}

/** Writes the changed weeks: filled ones are upserted, emptied ones that existed are deleted. */
export async function saveThemes(upserts: { week_start: string; theme: string }[], deletions: string[]) {
  if (upserts.length > 0) {
    const result = await db.from('weekly_themes').upsert(upserts, { onConflict: 'week_start' })
    if (result.error) throw result.error
  }
  if (deletions.length > 0) {
    const result = await db.from('weekly_themes').delete().in('week_start', deletions)
    if (result.error) throw result.error
  }
}

// ---------------------------------------------------------------------------------------------
// Copy week: one database call, all or nothing.

export type CopyWeekResult = { source: number; copied: number; skipped: number; skipped_slots: string[]; seats?: number; archived_seats?: number }

export async function copyWeek(sourceStart: Date, weeks: number, excluded: string[], dryRun: boolean): Promise<CopyWeekResult> {
  const result = await db.rpc('copy_week', {
    p_source_start: sourceStart.toISOString(),
    p_weeks: weeks,
    p_excluded: excluded,
    p_dry_run: dryRun
  })
  return unwrap(result) as unknown as CopyWeekResult
}

/** The children seated in a week's lessons, for the lesson-quota check before copying it. */
export async function childrenOfWeek(sourceStart: Date): Promise<Registration[]> {
  const end = new Date(sourceStart)
  end.setDate(end.getDate() + 7)
  const events =
    unwrap(
      await db
        .from('events')
        .select('id, event_participants(registration_id)')
        .eq('is_active', true)
        .gte('event_date', sourceStart.toISOString())
        .lt('event_date', end.toISOString())
    ) ?? []
  const ids = [...new Set(events.flatMap((event) => event.event_participants.map((row) => row.registration_id)))]
  const rows: Registration[] = []
  for (let i = 0; i < ids.length; i += 120) {
    rows.push(...((unwrap(await db.from('registrations').select('*').in('id', ids.slice(i, i + 120))) ?? []) as Registration[]))
  }
  return rows
}
