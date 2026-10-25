import { useQueryClient } from '@tanstack/react-query'
import { MESSAGE_KINDS } from '@hellokido/core/api'
import { messageKeys, useTemplates } from '../../data/messages'
import { tasks } from '../../lib/navigation'
import { useI18n } from '../../providers/I18n'
import { ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { ActionRow, Card, FIRST_GROUP, GroupFooter, Row, Screen, Section } from '../../ui/Screen'
import { SettingTitle } from './bits'

/**
 * The WhatsApp texts parents receive, by kind, as the web panel's Settings lists them: the one in use
 * for each kind, more to choose from, and free ones sent from a child's page.
 */
export function MessagesScreen() {
  const { t } = useI18n()
  const client = useQueryClient()
  const templates = useTemplates()
  const refresh = () => client.invalidateQueries({ queryKey: messageKeys.templates })

  if (!templates.data) {
    return (
      <Screen>
        <Section title={t.messages.kinds.lesson} style={FIRST_GROUP}>
          {templates.isError ? (
            <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
          ) : (
            <ListSkeleton rows={3} />
          )}
        </Section>
      </Screen>
    )
  }

  return (
    <Screen onRefresh={refresh}>
      {MESSAGE_KINDS.map((kind, index) => {
        const rows = templates.data.filter((row) => row.kind === kind)
        return (
          <Section key={kind} title={t.messages.kinds[kind]} aside={rows.length > 0 ? rows.length : undefined} style={index === 0 ? FIRST_GROUP : undefined}>
            <Card>
              {rows.map((row) => (
                <Row
                  key={row.id}
                  title={<SettingTitle>{row.title}</SettingTitle>}
                  // The start of the text, on one line, so a list of look-alike names still tells them apart
                  subtitle={row.body.replace(/\s+/g, ' ').trim()}
                  value={row.is_default && kind !== 'custom' ? <Mark tone="accent">{t.messages.inUse}</Mark> : undefined}
                  chevron
                  onPress={() => tasks.messageTemplate({ id: row.id })}
                />
              ))}
              <ActionRow icon="add" label={t.messages.add} onPress={() => tasks.messageTemplate({ kind })} />
            </Card>
            <GroupFooter>{t.messages.kindHints[kind]}</GroupFooter>
          </Section>
        )
      })}
    </Screen>
  )
}
