import { differenceInCalendarDays, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { db, unwrap, unwrapRow, type Row } from './db'

// Messages parents receive on WhatsApp. They are always Turkish, whatever the panel's language.
// The texts are templates the admin edits in Settings › Messages; variables in braces ({veli},
// {çocuk}, ...) are filled in here, the same way on the web panel and the phone app.

export type MessageKind = 'lesson' | 'payment' | 'package_end' | 'custom'
export const MESSAGE_KINDS: MessageKind[] = ['lesson', 'payment', 'package_end', 'custom']

export type MessageTemplate = Row<'message_templates'>

/** Facts about the workshop that every message may use. */
export type WorkshopInfo = { place: string; map: string; duration: string }

export const DEFAULT_WORKSHOP: WorkshopInfo = {
  place: 'Ritim İstanbul B blok Kat:1 Ofis 237',
  map: 'https://maps.app.goo.gl/rb2m4migY24gA8GMA',
  duration: '75-90 dk'
}

/**
 * The texts the panel sends until the admin writes their own (the same as the seeded defaults).
 * They keep the previous panel's wording, without the "Hanım" that was wrong for fathers.
 */
export const DEFAULT_MESSAGES: Record<Exclude<MessageKind, 'custom'>, string> = {
  lesson: `Merhaba {veli}
Çocuğunuzun etkinliğimizde bize katılacak olmasından büyük mutluluk duyuyoruz! İşte rezervasyonunuzla ilgili detaylar:
* Etkinlik Tarihi: {tarih} ({gün})
* Saat: {saat}
* Etkinlik: {ders}
* Yer: {yer}
* Adres: {konum}
* Süre: {süre}
Etkinlik sırasında çocuklarınızı güvende tutmak için gerekli tüm önlemleri aldık. Lütfen çocuğunuzun rahat kıyafetlerle gelmesini sağlayın ve yanlarına bir su şişesi ve küçük bir atıştırmalık getirmeyi unutmayın. Yedek kıyafet yada aktivite önlüğü getirmenizi tavsiye ederiz.
Rezervasyonunuzun iptali için lütfen bir gün önceden bizi bilgilendiriniz. Rezervasyonunuza saatinde gelmenizi rica ederiz.
Eğer herhangi bir sorunuz varsa, lütfen bize ulaşmaktan çekinmeyin.
Sizleri ve çocuğunuzu atölyemizde görmek için sabırsızlanıyoruz!
Sevgilerle,
HelloKido Oyun Atölyesi`,
  payment: 'Merhabalar {veli}. {çocuk} için ödeme beklemekteyiz. Bilginize sunarız.',
  package_end: 'Merhabalar {veli}. {çocuk} adlı öğrencinizin paketinde kalan ders sayısı: {kalan}. Bilginize sunarız.'
}

/** Every variable the editor offers, in its order. */
export const MESSAGE_VARIABLES = ['veli', 'çocuk', 'tarih', 'gün', 'saat', 'ders', 'yer', 'konum', 'süre', 'paket', 'kalan', 'tutar'] as const
export type MessageVariable = (typeof MESSAGE_VARIABLES)[number]

/**
 * Variables older texts may still hold: they are still filled in, but the editor no longer offers
 * them. A package ends when its lessons run out, not on the day its period was planned to end
 * (families often come later), so messages speak of the lessons left.
 */
const RETIRED_VARIABLES = ['bitiş', 'bitiş durumu'] as const
type KnownVariable = MessageVariable | (typeof RETIRED_VARIABLES)[number]

/** The variables that mean something for a kind; the editor shows these first. */
export const VARIABLES_FOR: Record<MessageKind, MessageVariable[]> = {
  lesson: ['veli', 'çocuk', 'tarih', 'gün', 'saat', 'ders', 'yer', 'konum', 'süre', 'kalan'],
  payment: ['veli', 'çocuk', 'paket', 'tutar', 'yer', 'konum'],
  package_end: ['veli', 'çocuk', 'paket', 'kalan', 'yer', 'konum'],
  custom: ['veli', 'çocuk', 'paket', 'kalan', 'yer', 'konum', 'süre']
}

const LESSON_TYPES_TR: Record<string, string> = {
  ingilizce: 'İngilizce',
  duyusal: 'Duyusal',
  ozel: 'Özel Etkinlik'
}

/** What a message is about; anything missing leaves its variable empty. */
export type MessageContext = {
  parentName?: string | null
  childName?: string | null
  lesson?: { date: string | Date; type: string } | null
  packageName?: string | null
  remaining?: number | null
  endDate?: string | Date | null
  amount?: string | null
  workshop?: WorkshopInfo | null
  now?: Date
}

const day = (date: Date) => format(date, 'd MMMM yyyy', { locale: tr })

export function messageValues(context: MessageContext): Record<KnownVariable, string> {
  const now = context.now ?? new Date()
  const workshop = context.workshop ?? DEFAULT_WORKSHOP
  const lessonDate = context.lesson ? new Date(context.lesson.date) : null
  const offset = lessonDate ? differenceInCalendarDays(lessonDate, now) : null
  const end = context.endDate ? new Date(context.endDate) : null
  return {
    veli: context.parentName?.trim() ?? '',
    çocuk: context.childName?.trim() ?? '',
    tarih: lessonDate ? day(lessonDate) : '',
    gün: lessonDate ? (offset === 1 ? 'Yarın' : offset === 0 ? 'Bugün' : format(lessonDate, 'EEEE', { locale: tr })) : '',
    saat: lessonDate ? format(lessonDate, 'HH:mm') : '',
    ders: context.lesson ? (LESSON_TYPES_TR[context.lesson.type] ?? LESSON_TYPES_TR.ozel) : '',
    yer: workshop.place,
    konum: workshop.map,
    süre: workshop.duration,
    paket: context.packageName ?? '',
    kalan: context.remaining == null ? '' : String(Math.max(context.remaining, 0)),
    bitiş: end ? day(end) : '',
    'bitiş durumu': end ? (differenceInCalendarDays(end, now) < 0 ? 'sona ermiştir' : 'sona erecektir') : '',
    tutar: context.amount ?? ''
  }
}

const TOKEN = /\{([^{}\n]{1,30})\}/g

/** Fills the variables in; a word in braces that is not a variable stays as written. */
export function renderMessage(body: string, context: MessageContext) {
  const values = messageValues(context) as Record<string, string>
  return body.replace(TOKEN, (whole, name: string) => {
    const key = name.trim().toLocaleLowerCase('tr-TR')
    return key in values ? values[key] : whole
  })
}

/** The words in braces that are not variables, so the editor can point at a typo. */
export function unknownVariables(body: string) {
  const known = new Set<string>([...MESSAGE_VARIABLES, ...RETIRED_VARIABLES])
  return [...body.matchAll(TOKEN)].map((match) => match[1].trim()).filter((name) => !known.has(name.toLocaleLowerCase('tr-TR')))
}

/** The template a kind uses: the admin's default, else the built-in text. */
export function templateFor(templates: MessageTemplate[] | undefined, kind: Exclude<MessageKind, 'custom'>) {
  const chosen = templates?.find((template) => template.kind === kind && template.is_default)
  return { id: chosen?.id ?? null, body: chosen?.body ?? DEFAULT_MESSAGES[kind] }
}

// ---------------------------------------------------------------------------------------------
// The built-in texts as before, for callers that have no templates at hand.

/** The reminder sent the day before a lesson. */
export function lessonReminderText(parentName: string, lessonDate: string | Date, lessonType: string, now = new Date()) {
  return renderMessage(DEFAULT_MESSAGES.lesson, { parentName, lesson: { date: lessonDate, type: lessonType }, now })
}

/** A gentle note that a payment is still expected. */
export function paymentReminderText(parentName: string, studentName: string) {
  return renderMessage(DEFAULT_MESSAGES.payment, { parentName, childName: studentName })
}

/** Tells the family how many lessons are left in the package. */
export function packageEndText(parentName: string, studentName: string, remaining: number) {
  return renderMessage(DEFAULT_MESSAGES.package_end, { parentName, childName: studentName, remaining })
}

// ---------------------------------------------------------------------------------------------
// Templates

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return unwrap(await db.from('message_templates').select('*').order('sort_order').order('created_at')) ?? []
}

