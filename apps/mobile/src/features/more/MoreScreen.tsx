import { useCallback } from 'react'
import { router, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { listNotes, listWaitlist } from '@hellokido/core/api'
import { keys } from '../../data/queries'
import { useAuth } from '../../providers/Auth'
import { useI18n } from '../../providers/I18n'
import { Card, IconTile, Row, Screen } from '../../ui/Screen'

/** As large as the icons of Today's waiting jobs, so the two tabs read as one board. */
const TILE = 36

/**
 * The places used now and then, as quiet rows on felt: the waitlist and the notes, each saying what
 * is inside, then the settings. The header says which account is signed in.
 */
export function MoreScreen() {
  const { t, fmt, tag, plural } = useI18n()
  const { session } = useAuth()
  const waitlist = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist })
  const notes = useQuery({ queryKey: keys.notes, queryFn: listNotes })
  const refresh = useCallback(() => Promise.all([waitlist.refetch(), notes.refetch()]), [waitlist, notes])

  // The same count the waitlist's own page opens with
  const families = waitlist.data?.length
  const noteCount = notes.data?.length
  const waitingLine = families === undefined ? undefined : families > 0 ? plural(t.waitlist.summary, families) : t.waitlist.summaryNone
  const notesLine = noteCount === undefined ? undefined : noteCount > 0 ? plural(t.notes.count, noteCount) : t.notes.empty
  // The settings' own parts say what is inside, so nobody has to open it to find out
  const inside = [t.settings.appearance.title, t.settings.packages.title, t.settings.card.title, t.settings.monthly.title, t.settings.access.title]
    .map((title, index) => (index === 0 ? title : title.toLocaleLowerCase(tag)))
    .join(', ')
  const email = session?.user.email

  const open = (page: 'waitlist' | 'notes' | 'settings') => router.push(`/(tabs)/(more)/${page}` as Href)

  return (
    <Screen onRefresh={refresh} title={t.shell.nav.more} subtitle={email ? fmt(t.shell.account.signedInAs, { email }) : undefined} gap={12}>
      <Card>
        <Row
          leading={<IconTile icon="waitlist" size={TILE} />}
          title={t.shell.nav.waitlist}
          // A line kept while the count loads, so the row never changes height
          subtitle={waitingLine ?? ' '}
          chevron
          accessibilityLabel={waitingLine ? `${t.shell.nav.waitlist}, ${waitingLine}` : t.shell.nav.waitlist}
          onPress={() => open('waitlist')}
        />
        <Row
          leading={<IconTile icon="note" size={TILE} />}
          title={t.shell.nav.notes}
          subtitle={notesLine ?? ' '}
          chevron
          accessibilityLabel={notesLine ? `${t.shell.nav.notes}, ${notesLine}` : t.shell.nav.notes}
          onPress={() => open('notes')}
        />
      </Card>
      <Card>
        <Row
          leading={<IconTile icon="settings" size={TILE} />}
          title={t.shell.nav.settings}
          subtitle={inside}
          chevron
          accessibilityLabel={`${t.shell.nav.settings}, ${inside}`}
          onPress={() => open('settings')}
        />
      </Card>
    </Screen>
  )
}
