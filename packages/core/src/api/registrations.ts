import { db, fetchAll, unwrap, type Row } from './db'
import { resolveExtensionHistory } from '../rules/extensionHistory.js'
import { fetchCarryOverSource } from '../rules/lessonUsage.js'
import { isDuplicatePhoneError } from '../rules/registrationLookup.js'

export type Registration = Row<'registrations'>
export type ExtensionRow = Row<'extension_history'>
export type LedgerRow = Row<'financial_records'>

/** An extension row with its payment read from the ledger (see resolveExtensionHistory). */
export type ResolvedExtension = ExtensionRow & {
  financial_records?: Pick<LedgerRow, 'id' | 'amount' | 'payment_method' | 'payment_status' | 'payment_date' | 'created_at'>[]
}

export type PaymentStatus = 'odendi' | 'beklemede' | 'ucretsiz'
export type PaymentMethod = 'banka' | 'nakit' | 'kart' | 'belirlenmedi'

/** Every child, active and archived (a few hundred rows; lists filter in memory). */
export function listRegistrations(): Promise<Registration[]> {
  return fetchAll<Registration>(() => db.from('registrations').select('*').order('student_name').order('id'))
}

/** The row as the database has it now; screens hold copies that may be stale. */
export async function getRegistration(id: string): Promise<Registration | null> {
  return unwrap(await db.from('registrations').select('*').eq('id', id).maybeSingle())
}

/**
 * One word for each failure the registration functions report, so screens can say the right thing.
 * `stale` covers every "someone changed this meanwhile" error: the screen refreshes and asks again.
 */
export type RegistrationError =
  | 'stale'
  | 'pending_payment'
  | 'free_registration'
  | 'invalid_period'
  | 'duplicate_phone'
  | 'not_found'
  | 'other'

export function registrationError(error: unknown): RegistrationError {
  if (isDuplicatePhoneError(error)) return 'duplicate_phone'
  const message = String((error as { message?: string } | null)?.message ?? '')
  if (/stale_registration|not_latest_extension|extension_not_found/.test(message)) return 'stale'
  if (message.includes('pending_payment')) return 'pending_payment'
  if (message.includes('free_registration')) return 'free_registration'
  if (message.includes('invalid_period')) return 'invalid_period'
  if (message.includes('no_rows_updated') || message.includes('registration_not_found')) return 'not_found'
  return 'other'
}

export type NewRegistration = {
  student_name: string
  student_age: string
  parent_name: string
  parent_phone: string
  package_type: string
  package_start_date: string
  package_end_date: string
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  payment_amount: number
  payment_date: string | null
  notes: string | null
  extra_lessons: number
}

/** The child and its first ledger row are written together by one database function. */
export async function createRegistration(data: NewRegistration) {
  return unwrap(await db.rpc('create_registration', { p_data: data }))
}

export type RegistrationChanges = Partial<Omit<NewRegistration, 'notes'>> & { notes?: string }

/**
 * Sends only the fields that changed. `expectedUpdatedAt` must be the raw string read from the
 * database: a round trip through Date drops the microseconds and every save would look stale.
 */
export async function updateRegistration(id: string, expectedUpdatedAt: string, changes: RegistrationChanges) {
  return unwrap(
    await db.rpc('update_registration', {
      p_registration_id: id,
      p_expected_updated_at: expectedUpdatedAt,
      p_changes: changes
    })
  )
}

export type ExtensionInput = {
  registrationId: string
  /** extension_count of the row the person looked at; a newer extension makes the save stale. */
  expectedExtensionCount: number
  packageType: string
  startDate: Date
  endDate: Date
  paymentStatus: 'odendi' | 'beklemede'
  paymentMethod: PaymentMethod
  paymentAmount: number
  paymentDate: Date | null
  notes: string | null
  extraLessons: number
}

/**
 * Records a new period or a payment for the current one. The carried lessons are read fresh right
 * before saving (never the preview's numbers) and frozen into the closing row.
 */
export async function extendRegistration(input: ExtensionInput) {
  const source = await fetchCarryOverSource(input.registrationId)
  return unwrap(
    await db.rpc('extend_registration', {
      p_registration_id: input.registrationId,
      p_expected_extension_count: input.expectedExtensionCount,
      p_new_package_type: input.packageType,
      p_new_start_date: input.startDate.toISOString(),
      p_new_end_date: input.endDate.toISOString(),
      p_payment_status: input.paymentStatus,
      p_payment_method: input.paymentStatus === 'beklemede' ? 'belirlenmedi' : input.paymentMethod,
      p_payment_amount: input.paymentStatus === 'beklemede' ? 0 : input.paymentAmount,
      p_payment_date: input.paymentStatus === 'beklemede' || !input.paymentDate ? (null as unknown as string) : input.paymentDate.toISOString(),
      p_notes: (input.notes?.trim() || null) as string,
      p_previous_carried_lessons: Math.max(Number(source.carried) || 0, 0),
      p_extra_lessons: input.extraLessons
    })
  )
}

