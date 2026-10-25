import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listMessageTemplates,
  logReminder,
  remindersForChild,
  remindersForSeats,
  remindersSince,
  renderMessage,
  templateFor,
  unlogReminder,
  type MessageContext,
  type MessageKind,
  type ReminderLogEntry
} from '@hellokido/core/api'
import { useI18n } from '../providers/I18n'
import { useToast } from '../ui/Toast'
import { useCatalog } from './queries'

// The same keys and hooks as the web panel: both read one table of templates and one shared log

export const messageKeys = {
  templates: ['message-templates'] as const,
  log: ['reminder-log'] as const,
  seats: (ids: string[]) => ['reminder-log', 'seats', ...ids] as const,
  child: (id: string) => ['reminder-log', 'child', id] as const,
  since: (kind: MessageKind, day: string) => ['reminder-log', 'since', kind, day] as const
}

export function useTemplates() {
  return useQuery({ queryKey: messageKeys.templates, queryFn: listMessageTemplates, staleTime: 5 * 60_000 })
}

/**
 * Writes a kind's message for a family from the admin's own template, with the workshop's facts.
 * Package names go to parents in Turkish whatever the app's language.
 */
export function useMessageWriter() {
  const templates = useTemplates().data
  const catalog = useCatalog().data
  return useCallback(
    (kind: Exclude<MessageKind, 'custom'>, context: Omit<MessageContext, 'workshop' | 'packageName'> & { packageCode?: string | null }) => {
      const template = templateFor(templates, kind)
      const packageName = context.packageCode ? (catalog?.packages.find((row) => row.code === context.packageCode)?.name_tr ?? context.packageCode) : null
      return { text: renderMessage(template.body, { ...context, packageName, workshop: catalog?.settings.workshop }), templateId: template.id }
    },
    [templates, catalog]
  )
}

/** Everything sent to one family, newest first. */
export function useChildReminders(registrationId: string) {
  return useQuery({ queryKey: messageKeys.child(registrationId), queryFn: () => remindersForChild(registrationId) })
}

/** Lesson reminders sent for these seats, by every admin on every device. */
export function useSeatReminders(seatIds: string[]) {
  const ids = useMemo(() => [...seatIds].sort(), [seatIds])
  const query = useQuery({ queryKey: messageKeys.seats(ids), queryFn: () => remindersForSeats(ids), enabled: ids.length > 0, staleTime: 30_000 })
  const bySeat = useMemo(() => {
    const map = new Map<string, ReminderLogEntry>()
    for (const entry of query.data ?? []) if (entry.participant_id && !map.has(entry.participant_id)) map.set(entry.participant_id, entry)
    return map
  }, [query.data])
  return { query, bySeat }
}

/** Payment or package-end reminders of the last 30 days, newest per family. */
export function useRecentReminders(kind: MessageKind, dayKey: string) {
  const query = useQuery({
    queryKey: messageKeys.since(kind, dayKey),
    queryFn: () => remindersSince(kind, new Date(new Date(`${dayKey}T00:00:00`).getTime() - 30 * 86_400_000)),
    staleTime: 60_000
  })
  const byChild = useMemo(() => {
    const map = new Map<string, ReminderLogEntry>()
    for (const entry of query.data ?? []) if (!map.has(entry.registration_id)) map.set(entry.registration_id, entry)
    return map
  }, [query.data])
  return { query, byChild }
}

/** Records that a reminder was opened in WhatsApp, or takes the record back. */
export function useReminderLog() {
  const client = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()
  // The refresh is awaited, so a row never flickers back to "not sent" in between
  const log = useMutation({
    mutationFn: logReminder,
    onSuccess: () => client.invalidateQueries({ queryKey: messageKeys.log }),
    onError: () => toast({ tone: 'error', title: t.messages.logFailed })
  })
  const unlog = useMutation({
    mutationFn: unlogReminder,
    onSuccess: () => client.invalidateQueries({ queryKey: messageKeys.log }),
    onError: () => toast({ tone: 'error', title: t.messages.logFailed })
  })
  return { log: log.mutate, unlog: unlog.mutate }
}

/** "Reminded yesterday" and the like, for a family's last reminder of a kind. */
export function useRemindedText() {
  const { t, plural } = useI18n()
  return useCallback(
    (entry: ReminderLogEntry | undefined, dayKey: string) => {
      if (!entry) return null
      const sent = new Date(entry.sent_at)
      const days = Math.round((new Date(`${dayKey}T00:00:00`).getTime() - new Date(sent.getFullYear(), sent.getMonth(), sent.getDate()).getTime()) / 86_400_000)
      return days <= 0 ? t.messages.reminded.today : days === 1 ? t.messages.reminded.yesterday : plural(t.messages.reminded.days, days)
    },
    [t, plural]
  )
}
