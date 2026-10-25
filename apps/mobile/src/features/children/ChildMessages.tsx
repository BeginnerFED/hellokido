import { useMemo, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { DEFAULT_MESSAGES, MESSAGE_KINDS, renderMessage, type MessageKind, type Registration, type Usage } from '@hellokido/core/api'
import { whatsAppLink } from '@hellokido/core/rules/phone.js'
import { useChildReminders, useReminderLog, useTemplates } from '../../data/messages'
import { useCatalog, useChildLessons } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import type { MenuItem } from '../../ui/ActionMenu'
import { ActionRow, Card, IconTile, Section } from '../../ui/Screen'
import { DOT, Text } from '../../ui/Text'

const open = (url: string) => Linking.openURL(url).catch(() => undefined)

/**
 * The admin's saved messages as a menu for one family. A tap opens WhatsApp with the text already
 * written for this child (it can still be changed there) and adds it to the messages sent, so the
 * other admin sees it went. Lesson reminders are offered only when a lesson is coming up.
 */
export function useMessageItems(registration: Registration, usage: Usage | undefined): MenuItem[] {
  const { t, money } = useI18n()
  const templates = useTemplates().data
  const catalog = useCatalog().data
  const lessons = useChildLessons(registration.id).data
  const { log } = useReminderLog()

  return useMemo(() => {
    const now = Date.now()
    const next = (lessons ?? [])
      .filter((row) => row.status === 'scheduled' && row.events && new Date(row.events.event_date).getTime() >= now)
      .sort((a, b) => new Date(a.events!.event_date).getTime() - new Date(b.events!.event_date).getTime())[0]
    const packageName = catalog?.packages.find((row) => row.code === registration.package_type)?.name_tr ?? registration.package_type

    const items: MenuItem[] = []
    for (const kind of MESSAGE_KINDS) {
      if (kind === 'lesson' && !next?.events) continue
      // The one in use comes first in its kind; a kind with none of its own offers the built-in text
      const own = (templates ?? []).filter((template) => template.kind === kind)
      own.sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order)
      const choices =
        own.length > 0
          ? own.map((template) => ({ title: template.title, body: template.body, templateId: template.id as string | null }))
          : kind === 'custom'
            ? []
            : [{ title: t.messages.kinds[kind], body: DEFAULT_MESSAGES[kind], templateId: null }]
      for (const choice of choices) {
        const text = renderMessage(choice.body, {
          parentName: registration.parent_name,
          childName: registration.student_name,
          lesson: kind === 'lesson' && next?.events ? { date: next.events.event_date, type: next.events.event_type } : null,
          packageName,
          remaining: usage?.remaining ?? null,
          endDate: registration.package_end_date,
          amount: registration.payment_amount ? money(Number(registration.payment_amount)) : null,
          workshop: catalog?.settings.workshop
        })
        const chat = whatsAppLink(registration.parent_phone, text)
        if (!chat) continue
        items.push({
          label: choice.title,
          icon: 'chat',
          onPress: () => {
            log({ kind, registrationId: registration.id, participantId: kind === 'lesson' ? next?.id : null, templateId: choice.templateId })
            void open(chat)
          }
        })
      }
    }
    const blank = whatsAppLink(registration.parent_phone)
    if (blank) items.push({ label: t.messages.send.blank, icon: 'edit', onPress: () => void open(blank) })
    return items
  }, [lessons, templates, catalog, registration, usage, t, money, log])
}

const FIRST = 4

/** What was sent to this family from the panel or a phone, newest first; nothing until something was. */
export function MessageHistory({ registration }: { registration: Registration }) {
  const { t, date } = useI18n()
  const history = useChildReminders(registration.id)
  const templates = useTemplates().data
  const [all, setAll] = useState(false)
  const rows = history.data ?? []
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, FIRST)

  return (
    <Section title={t.messages.send.history} aside={rows.length}>
      <Card>
        {shown.map((entry) => {
          const title = templates?.find((template) => template.id === entry.template_id)?.title
          const kind = t.messages.kinds[entry.kind as MessageKind] ?? entry.kind
          return (
            <View key={entry.id} style={styles.row}>
              <IconTile icon="chat" />
              <View style={styles.flex}>
                <Text weight="500" numberOfLines={1}>
                  {title ?? kind}
                </Text>
                <Text variant="sub" tone="ink3" tabular numberOfLines={1}>
                  {title && title !== kind ? `${kind}${DOT}` : ''}
                  {date(entry.sent_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )
        })}
        {!all && rows.length > FIRST && <ActionRow label={t.messages.send.showAll} onPress={() => setAll(true)} />}
      </Card>
    </Section>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  // The same row height as the payments and lessons above it on the page
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 62 }
})