export type ExtensionEdit = Omit<ExtensionInput, 'registrationId' | 'expectedExtensionCount' | 'extraLessons'> & {
  extensionId: string
  expectedUpdatedAt: string
}

/** Corrects the latest extension; the database keeps the child, the history and the ledger in step. */
export async function updateExtension(input: ExtensionEdit) {
  return unwrap(
    await db.rpc('update_extension', {
      p_extension_id: input.extensionId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_new_package_type: input.packageType,
      p_new_start_date: input.startDate.toISOString(),
      p_new_end_date: input.endDate.toISOString(),
      p_payment_status: input.paymentStatus,
      p_payment_method: input.paymentStatus === 'beklemede' ? 'belirlenmedi' : input.paymentMethod,
      p_payment_amount: input.paymentStatus === 'beklemede' ? 0 : input.paymentAmount,
      p_payment_date: input.paymentStatus === 'beklemede' || !input.paymentDate ? (null as unknown as string) : input.paymentDate.toISOString(),
      p_notes: (input.notes?.trim() || null) as string
    })
  )
}

/** Undoes the latest extension and its ledger row; the child returns to the state before it. */
export async function deleteLastExtension(extensionId: string) {
  return unwrap(await db.rpc('delete_last_extension', { p_extension_id: extensionId }))
}

/** Archive or bring back. Children are never deleted: their payments and lessons stay. */
export async function setRegistrationActive(id: string, active: boolean) {
  const result = await db.from('registrations').update({ is_active: active }).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('no_rows_updated')
}

/** Seats the child still holds in lessons that have not happened yet. */
export async function upcomingSeats(registrationId: string): Promise<string[]> {
  const result = await db
    .from('event_participants')
    .select('id, events!inner(event_date)')
    .eq('registration_id', registrationId)
    .eq('status', 'scheduled')
    .gt('events.event_date', new Date().toISOString())
  return (unwrap(result) ?? []).map((row) => row.id)
}

/** Frees those seats; rows whose attendance was marked meanwhile are left alone. */
export async function releaseSeats(participantIds: string[]) {
  if (participantIds.length === 0) return
  const result = await db.from('event_participants').delete().in('id', participantIds).eq('status', 'scheduled')
  if (result.error) throw result.error
}

export type InitialPayment = Pick<LedgerRow, 'amount' | 'payment_method' | 'payment_date'>

export type History = {
  registration: Registration
  initialPayment: InitialPayment | null
  extensions: ResolvedExtension[]
}

/**
 * The child's periods and payments, oldest first. Payments come from the ledger, the current
 * package from the child's row (see resolveExtensionHistory).
 */
export async function loadHistory(registrationId: string): Promise<History> {
  const [registration, initial, extensions] = await Promise.all([
    db.from('registrations').select('*').eq('id', registrationId).maybeSingle(),
    db
      .from('financial_records')
      .select('amount, payment_method, payment_date')
      .eq('registration_id', registrationId)
      .eq('transaction_type', 'initial_payment')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('extension_history')
      .select('*, financial_records(id, amount, payment_method, payment_status, payment_date, created_at)')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
  ])
  const fresh = unwrap(registration)
  if (!fresh) throw new Error('registration_not_found')
  return {
    registration: fresh,
    initialPayment: unwrap(initial),
    extensions: resolveExtensionHistory(fresh, unwrap(extensions) ?? []) as ResolvedExtension[]
  }
}

export type ChildLesson = {
  id: string
  status: string
  is_makeup: boolean | null
  makeup_notes: string | null
  postponed_notes: string | null
  cancellation_reason: string | null
  events: { id: string; event_date: string; event_type: string; age_group: string; custom_description: string | null } | null
}

/** Every lesson of the child across all periods, newest first. */
export async function childLessons(registrationId: string): Promise<ChildLesson[]> {
  const rows = await fetchAll<ChildLesson>(() =>
    db
      .from('event_participants')
      .select('id, status, is_makeup, makeup_notes, postponed_notes, cancellation_reason, events(id, event_date, event_type, age_group, custom_description)')
      .eq('registration_id', registrationId)
      .order('id')
  )
  return rows
    .filter((row) => row.events)
    .sort((a, b) => new Date(b.events!.event_date).getTime() - new Date(a.events!.event_date).getTime())
}
