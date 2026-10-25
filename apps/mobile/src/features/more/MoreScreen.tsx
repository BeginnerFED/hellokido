import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { listNotes, listWaitlist } from '@hellokido/core/api'
import { keys } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { useColors } from '../../theme/colors'
import { Icon, type IconName } from '../../ui/Icon'
import { Card, Row, Screen } from '../../ui/Screen'

// Keeps a row as tall as it will be while its line under the name is still loading
const LOADING_LINE = ' '

/** The places used now and then: the waitlist, the notes and the settings, each one tap away. */
export function MoreScreen() {
  const { t, tag, plural } = useI18n()
  const waitlist = useQuery({ queryKey: keys.waitlist, queryFn: listWaitlist })
  const notes = useQuery({ queryKey: keys.notes, queryFn: listNotes })
  const refresh = useCallback(() => Promise.all([waitlist.refetch(), notes.refetch()]), [waitlist, notes])

  const families = waitlist.data?.length
  const noteCount = notes.data?.length
  // The count under a name: an empty line while it loads; nothing when it could not be read (the page itself says why)
  const countLine = (count: number | undefined, failed: boolean, line: (count: number) => string) =>
    count !== undefined ? line(count) : failed ? undefined : LOADING_LINE
  // The settings' own parts say what is inside, so nobody has to open it to find out
  const inside = [t.settings.appearance.title, t.settings.packages.title, t.settings.card.title, t.settings.monthly.title, t.settings.access.title]
    .map((title, index) => (index === 0 ? title : title.toLocaleLowerCase(tag)))
    .join(', ')

  const open = (page: 'waitlist' | 'notes' | 'settings') => router.push(`/(tabs)/(more)/${page}` as Href)

  return (
    <Screen onRefresh={refresh}>
      <Card inset={60}>
        <Row
          leading={<Tablet icon="waitlist" />}
          title={t.shell.nav.waitlist}
          subtitle={countLine(families, waitlist.isError, (count) => (count > 0 ? plural(t.waitlist.summary, count) : t.waitlist.summaryNone))}
          chevron
          onPress={() => open('waitlist')}
        />
        <Row
          leading={<Tablet icon="note" />}
          title={t.shell.nav.notes}
          subtitle={countLine(noteCount, notes.isError, (count) => (count > 0 ? plural(t.notes.count, count) : t.notes.empty))}
          chevron
          onPress={() => open('notes')}
        />
      </Card>
      <Card inset={60}>
        <Row leading={<Tablet icon="settings" />} title={t.shell.nav.settings} subtitle={inside} chevron onPress={() => open('settings')} />
      </Card>
    </Screen>
  )
}

function Tablet({ icon }: { icon: IconName }) {
  const c = useColors()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tablet, { backgroundColor: c.accentWash2 }]}>
      <Icon name={icon} size={18} color={c.accentInk} />
    </View>
  )
}

const styles = StyleSheet.create({
  tablet: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }
})
