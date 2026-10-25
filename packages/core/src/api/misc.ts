import { db, fetchAll, unwrap, unwrapRow, type Insert, type Row, type Update } from './db'

// ---------------------------------------------------------------------------------------------
// Waitlist: families who asked for a place. contact_date is a plain day ('yyyy-MM-dd', local).

export type WaitlistEntry = Row<'waitlist'>
export const WAITLIST_PACKAGES = ['belirsiz', 'tek-seferlik', 'hafta-1', 'hafta-2', 'hafta-3', 'hafta-4', '3ay-hafta-1', '3ay-hafta-2'] as const

export function listWaitlist(): Promise<WaitlistEntry[]> {
  return fetchAll<WaitlistEntry>(() => db.from('waitlist').select('*').order('created_at', { ascending: false }).order('id'))
}

export type WaitlistFields = Pick<Insert<'waitlist'>, 'parent_name' | 'parent_phone' | 'student_name' | 'student_age' | 'package_type' | 'contact_date' | 'status' | 'notes'>

export async function addWaitlistEntry(fields: WaitlistFields) {
  return unwrapRow(await db.from('waitlist').insert(fields).select('id').single()).id
}

/** Sends only the changed fields, so another admin's edit of the others is kept. */
export async function updateWaitlistEntry(id: string, changes: Update<'waitlist'>) {
  const result = await db.from('waitlist').update(changes).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

export async function deleteWaitlistEntry(id: string) {
  const result = await db.from('waitlist').delete().eq('id', id).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}

/** Undo of a removal: the row comes back as it was, same id and place in the queue. */
export async function restoreWaitlistEntry(entry: WaitlistEntry) {
  const result = await db.from('waitlist').upsert(entry, { onConflict: 'id', ignoreDuplicates: true })
  if (result.error) throw result.error
}

// ---------------------------------------------------------------------------------------------
// Notes

export type Note = Row<'notes'>
/** Stored colour values are the keys; the screen maps them to its own tones. */
export const NOTE_COLORS = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'] as const

export function listNotes(): Promise<Note[]> {
  return fetchAll<Note>(() => db.from('notes').select('*').order('created_at', { ascending: false }).order('id'))
}

export type NoteFields = Pick<Insert<'notes'>, 'title' | 'content' | 'color' | 'is_favorite'>

export async function addNote(fields: NoteFields) {
  return unwrapRow(await db.from('notes').insert(fields).select('id').single()).id
}

export async function updateNote(id: string, changes: Update<'notes'>) {
  const result = await db.from('notes').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

export async function deleteNote(id: string) {
  const result = await db.from('notes').delete().eq('id', id).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------------------------
// Panel access

export type Admin = { user_id: string; email: string; created_at: string; is_self: boolean }

export async function listAdmins(): Promise<Admin[]> {
  return (unwrap(await db.rpc('list_admins')) ?? []) as Admin[]
}

/** 'user_not_found' when nobody signed up with that email. */
export async function grantAdmin(email: string) {
  return unwrap(await db.rpc('grant_admin', { p_email: email.trim() }))
}

/** 'cannot_revoke_self' for one's own account. */
export async function revokeAdmin(userId: string) {
  return unwrap(await db.rpc('revoke_admin', { p_user_id: userId }))
}
