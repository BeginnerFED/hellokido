import { Stack } from 'expo-router'
import { stackOptions } from '../../../lib/stack'
import { useI18n } from '../../../providers/I18n'
import { useColors } from '../../../theme/colors'

export const unstable_settings = { anchor: 'more' }

/** The More tab: its list first, the waitlist, notes and settings pushed on top with their own titles. */
export default function MoreStack() {
  const c = useColors()
  const { t } = useI18n()
  return (
    <Stack screenOptions={stackOptions(c)}>
      <Stack.Screen name="more" options={{ title: t.shell.nav.more }} />
      <Stack.Screen name="waitlist" options={{ title: t.shell.nav.waitlist }} />
      <Stack.Screen name="notes" options={{ title: t.shell.nav.notes }} />
      <Stack.Screen name="settings" options={{ title: t.shell.nav.settings }} />
      <Stack.Screen name="messages" options={{ title: t.messages.texts }} />
    </Stack>
  )
}