export type TemplateFields = { kind: MessageKind; title: string; body: string }

export async function addMessageTemplate(fields: TemplateFields) {
  const last = unwrap(await db.from('message_templates').select('sort_order').order('sort_order', { ascending: false }).limit(1))
  const sort_order = (last?.[0]?.sort_order ?? 0) + 10
  return unwrapRow(await db.from('message_templates').insert({ ...fields, sort_order }).select('*').single())
}

export async function updateMessageTemplate(id: string, changes: Partial<Pick<MessageTemplate, 'title' | 'body'>>) {
  const result = await db.from('message_templates').update(changes).eq('id', id).select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

export async function deleteMessageTemplate(id: string) {
  const result = await db.from('message_templates').delete().eq('id', id).select('id')
  if (result.error) throw result.error
  return (result.data?.length ?? 0) > 0
}

export async function setDefaultMessageTemplate(id: string) {
  const result = await db.rpc('set_default_message_template', { template_id: id })
  if (result.error) throw result.error
}

// ---------------------------------------------------------------------------------------------
// Workshop facts (app_settings 'workshop')

export function readWorkshop(value: unknown): WorkshopInfo {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const text = (key: keyof WorkshopInfo) => (typeof row[key] === 'string' ? (row[key] as string) : DEFAULT_WORKSHOP[key])
  return { place: text('place'), map: text('map'), duration: text('duration') }
}

export async function updateWorkshop(info: WorkshopInfo) {
  const value = { place: info.place.trim(), map: info.map.trim(), duration: info.duration.trim() }
  const result = await db.from('app_settings').update({ value }).eq('key', 'workshop').select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

// ---------------------------------------------------------------------------------------------
// Evening reminder (app_settings 'evening_reminder'): the server tells every admin phone how many
// of tomorrow's families still wait for their reminder, once a day at this Istanbul time

export type EveningReminder = { enabled: boolean; time: string }

export const DEFAULT_EVENING_REMINDER: EveningReminder = { enabled: true, time: '16:00' }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** "16:00" from "16:00", "16.00", "1600" or "9:30"; null for anything that is not a time of day. */
export function parseTimeOfDay(text: string): string | null {
  const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(text.trim())
  if (!match) return null
  const time = `${match[1].padStart(2, '0')}:${match[2]}`
  return TIME.test(time) ? time : null
}

export function readEveningReminder(value: unknown): EveningReminder {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : DEFAULT_EVENING_REMINDER.enabled,
    time: typeof row.time === 'string' && TIME.test(row.time) ? row.time : DEFAULT_EVENING_REMINDER.time
  }
}

export async function updateEveningReminder(setting: EveningReminder) {
  const result = await db.from('app_settings').update({ value: { enabled: setting.enabled, time: setting.time } }).eq('key', 'evening_reminder').select('id')
  if (result.error) throw result.error
  if (!result.data?.length) throw new Error('not_found')
}

/** Signs this phone up for the evening reminder; called after sign-in with the phone's Expo push token. */
export async function registerPushDevice(token: string, locale: string, platform: 'ios' | 'android') {
  const result = await db.rpc('register_push_device', { device_token: token, device_locale: locale, device_platform: platform })
  if (result.error) throw result.error
}

/** Takes this phone off the list; called before signing out, while the session still exists. */
export async function unregisterPushDevice(token: string) {
  const result = await db.rpc('unregister_push_device', { device_token: token })
  if (result.error) throw result.error
}

// ---------------------------------------------------------------------------------------------
// Reminder log: what was opened in WhatsApp, shared by every admin and device

export type ReminderLogEntry = Row<'reminder_log'>

/** Lesson reminders already sent for these seats. */
export async function remindersForSeats(participantIds: string[]): Promise<ReminderLogEntry[]> {
  if (participantIds.length === 0) return []
  return unwrap(await db.from('reminder_log').select('*').in('participant_id', participantIds).order('sent_at', { ascending: false })) ?? []
}

/** Everything sent to one family, newest first. */
export async function remindersForChild(registrationId: string, limit = 30): Promise<ReminderLogEntry[]> {
  return unwrap(await db.from('reminder_log').select('*').eq('registration_id', registrationId).order('sent_at', { ascending: false }).limit(limit)) ?? []
}

/** Reminders of a kind sent since a moment, e.g. payment reminders of the last week. */
export async function remindersSince(kind: MessageKind, since: Date): Promise<ReminderLogEntry[]> {
  return unwrap(await db.from('reminder_log').select('*').eq('kind', kind).gte('sent_at', since.toISOString()).order('sent_at', { ascending: false })) ?? []
}

export async function logReminder(entry: { kind: MessageKind; registrationId: string; participantId?: string | null; templateId?: string | null }) {
  return unwrapRow(
    await db
      .from('reminder_log')
      .insert({ kind: entry.kind, registration_id: entry.registrationId, participant_id: entry.participantId ?? null, template_id: entry.templateId ?? null })
      .select('*')
      .single()
  )
}

export async function unlogReminder(id: string) {
  const result = await db.from('reminder_log').delete().eq('id', id).select('id')
  if (result.error) throw result.error
}
